import type { FastifyPluginAsync } from 'fastify';
import { healthRoutes } from './routes/health-routes.js';

/**
 * Presentation layer entry point for HTTP route registration.
 *
 * In Fastify, a plugin is the closest equivalent to a router module in many
 * Python frameworks. Keeping HTTP registration here lets `app.ts` stay focused
 * on application composition instead of individual endpoints.
 */
export const httpApi: FastifyPluginAsync = async (app) => {
  await app.register(healthRoutes);
};
