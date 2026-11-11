import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthRequiredError, httpSyncApi, ScanRejectedError } from './api';

const respond = (status: number, body?: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status })),
    ),
  );
const photo = { mediaType: 'image/jpeg' as const, image: 'AAAA' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('httpSyncApi.scanCard', () => {
  it('posts the photo with the Google token and parses the marks', async () => {
    respond(200, { courseName: 'Pebble Creek', tees: '', holes: [] });
    const api = httpSyncApi(() => Promise.resolve('token'), '/api');
    await expect(api.scanCard(photo)).resolves.toEqual({
      courseName: 'Pebble Creek',
      tees: '',
      holes: [],
    });
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(url).toBe('/api/card-scan');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ authorization: 'Bearer token' });
  });

  it('separates photos the reader rejects from failures worth retrying', async () => {
    const api = httpSyncApi(() => Promise.resolve('token'), '/api');
    respond(502, { error: 'x' });
    await expect(api.scanCard(photo)).rejects.toBeInstanceOf(ScanRejectedError);
    respond(500, { error: 'x' });
    await expect(api.scanCard(photo)).rejects.not.toBeInstanceOf(ScanRejectedError);
    respond(401);
    await expect(api.scanCard(photo)).rejects.toBeInstanceOf(AuthRequiredError);
  });
});
