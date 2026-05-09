import { createApp } from './app.js';
import { config } from './config.js';

/**
 * Transport layer: Start the HTTP server
 * 
 * This file is responsible for:
 * - Creating the Fastify instance (from app.ts)
 * - Listening on the configured port
 * - Handling process lifecycle (SIGTERM, SIGINT)
 */

async function main() {
  const app = await createApp();

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info(`Server listening on port ${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
