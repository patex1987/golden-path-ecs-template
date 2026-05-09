import Fastify from 'fastify';
import { config } from './config.js';
import { httpApi } from './presentation/http/http-api.js';

/**
 * Create and configure the Fastify application instance.
 * This function returns a configured app without starting it.
 * (The actual `.listen()` call happens in index.ts)
 */
export async function createApp() {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
    },
  });
  await app.register(httpApi);

  return app;
}
