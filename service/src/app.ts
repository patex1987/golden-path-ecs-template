import 'reflect-metadata';

import type { INestApplication, LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { config } from './config.js';

function getNestLogger(
  logLevel: typeof config.LOG_LEVEL,
  nodeEnv: typeof config.NODE_ENV,
): LogLevel[] | false {
  if (nodeEnv === 'test') {
    return false;
  }

  if (logLevel === 'debug') {
    return ['debug', 'log', 'warn', 'error'];
  }

  if (logLevel === 'warn') {
    return ['warn', 'error'];
  }

  if (logLevel === 'error') {
    return ['error'];
  }

  return ['log', 'warn', 'error'];
}

export async function createApp(): Promise<INestApplication> {
  return NestFactory.create(AppModule, {
    logger: getNestLogger(config.LOG_LEVEL, config.NODE_ENV),
  });
}
