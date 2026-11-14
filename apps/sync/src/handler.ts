import {
  cardScanRequestSchema,
  cardLayoutResultSchema,
  cardScanResultSchema,
  changeProblem,
  MAX_CARD_IMAGE_BYTES,
  pushRequestSchema,
  type PushResponse,
} from '@golf-sg/shared';
import type { CardReader } from './card-reader.js';
import type { QuotaResult, ScanQuota } from './quota.js';
import { decodeCursor, type SyncRepo } from './repo.js';

export interface SyncRequest {
  method: string;
  path: string;
  query: Record<string, string | undefined>;
  body: string | undefined;
  /** Verified identity from the JWT authorizer; never taken from the request body. */
  userId: string;
}

export interface SyncResponse {
  status: number;
  body?: unknown;
}

const error = (status: number, message: string): SyncResponse => ({
  status,
  body: { error: message },
});

function parseJson(body: string | undefined): unknown {
  try {
    return body === undefined ? undefined : JSON.parse(body);
  } catch {
    return undefined;
  }
}

export interface Services {
  /** Scorecard photo reader; absent until card reading is switched on (FR-CARD-06). */
  cardReader?: CardReader;
  /** Photo-read limits (FR-CARD-08); reads are unlimited without it, e.g. in local runs. */
  quota?: ScanQuota;
}

const OVER_LIMIT: Record<Exclude<QuotaResult, 'ok'>, string> = {
  'user-day': "You've used today's card photos. Enter this one by hand, or try again tomorrow.",
  'user-month': "You've used this month's card photos. Enter this one by hand.",
  'all-day': 'Card photos are busy today. Enter this one by hand, or try again tomorrow.',
};

/** Routes one authenticated request. Pure apart from its services, so it is easy to test. */
export async function handle(
  req: SyncRequest,
  repo: SyncRepo,
  services: Services = {},
): Promise<SyncResponse> {
  if (req.userId === '') return error(401, 'Not signed in');
  const route = `${req.method.toUpperCase()} ${req.path.replace(/\/+$/, '')}`;
  switch (route) {
    case 'POST /api/sync': {
      const parsed = pushRequestSchema.safeParse(parseJson(req.body));
      if (!parsed.success) return error(400, 'Invalid sync request');
      const result: PushResponse = { applied: [], stale: [], rejected: [] };
      for (const change of parsed.data.changes) {
        const problem = changeProblem(change);
        if (problem) {
          result.rejected.push({ id: change.id, reason: problem });
          continue;
        }
        const outcome = await repo.put(req.userId, change);
        result[outcome].push(change.id);
      }
      return { status: 200, body: result };
    }
    case 'GET /api/sync': {
      const cursor = decodeCursor(req.query.since);
      if (!cursor) return error(400, 'Invalid cursor');
      return { status: 200, body: await repo.since(req.userId, cursor) };
    }
    case 'POST /api/card-scan': {
      if (!services.cardReader) return error(503, 'Card reading is not enabled');
      const parsed = cardScanRequestSchema.safeParse(parseJson(req.body));
      if (!parsed.success) return error(400, 'Send a JPEG, PNG or WebP photo under 3.75 MB');
      const image = Buffer.from(parsed.data.image, 'base64');
      if (image.byteLength > MAX_CARD_IMAGE_BYTES) return error(413, 'Photo is too large');
      const quota = (await services.quota?.take(req.userId)) ?? 'ok';
      if (quota !== 'ok') return error(429, OVER_LIMIT[quota]);
      const { kind, mediaType } = parsed.data;
      // The photo is only passed through to the reader; it is never stored or logged.
      const answer = await services.cardReader.read(image, mediaType, kind);
      const result =
        kind === 'layout'
          ? cardLayoutResultSchema.safeParse(answer)
          : cardScanResultSchema.safeParse(answer);
      if (!result.success) return error(502, 'Could not read the scorecard');
      return { status: 200, body: result.data };
    }
    case 'DELETE /api/account':
      await repo.deleteAll(req.userId);
      return { status: 204 };
    default:
      return error(404, 'Not found');
  }
}
