import { changeKey, isNewer, type Change } from '@golf-sg/shared';
import type { SyncApi } from '../sync/api';

/** In-memory stand-in for the sync API with the same last-writer-wins rules. */
export function fakeServer() {
  const items = new Map<string, { change: Change; seq: number }>();
  let seq = 0;
  const api: SyncApi = {
    push: (changes) => {
      const res = { applied: [] as string[], stale: [] as string[], rejected: [] };
      for (const c of changes) {
        const key = changeKey(c.kind, c.id);
        const cur = items.get(key);
        if (cur && !isNewer(c.updatedAt, cur.change.updatedAt)) res.stale.push(c.id);
        else {
          items.set(key, { change: c, seq: ++seq });
          res.applied.push(c.id);
        }
      }
      return Promise.resolve(res);
    },
    pull: (since) => {
      const after = Number(since ?? 0);
      const changes = [...items.values()]
        .filter((i) => i.seq > after)
        .sort((a, b) => a.seq - b.seq)
        .map((i) => i.change);
      return Promise.resolve({ changes, cursor: String(seq), more: false });
    },
    deleteAccount: () => {
      items.clear();
      return Promise.resolve();
    },
  };
  return { api, items };
}
