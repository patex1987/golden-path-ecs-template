import { z } from 'zod';

/**
 * Configuration schema using Zod (TypeScript's answer to Pydantic)
 * 
 * This validates and types environment variables at startup.
 * If validation fails, the app crashes immediately with clear errors.
 */
const configSchema = z.object({
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

/**
 * Parsed and validated config (like a Pydantic model instance)
 * 
 * Type is inferred from the schema: z.infer<typeof configSchema>
 * This gives you IDE autocomplete and compile-time type safety.
 */
export const config = configSchema.parse(process.env);

/**
 * Export the config type for use elsewhere
 * Usage: import type { Config } from './config'
 */
export type Config = typeof config;
