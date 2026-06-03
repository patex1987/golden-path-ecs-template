import { Injectable, type NestMiddleware } from '@nestjs/common';

import { applicationLogger } from '../../../infrastructure/observability/application-logger';
import { createRequestContext, runWithRequestContext } from '../../../infrastructure/observability/request-context';
import { recordHttpRequest } from '../../../infrastructure/observability/metrics';

interface RequestContextHttpRequest {
  readonly method?: string;
  readonly originalUrl?: string;
  readonly url?: string;
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
}

interface RequestContextHttpResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  on(event: 'finish', listener: () => void): void;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: RequestContextHttpRequest, res: RequestContextHttpResponse, next: () => void): void {
    const startedAt = process.hrtime.bigint();
    const context = createRequestContext({
      ...(req.method === undefined ? {} : { method: req.method }),
      ...((req.originalUrl ?? req.url) === undefined ? {} : { path: req.originalUrl ?? req.url }),
      correlationIdHeader: req.headers['x-correlation-id'],
      requestIdHeader: req.headers['x-request-id'],
      traceparentHeader: req.headers.traceparent,
      tracestateHeader: req.headers.tracestate,
      awsXAmznTraceIdHeader: req.headers['x-amzn-trace-id'],
    });

    res.setHeader('X-Correlation-Id', context.correlationId);
    res.setHeader('X-Request-Id', context.requestId);

    runWithRequestContext(context, () => {
      res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        const route = readRoute(req);
        recordHttpRequest({
          method: req.method ?? 'UNKNOWN',
          route,
          statusCode: res.statusCode,
          durationMs,
        });

        if (!shouldLogHttpRequest(route)) {
          return;
        }

        applicationLogger.info('http.request.finish', {
          http_status_code: res.statusCode,
          duration_ms: durationMs,
          request_id: context.requestId,
          ...(context.awsXAmznTraceId === undefined ? {} : { aws_x_amzn_trace_id: context.awsXAmznTraceId }),
          http_method: req.method ?? 'UNKNOWN',
          http_route: route,
        });
      });

      next();
    });
  }
}

function readRoute(req: RequestContextHttpRequest): string {
  return req.originalUrl ?? req.url ?? 'unknown';
}

function shouldLogHttpRequest(route: string): boolean {
  const path = route.split('?')[0];

  return path !== '/health' && path !== '/ready';
}
