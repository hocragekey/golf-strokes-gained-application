import {
  cardScanResultSchema,
  pullResponseSchema,
  type CardScanRequest,
  type CardScanResult,
  pushResponseSchema,
  type Change,
  type PullResponse,
  type PushResponse,
} from '@golf-sg/shared';

/** The token is missing, expired or rejected: the golfer needs to sign in again. */
export class AuthRequiredError extends Error {
  constructor() {
    super('Sign in again to sync');
  }
}

/** The reader refused or could not make sense of the photo; retrying the same photo won't help. */
export class ScanRejectedError extends Error {}

export interface SyncApi {
  push(changes: Change[]): Promise<PushResponse>;
  pull(since: string | undefined): Promise<PullResponse>;
  deleteAccount(): Promise<void>;
  scanCard(scan: CardScanRequest): Promise<CardScanResult>;
}

const SCAN_REJECTED: Record<number, string> = {
  400: 'That photo could not be used.',
  413: 'That photo is too large.',
  502: "We couldn't read that scorecard.",
  503: 'Reading scorecard photos is switched off.',
};

/** Same-origin sync API client; CloudFront routes /api/* to API Gateway. */
export function httpSyncApi(
  getToken: () => Promise<string | null>,
  base = `${import.meta.env.BASE_URL}api`,
): SyncApi {
  async function call(path: string, init: RequestInit = {}): Promise<unknown> {
    const token = await getToken();
    if (!token) throw new AuthRequiredError();
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
    });
    if (res.status === 401 || res.status === 403) throw new AuthRequiredError();
    const rejected = path === '/card-scan' ? SCAN_REJECTED[res.status] : undefined;
    if (rejected) throw new ScanRejectedError(rejected);
    if (!res.ok) throw new Error(`Sync failed (${String(res.status)})`);
    return res.status === 204 ? undefined : res.json();
  }
  return {
    push: async (changes) =>
      pushResponseSchema.parse(
        await call('/sync', { method: 'POST', body: JSON.stringify({ changes }) }),
      ),
    pull: async (since) =>
      pullResponseSchema.parse(
        await call(since ? `/sync?since=${encodeURIComponent(since)}` : '/sync'),
      ),
    deleteAccount: async () => {
      await call('/account', { method: 'DELETE' });
    },
    scanCard: async (scan) =>
      cardScanResultSchema.parse(
        await call('/card-scan', { method: 'POST', body: JSON.stringify(scan) }),
      ),
  };
}
