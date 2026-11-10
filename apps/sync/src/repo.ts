import { PULL_OVERLAP_MS, type Change } from '@golf-sg/shared';

export type PutResult = 'applied' | 'stale';

export interface Page {
  changes: Change[];
  cursor: string;
  more: boolean;
}

/** Storage for one golfer's synced entities. Every method is scoped to `userId`. */
export interface SyncRepo {
  /** Stores the change unless the server already has a newer (or equal) version. */
  put(userId: string, change: Change): Promise<PutResult>;
  /** Changes written after the cursor, oldest first. */
  since(userId: string, cursor: Cursor): Promise<Page>;
  deleteAll(userId: string): Promise<void>;
}

/** Position in a golfer's change feed: a lower bound plus, mid-page, the last item returned. */
export interface Cursor {
  after: string | null;
  last?: { sk: string; syncedAt: string };
}

export const PAGE_SIZE = 200;

export const sortKey = (change: Pick<Change, 'kind' | 'id'>): string =>
  `${change.kind.toUpperCase()}#${change.id}`;

export const encodeCursor = (cursor: Cursor): string =>
  Buffer.from(JSON.stringify(cursor)).toString('base64url');

export function decodeCursor(value: string | undefined): Cursor | null {
  if (value === undefined || value === '') return { after: null };
  try {
    const raw = JSON.parse(Buffer.from(value, 'base64url').toString()) as Partial<Cursor>;
    const iso = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
    if (raw.after !== null && !iso(raw.after)) return null;
    if (raw.last !== undefined && !(typeof raw.last.sk === 'string' && iso(raw.last.syncedAt))) {
      return null;
    }
    return { after: raw.after ?? null, ...(raw.last ? { last: raw.last } : {}) };
  } catch {
    return null;
  }
}

/** Cursor for the next pull once a feed is fully read: re-reads a short overlap for clock skew. */
export function finalCursor(previous: Cursor, newest: string | undefined): string {
  if (newest === undefined) return encodeCursor({ after: previous.after });
  return encodeCursor({ after: new Date(Date.parse(newest) - PULL_OVERLAP_MS).toISOString() });
}
