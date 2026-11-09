import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ApiError } from '@golf-sg/shared';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { healthRoutes } from './routes/health.js';

export interface BuildAppOptions {
  logger?: FastifyServerOptions['logger'];
  webDistDir?: string | undefined;
}

const statusOf = (err: unknown): number =>
  typeof err === 'object' &&
  err !== null &&
  'statusCode' in err &&
  typeof err.statusCode === 'number'
    ? err.statusCode
    : 500;

/**
 * Static host for the PWA plus health checks. Course/round data endpoints were removed until
 * authenticated sync exists (PRD Phase 2); all user data stays on the device.
 */
export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const server = Fastify({
    logger: opts.logger ?? false,
    requestIdHeader: 'x-request-id',
    bodyLimit: 256 * 1024,
  });

  // Same CSP as CloudFront (web.yml), allowing Google Identity Services for optional sign-in.
  await server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com/gsi/style'],
        imgSrc: ["'self'", 'data:', 'https://*.googleusercontent.com'],
        connectSrc: ["'self'", 'https://accounts.google.com/gsi/'],
        frameSrc: ['https://accounts.google.com/gsi/'],
      },
    },
  });

  server.setErrorHandler((err, req, reply) => {
    const statusCode = statusOf(err);
    if (statusCode >= 500) req.log.error({ err }, 'unhandled error');
    const message = statusCode >= 500 ? 'Internal Server Error' : (err as Error).message;
    return reply.code(statusCode).send({ error: 'Error', message } satisfies ApiError);
  });

  await server.register(
    async (api) => {
      await api.register(healthRoutes);
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
    server.log.warn({ webRoot }, 'web assets not found; serving health checks only');
  }

  return server;
}
