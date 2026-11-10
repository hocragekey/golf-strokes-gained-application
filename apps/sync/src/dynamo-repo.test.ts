import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { afterAll, describe } from 'vitest';
import { DynamoRepo, SYNCED_AT_INDEX } from './dynamo-repo.js';
import { repoContract } from './repo.contract.js';
import { tickingClock } from './test/fixtures.js';

/** Runs against DynamoDB Local when DYNAMODB_ENDPOINT is set (CI starts it as a service). */
const endpoint = process.env.DYNAMODB_ENDPOINT;
const config = {
  endpoint,
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
};
const client = new DynamoDBClient(config);
const tables: string[] = [];

async function createTable(): Promise<string> {
  const name = `sync-test-${String(Date.now())}-${String(tables.length)}`;
  tables.push(name);
  await client.send(
    new CreateTableCommand({
      TableName: name,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
        { AttributeName: 'syncedAt', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      LocalSecondaryIndexes: [
        {
          IndexName: SYNCED_AT_INDEX,
          KeySchema: [
            { AttributeName: 'pk', KeyType: 'HASH' },
            { AttributeName: 'syncedAt', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    }),
  );
  return name;
}

describe.skipIf(!endpoint)('DynamoRepo (DynamoDB Local)', () => {
  afterAll(async () => {
    await Promise.all(
      tables.map((TableName) => client.send(new DeleteTableCommand({ TableName }))),
    );
  });
  repoContract(
    async (pageSize) => new DynamoRepo(await createTable(), config, tickingClock(), pageSize),
  );
});
