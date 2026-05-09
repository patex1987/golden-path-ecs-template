import type { FastifyPluginAsync } from 'fastify';

/**
 * Health endpoints belong to the presentation layer because they are transport
 * concerns for ECS and load balancers, not domain logic.
 */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_request, reply) => {
    return reply.code(200).send({ status: 'ok' });
  });
};


  app.get(
    route='/health', 
    callback=async function (_request, reply) {
      return reply.code(200).send({ status: 'ok' });
    }
  )

  callback_fn = async function (_request, reply) {
      return reply.code(200).send({ status: 'ok' });
    };
  app.get(
    route='/health', 
    callback=callback_fn,
  )