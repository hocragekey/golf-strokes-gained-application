import {
  changeKey,
  courseChange,
  isNewer,
  MAX_PUSH_CHANGES,
  roundChange,
  tombstone,
  type Change,
} from '@golf-sg/shared';
import type { GolfDb, MetaEntry, PendingChange } from '../data/db';
import type { SyncApi } from './api';

export interface SyncResult {
  pushed: number;
  pulled: number;
  rejected: { id: string; reason: string }[];
}

const nowIso = (): string => new Date().toISOString();

/**
 * Local-first sync (FR-SYNC): push the outbox, then pull changes since the stored cursor and apply
 * them with last-writer-wins. IndexedDB stays the source of truth; failures leave the outbox intact.
 */
export class SyncEngine {
  constructor(
    private readonly db: GolfDb,
    private readonly api: SyncApi,
  ) {}

  async meta(key: MetaEntry['key']): Promise<string | undefined> {
    return (await this.db.meta.get(key))?.value;
  }

  private setMeta(key: MetaEntry['key'], value: string) {
    return this.db.meta.put({ key, value });
  }

  pendingCount(): Promise<number> {
    return this.db.pending.count();
  }

  /**
   * Called on sign-in. A device syncing for the first time (or as a different account) queues
   * everything it holds, so existing rounds upload (FR-SYNC-01). Unsent rounds another account left
   * behind are dropped rather than uploaded into this one.
   */
  async adopt(sub: string): Promise<void> {
    const previous = await this.meta('syncedSub');
    if (previous === sub) return;
    const tables = [this.db.rounds, this.db.courses, this.db.pending, this.db.meta];
    await this.db.transaction('rw', tables, async () => {
      if (previous) await Promise.all([this.db.rounds.clear(), this.db.courses.clear()]);
      const queue = (kind: PendingChange['kind'], e: { id: string; updatedAt: string }) =>
        this.db.pending.put({
          key: changeKey(kind, e.id),
          kind,
          id: e.id,
          updatedAt: e.updatedAt,
          deleted: false,
        });
      await this.db.pending.clear();
      for (const r of await this.db.rounds.toArray()) await queue('round', r);
      for (const c of await this.db.courses.toArray()) await queue('course', c);
      await this.db.meta.clear();
      await this.setMeta('syncedSub', sub);
    });
  }

  /**
   * Called on sign-out (FR-ACCT-03). Uploaded data leaves the device; anything still pending stays,
   * with its outbox and sync state, so it uploads when the same golfer signs back in.
   */
  async signOut(): Promise<void> {
    const tables = [this.db.rounds, this.db.courses, this.db.pending, this.db.meta];
    await this.db.transaction('rw', tables, async () => {
      const keep = new Set((await this.db.pending.toArray()).map((p) => p.key));
      if (keep.size === 0) {
        await Promise.all(tables.map((t) => t.clear()));
        return;
      }
      await this.db.rounds.filter((r) => !keep.has(changeKey('round', r.id))).delete();
      await this.db.courses.filter((c) => !keep.has(changeKey('course', c.id))).delete();
    });
  }

  /**
   * Called after the server copy was deleted (FR-ACCT-04): rounds kept on the device are not
   * queued again, so signing back in does not restore the deleted account data.
   */
  async forgetServerCopy(): Promise<void> {
    await this.db.transaction('rw', this.db.pending, this.db.meta, async () => {
      await Promise.all([this.db.pending.clear(), this.db.meta.delete('cursor')]);
    });
  }

  async run(): Promise<SyncResult> {
    const result: SyncResult = { pushed: 0, pulled: 0, rejected: [] };
    const pending = await this.db.pending.toArray();
    for (let i = 0; i < pending.length; i += MAX_PUSH_CHANGES) {
      const batch = pending.slice(i, i + MAX_PUSH_CHANGES);
      const changes = await Promise.all(batch.map((p) => this.toChange(p)));
      const res = await this.api.push(changes);
      result.pushed += res.applied.length;
      result.rejected.push(...res.rejected);
      // Drop only entries that did not change again while the push was in flight.
      await this.db.transaction('rw', this.db.pending, async () => {
        for (const [j, p] of batch.entries()) {
          const current = await this.db.pending.get(p.key);
          if (current?.updatedAt === changes[j]?.updatedAt) await this.db.pending.delete(p.key);
        }
      });
    }

    let cursor = await this.meta('cursor');
    for (;;) {
      const page = await this.api.pull(cursor);
      for (const change of page.changes) if (await this.apply(change)) result.pulled++;
      cursor = page.cursor;
      await this.setMeta('cursor', cursor);
      if (!page.more) break;
    }
    await this.setMeta('lastSyncedAt', nowIso());
    return result;
  }

  private async toChange(p: PendingChange): Promise<Change> {
    if (!p.deleted) {
      const entity =
        p.kind === 'round' ? await this.db.rounds.get(p.id) : await this.db.courses.get(p.id);
      if (entity) return 'layout' in entity ? roundChange(entity) : courseChange(entity);
    }
    return tombstone(p.kind, p.id, p.updatedAt);
  }

  /** Applies a server change unless this device holds a newer copy. Returns true if applied. */
  private async apply(change: Change): Promise<boolean> {
    const key = changeKey(change.kind, change.id);
    const tables = [this.db.rounds, this.db.courses, this.db.pending];
    return this.db.transaction('rw', tables, async () => {
      const pending = await this.db.pending.get(key);
      if (pending && !isNewer(change.updatedAt, pending.updatedAt)) return false;
      const table = change.kind === 'round' ? this.db.rounds : this.db.courses;
      const local = await table.get(change.id);
      if (local && !isNewer(change.updatedAt, local.updatedAt)) return false;
      if (change.deletedAt !== null) {
        if (!local) return false;
        await table.delete(change.id);
      } else if (change.kind === 'round' && change.data) {
        await this.db.rounds.put(change.data);
      } else if (change.kind === 'course' && change.data) {
        await this.db.courses.put(change.data);
      }
      if (pending) await this.db.pending.delete(key);
      return true;
    });
  }
}
