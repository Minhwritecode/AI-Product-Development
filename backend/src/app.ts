import cors from '@fastify/cors';
import Fastify from 'fastify';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });

  app.get('/health', async () => ({ status: 'ok', service: 'luminex-backend' }));

  app.get('/ready', async (_request, reply) => {
    // Dependency checks will be added with the database/Redis adapters.
    return reply.send({ status: 'ready', dependencies: { postgres: 'not-configured', redis: 'not-configured' } });
  });

  app.get('/api/v1', async () => ({
    data: { name: 'Luminex API', version: 'v1', status: 'skeleton' },
    meta: { requestId: 'local' },
    error: null
  }));

  return app;
}
