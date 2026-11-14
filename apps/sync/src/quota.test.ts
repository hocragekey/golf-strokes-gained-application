import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import type { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { describe, expect, it } from 'vitest';
import { dynamoQuota, memoryQuota } from './quota.js';

const limits = { perUserPerDay: 2, perUserPerMonth: 3, allUsersPerDay: 4 };
const day1 = new Date('2026-11-14T12:00:00Z');
const day2 = new Date('2026-11-15T12:00:00Z');

describe('memoryQuota', () => {
  it('enforces the daily, monthly and all-users limits', async () => {
    const q = memoryQuota(limits);
    expect(await q.take('a', day1)).toBe('ok');
    expect(await q.take('a', day1)).toBe('ok');
    expect(await q.take('a', day1)).toBe('user-day');
    expect(await q.take('a', day2)).toBe('ok');
    expect(await q.take('a', day2)).toBe('user-month');
    expect(await q.take('b', day1)).toBe('ok');
    expect(await q.take('b', day1)).toBe('ok');
    expect(await q.take('c', day1)).toBe('all-day');
  });
});

describe('dynamoQuota', () => {
  it('increments all three counters in one conditional transaction', async () => {
    const sent: TransactWriteCommand[] = [];
    const q = dynamoQuota(
      'table',
      {
        send: (c: unknown) => (sent.push(c as TransactWriteCommand), Promise.resolve({})),
      },
      limits,
    );
    expect(await q.take('sub-1', day1)).toBe('ok');
    const items = sent[0]?.input.TransactItems ?? [];
    expect(items.map((i) => [String(i.Update?.Key?.pk), String(i.Update?.Key?.sk)])).toEqual([
      ['QUOTA#sub-1', 'DAY#2026-11-14'],
      ['QUOTA#sub-1', 'MONTH#2026-11'],
      ['QUOTA#ALL', 'DAY#2026-11-14'],
    ]);
    expect(items[0]?.Update?.ExpressionAttributeValues?.[':limit']).toBe(2);
  });

  it('reports which limit was hit', async () => {
    const cancelled = new TransactionCanceledException({
      message: 'cancelled',
      $metadata: {},
      CancellationReasons: [{ Code: 'None' }, { Code: 'ConditionalCheckFailed' }, { Code: 'None' }],
    });
    const q = dynamoQuota('table', { send: () => Promise.reject(cancelled) }, limits);
    expect(await q.take('sub-1', day1)).toBe('user-month');
  });
});
