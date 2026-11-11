import { bedrockCardReader } from './card-reader.js';
import { DynamoRepo } from './dynamo-repo.js';
import { handle, type Services } from './handler.js';

/** The parts of an API Gateway HTTP API (payload v2) event with a JWT authorizer that we use. */
export interface HttpApiEvent {
  rawPath: string;
  queryStringParameters?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
  requestContext: {
    http: { method: string };
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  };
}

export interface HttpApiResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const repo = new DynamoRepo(process.env.TABLE_NAME ?? '');
const cardScanModelId = process.env.CARD_SCAN_MODEL_ID ?? '';
const services: Services = cardScanModelId
  ? { cardReader: bedrockCardReader(cardScanModelId) }
  : {};

export async function handler(event: HttpApiEvent): Promise<HttpApiResult> {
  const sub = event.requestContext.authorizer?.jwt?.claims?.sub;
  const body =
    event.body !== undefined && event.isBase64Encoded === true
      ? Buffer.from(event.body, 'base64').toString()
      : event.body;
  try {
    const res = await handle(
      {
        method: event.requestContext.http.method,
        path: event.rawPath,
        query: event.queryStringParameters ?? {},
        body,
        userId: typeof sub === 'string' ? sub : '',
      },
      repo,
      services,
    );
    return {
      statusCode: res.status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: res.body === undefined ? '' : JSON.stringify(res.body),
    };
  } catch (err) {
    console.error(JSON.stringify({ msg: 'sync failed', error: String(err) }));
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
}
