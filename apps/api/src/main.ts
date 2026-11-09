import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const server = await buildApp({
  logger: { level: config.LOG_LEVEL },
  webDistDir: config.WEB_DIST_DIR,
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  server.log.info({ signal }, 'shutting down');
  try {
    await server.close();
    process.exit(0);
  } catch (err) {
    server.log.error({ err }, 'error during shutdown');
    process.exit(1);
  }
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

await server.listen({ host: config.HOST, port: config.PORT });
