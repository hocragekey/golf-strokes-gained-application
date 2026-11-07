import type { FastifyPluginCallback } from 'fastify';
import type { Repository } from '../repository.js';

export const healthRoutes: FastifyPluginCallback<{ repo: Repository }> = (app, { repo }, done) => {
  app.get('/health', () => ({ status: 'ok' }));

  app.get('/ready', async (_req, reply) => {
    try {
      repo.ping();
      return { status: 'ready' };
    } catch (err) {
      app.log.error({ err }, 'readiness check failed');
      return reply.code(503).send({ status: 'unavailable' });
    }
  });

  done();
};
