import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import { context as otelContext, propagation, trace } from '@opentelemetry/api';

import type { AuthenticatedUser } from '../../domain/authentication/authenticated-user';
import type { ReservationWorkObservabilityContext } from '../../application/movie-reservations/ports/reservation-work-observability-context-provider';

const requestIdPattern = /^[A-Za-z0-9._:/@-]{1,128}$/;
const traceparentPattern = /^[\da-f]{2}-[\da-f]{32}-[\da-f]{16}-[\da-f]{2}$/i;

export interface RequestContext {
  readonly correlationId: string;
  readonly requestId: string;
  readonly traceparent?: string;
  readonly tracestate?: string;
  readonly awsXAmznTraceId?: string;
  readonly method?: string;
  readonly path?: string;
  readonly userId?: string;
  readonly movieProviderId?: string;
  readonly movieProviderCode?: string;
}

export interface IncomingRequestContextInput {
  readonly method?: string;
  readonly path?: string;
  readonly correlationIdHeader: string | readonly string[] | undefined;
  readonly requestIdHeader: string | readonly string[] | undefined;
  readonly traceparentHeader: string | readonly string[] | undefined;
  readonly tracestateHeader: string | readonly string[] | undefined;
  readonly awsXAmznTraceIdHeader: string | readonly string[] | undefined;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function createRequestContext(input: IncomingRequestContextInput): RequestContext {
  return {
    correlationId: normalizeContextId(readFirstHeaderValue(input.correlationIdHeader)),
    requestId: normalizeContextId(readFirstHeaderValue(input.requestIdHeader)),
    ...readOptionalField('method', input.method),
    ...readOptionalField('path', input.path),
    ...readOptionalContextFields(input),
  };
}

export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  return requestContextStorage.run(context, callback);
}

export function getCurrentRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function enrichRequestContextWithAuthenticatedUser(user: AuthenticatedUser): void {
  const currentContext = requestContextStorage.getStore();

  if (currentContext === undefined) {
    return;
  }

  requestContextStorage.enterWith({
    ...currentContext,
    userId: user.userId,
    movieProviderId: user.movieProviderId,
    ...(user.movieProviderCode === undefined ? {} : { movieProviderCode: user.movieProviderCode }),
  });
}

export function getCurrentReservationWorkObservabilityContext(): ReservationWorkObservabilityContext | undefined {
  const currentContext = requestContextStorage.getStore();

  if (currentContext === undefined) {
    return undefined;
  }

  const activeTraceparent = createTraceparentFromActiveSpan() ?? currentContext.traceparent;

  if (activeTraceparent === undefined) {
    return undefined;
  }

  return {
    correlationId: currentContext.correlationId,
    requestId: currentContext.requestId,
    traceparent: activeTraceparent,
    ...(currentContext.tracestate === undefined ? {} : { tracestate: currentContext.tracestate }),
  };
}

export function createTraceparentFromActiveSpan(): string | undefined {
  const activeSpan = trace.getActiveSpan();

  if (activeSpan === undefined) {
    return undefined;
  }

  const spanContext = activeSpan.spanContext();

  if (!trace.isSpanContextValid(spanContext)) {
    return undefined;
  }

  return `00-${spanContext.traceId}-${spanContext.spanId}-${spanContext.traceFlags.toString(16).padStart(2, '0')}`;
}

export function readTraceIdFromActiveSpan(): string | undefined {
  const activeSpan = trace.getActiveSpan();

  if (activeSpan === undefined) {
    return undefined;
  }

  const spanContext = activeSpan.spanContext();

  if (!trace.isSpanContextValid(spanContext)) {
    return undefined;
  }

  return spanContext.traceId;
}

export function readTraceIdFromTraceparent(traceparent: string | undefined): string | undefined {
  const normalizedTraceparent = normalizeTraceparent(traceparent);

  if (normalizedTraceparent === undefined) {
    return undefined;
  }

  const [, traceId] = normalizedTraceparent.split('-');

  return traceId;
}

export function getActivePropagationHeaders(): { readonly traceparent?: string; readonly tracestate?: string } {
  const carrier: Record<string, string> = {};

  propagation.inject(otelContext.active(), carrier);

  return {
    ...readOptionalField('traceparent', normalizeTraceparent(carrier.traceparent)),
    ...readOptionalField('tracestate', normalizeOptionalHeaderValue(carrier.tracestate, 512)),
  };
}

function readOptionalContextFields(input: IncomingRequestContextInput): Partial<RequestContext> {
  return {
    ...readOptionalField('traceparent', normalizeTraceparent(readFirstHeaderValue(input.traceparentHeader))),
    ...readOptionalField('tracestate', normalizeOptionalHeaderValue(readFirstHeaderValue(input.tracestateHeader), 512)),
    ...readOptionalField(
      'awsXAmznTraceId',
      normalizeOptionalHeaderValue(readFirstHeaderValue(input.awsXAmznTraceIdHeader), 512),
    ),
  };
}

function readOptionalField<Key extends keyof RequestContext>(
  key: Key,
  value: RequestContext[Key] | undefined,
): Partial<RequestContext> {
  return value === undefined ? {} : { [key]: value };
}

function normalizeContextId(value: string | undefined): string {
  if (value !== undefined && requestIdPattern.test(value)) {
    return value;
  }

  return randomUUID();
}

function normalizeTraceparent(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return traceparentPattern.test(value) ? value.toLowerCase() : undefined;
}

function normalizeOptionalHeaderValue(value: string | undefined, maxLength: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const sanitizedValue = value.replaceAll(/[\r\n]/g, ' ').trim();

  if (sanitizedValue.length === 0 || sanitizedValue.length > maxLength) {
    return undefined;
  }

  return sanitizedValue;
}

function readFirstHeaderValue(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.[0];
}
