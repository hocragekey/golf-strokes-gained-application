import { DynamoDBClient, TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { CARD_SCAN_LIMITS } from '@golf-sg/shared';

/** `ok`, or which limit a photo read would exceed (FR-CARD-08). */
export type QuotaResult = 'ok' | 'user-day' | 'user-month' | 'all-day';

export interface ScanQuota {
  /** Counts one photo read unless it would go over a limit. */
  take(userId: string, now?: Date): Promise<QuotaResult>;
}

type Limits = typeof CARD_SCAN_LIMITS;

interface Counter {
  pk: string;
  sk: string;
  limit: number;
  /** Seconds the counter is kept, so DynamoDB's TTL can delete it. */
  keepFor: number;
  result: Exclude<QuotaResult, 'ok'>;
}

const DAY = 86_400;

function counters(userId: string, now: Date, limits: Limits): Counter[] {
  const day = now.toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  // Separate partition from the golfer's synced data (USER#<sub>), so sync never reads these.
  const user = `QUOTA#${userId}`;
  return [
    {
      pk: user,
      sk: `DAY#${day}`,
      limit: limits.perUserPerDay,
      keepFor: 2 * DAY,
      result: 'user-day',
    },
    {
      pk: user,
      sk: `MONTH#${month}`,
      limit: limits.perUserPerMonth,
      keepFor: 40 * DAY,
      result: 'user-month',
    },
    {
      pk: 'QUOTA#ALL',
      sk: `DAY#${day}`,
      limit: limits.allUsersPerDay,
      keepFor: 2 * DAY,
      result: 'all-day',
    },
  ];
}

/** Counters held in memory; for tests and local runs. */
export function memoryQuota(limits: Limits = CARD_SCAN_LIMITS): ScanQuota {
  const counts = new Map<string, number>();
  return {
    take(userId, now = new Date()) {
      const all = counters(userId, now, limits);
      const over = all.find((c) => (counts.get(`${c.pk}|${c.sk}`) ?? 0) >= c.limit);
      if (over) return Promise.resolve(over.result);
      for (const c of all) counts.set(`${c.pk}|${c.sk}`, (counts.get(`${c.pk}|${c.sk}`) ?? 0) + 1);
      return Promise.resolve('ok');
    },
  };
}

/** Counters in the API table, all incremented in one transaction or not at all. */
export function dynamoQuota(
  tableName: string,
  client: Pick<DynamoDBDocumentClient, 'send'> = DynamoDBDocumentClient.from(
    new DynamoDBClient({}),
  ),
  limits: Limits = CARD_SCAN_LIMITS,
): ScanQuota {
  return {
    async take(userId, now = new Date()) {
      const all = counters(userId, now, limits);
      const epoch = Math.floor(now.getTime() / 1000);
      try {
        await client.send(
          new TransactWriteCommand({
            TransactItems: all.map((c) => ({
              Update: {
                TableName: tableName,
                Key: { pk: c.pk, sk: c.sk },
                // READS is a DynamoDB reserved word.
                UpdateExpression: 'ADD #reads :one SET expiresAt = if_not_exists(expiresAt, :exp)',
                ConditionExpression: 'attribute_not_exists(#reads) OR #reads < :limit',
                ExpressionAttributeNames: { '#reads': 'reads' },
                ExpressionAttributeValues: {
                  ':one': 1,
                  ':limit': c.limit,
                  ':exp': epoch + c.keepFor,
                },
              },
            })),
          }),
        );
        return 'ok';
      } catch (err) {
        if (!(err instanceof TransactionCanceledException)) throw err;
        const reasons = err.CancellationReasons ?? [];
        const over = all.find((_, i) => reasons[i]?.Code === 'ConditionalCheckFailed');
        if (!over) throw err;
        return over.result;
      }
    },
  };
}
