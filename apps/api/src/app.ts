import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ApiError } from '@golf-sg/shared';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { Db } from './db/client.js';
import { HttpError } from './errors.js';
import { Repository } from './repository.js';
import { courseRoutes } from './routes/courses.js';
import { healthRoutes } from './routes/health.js';
import { roundRoutes } from './routes/rounds.js';

export interface BuildAppOptions {
  db: Db;
  logger?: FastifyServerOptions['logger'];
  webDistDir?: string | undefined;
}

export interface App {
  server: FastifyInstance;
  repo: Repository;
}

const statusOf = (err: unknown): number =>
  typeof err === 'object' &&
  err !== null &&
  'statusCode' in err &&
  typeof err.statusCode === 'number'
    ? err.statusCode
    : 500;

export async function buildApp(opts: BuildAppOptions): Promise<App> {
  const server = Fastify({
    logger: opts.logger ?? false,
    requestIdHeader: 'x-request-id',
    bodyLimit: 256 * 1024,
  });
  const repo = new Repository(opts.db);

  await server.register(helmet);

  server.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) {
      const body: ApiError = { error: err.code, message: err.message };
      if (err.issues) body.issues = err.issues;
      return reply.code(err.statusCode).send(body);
    }
    const statusCode = statusOf(err);
    if (statusCode >= 500) req.log.error({ err }, 'unhandled error');
    const message = statusCode >= 500 ? 'Internal Server Error' : (err as Error).message;
    return reply.code(statusCode).send({ error: 'Error', message } satisfies ApiError);
  });

  await server.register(
    async (api) => {
      await api.register(healthRoutes, { repo });
      await api.register(courseRoutes, { repo });
      await api.register(roundRoutes, { repo });
      api.setNotFoundHandler((_req, reply) =>
        reply.code(404).send({ error: 'NotFound', message: 'Route not found' } satisfies ApiError),
      );
    },
    { prefix: '/api' },
  );

  const webRoot = opts.webDistDir && resolve(opts.webDistDir);
  if (webRoot && existsSync(resolve(webRoot, 'index.html'))) {
    await server.register(fastifyStatic, { root: webRoot, wildcard: false });
    server.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' || req.method === 'HEAD') return reply.sendFile('index.html');
      return reply.code(404).send({ error: 'NotFound', message: 'Route not found' });
    });
  } else if (webRoot) {
    server.log.warn({ webRoot }, 'web assets not found; serving API only');
  }

  return { server, repo };
}
