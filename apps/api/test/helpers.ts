import { buildApp, type BuildAppOptions } from '../src/app.js';

export async function createTestApp(opts: BuildAppOptions = {}) {
  const server = await buildApp(opts);
  return { server, close: () => server.close() };
}
