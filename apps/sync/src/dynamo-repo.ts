import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  type DynamoDBClientConfig,
} from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  type QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { changeSchema, type Change } from '@golf-sg/shared';
import {
  encodeCursor,
  finalCursor,
  PAGE_SIZE,
  sortKey,
  type Cursor,
  type Page,
  type PutResult,
  type SyncRepo,
} from './repo.js';

export const SYNCED_AT_INDEX = 'bySyncedAt';

const pk = (userId: string) => `USER#${userId}`;

/**
 * One item per entity: pk = USER#<sub>, sk = ROUND#<id> | COURSE#<id>. `version` (epoch ms of
 * updatedAt) drives the last-writer-wins condition; `syncedAt` orders the change feed.
 */
export class DynamoRepo implements SyncRepo {
  private readonly doc: DynamoDBDocumentClient;

  constructor(
    private readonly table: string,
    config: DynamoDBClientConfig = {},
    private readonly clock: () => Date = () => new Date(),
    private readonly pageSize = PAGE_SIZE,
  ) {
    this.doc = DynamoDBDocumentClient.from(new DynamoDBClient(config), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async put(userId: string, change: Change): Promise<PutResult> {
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.table,
          Item: {
            pk: pk(userId),
            sk: sortKey(change),
            version: Date.parse(change.updatedAt),
            syncedAt: this.clock().toISOString(),
            change,
          },
          ConditionExpression: 'attribute_not_exists(pk) OR version < :version',
          ExpressionAttributeValues: { ':version': Date.parse(change.updatedAt) },
        }),
      );
      return 'applied';
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return 'stale';
      throw err;
    }
  }

  async since(userId: string, cursor: Cursor): Promise<Page> {
    const { after, last } = cursor;
    const input: QueryCommandInput = {
      TableName: this.table,
      IndexName: SYNCED_AT_INDEX,
      KeyConditionExpression: after === null ? 'pk = :pk' : 'pk = :pk AND syncedAt > :after',
      ExpressionAttributeValues: {
        ':pk': pk(userId),
        ...(after === null ? {} : { ':after': after }),
      },
      Limit: this.pageSize,
      ...(last
        ? { ExclusiveStartKey: { pk: pk(userId), sk: last.sk, syncedAt: last.syncedAt } }
        : {}),
    };
    const out = await this.doc.send(new QueryCommand(input));
    const items = (out.Items ?? []) as { sk: string; syncedAt: string; change: unknown }[];
    const tail = items.at(-1);
    const next = out.LastEvaluatedKey === undefined ? undefined : tail;
    return {
      changes: items.map((i) => changeSchema.parse(i.change)),
      more: next !== undefined,
      cursor: next
        ? encodeCursor({ after, last: { sk: next.sk, syncedAt: next.syncedAt } })
        : finalCursor(cursor, tail?.syncedAt ?? last?.syncedAt),
    };
  }

  async deleteAll(userId: string): Promise<void> {
    let start: Record<string, unknown> | undefined;
    do {
      const out = await this.doc.send(
        new QueryCommand({
          TableName: this.table,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: { ':pk': pk(userId) },
          ProjectionExpression: 'pk, sk',
          ExclusiveStartKey: start,
        }),
      );
      const keys = (out.Items ?? []) as { pk: string; sk: string }[];
      for (let i = 0; i < keys.length; i += 25) {
        let requests = keys.slice(i, i + 25).map((Key) => ({ DeleteRequest: { Key } }));
        for (let attempt = 0; requests.length > 0; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
          if (attempt > 8) throw new Error('Could not delete all account data');
          const res = await this.doc.send(
            new BatchWriteCommand({ RequestItems: { [this.table]: requests } }),
          );
          requests = (res.UnprocessedItems?.[this.table] ?? []) as typeof requests;
        }
      }
      start = out.LastEvaluatedKey;
    } while (start);
  }
}
