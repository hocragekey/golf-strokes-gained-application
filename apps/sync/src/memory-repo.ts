import { type Change } from '@golf-sg/shared';
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

interface Item {
  sk: string;
  syncedAt: string;
  change: Change;
}

/** In-memory repository with the same semantics as DynamoDB, for tests and local development. */
export class MemoryRepo implements SyncRepo {
  private readonly users = new Map<string, Map<string, Item>>();

  constructor(
    private readonly clock: () => Date = () => new Date(),
    private readonly pageSize = PAGE_SIZE,
  ) {}

  put(userId: string, change: Change): Promise<PutResult> {
    const items = this.users.get(userId) ?? new Map<string, Item>();
    this.users.set(userId, items);
    const sk = sortKey(change);
    const existing = items.get(sk);
    if (existing && Date.parse(existing.change.updatedAt) >= Date.parse(change.updatedAt)) {
      return Promise.resolve('stale');
    }
    items.set(sk, { sk, syncedAt: this.clock().toISOString(), change });
    return Promise.resolve('applied');
  }

  since(userId: string, cursor: Cursor): Promise<Page> {
    const order = (a: Item, b: Item) =>
      a.syncedAt.localeCompare(b.syncedAt) || a.sk.localeCompare(b.sk);
    const { after, last } = cursor;
    const items = [...(this.users.get(userId)?.values() ?? [])]
      .filter((i) => after === null || i.syncedAt > after)
      .sort(order)
      .filter((i) => !last || order(i, { ...i, ...last }) > 0);
    const page = items.slice(0, this.pageSize);
    const more = items.length > page.length;
    const tail = page.at(-1);
    const newest = [...page]
      .map((i) => i.syncedAt)
      .sort()
      .at(-1);
    return Promise.resolve({
      changes: page.map((i) => i.change),
      more,
      cursor:
        more && tail
          ? encodeCursor({ after, last: { sk: tail.sk, syncedAt: tail.syncedAt } })
          : finalCursor(cursor, newest ?? last?.syncedAt),
    });
  }

  deleteAll(userId: string): Promise<void> {
    this.users.delete(userId);
    return Promise.resolve();
  }
}
