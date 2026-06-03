import {
  SpanKind,
  SpanStatusCode,
  context as otelContext,
  propagation,
  trace,
  type Context,
  type Span,
  type SpanAttributes,
} from '@opentelemetry/api';

import type {
  MovieReservationObservability,
  ReservationProcessorClaimedAttributes,
  ReservationProcessorOutcomeAttributes,
  ReservationProcessorSpanAttributes,
  ReservationRequestCreatedAttributes,
} from '../../application/movie-reservations/ports/movie-reservation-observability';
import type { ReservationWorkObservabilityContext } from '../../application/movie-reservations/ports/reservation-work-observability-context-provider';
import type { ReservationRequestId } from '../../domain/movie-reservations/reservation-request-id';
import {
  classifyDiagnosticException,
  recordReservationProcessorClaimed,
  recordReservationProcessorException,
  recordReservationProcessorOutcome,
  recordReservationRequestCreated,
} from './metrics';
import { applicationLogger, type ApplicationLogger, type LogFields } from './application-logger';
import { readTraceIdFromTraceparent } from './request-context';

const reservationProcessorTracer = trace.getTracer('movie-reservation-service.reservation-processor');
const reservationProcessorSpanContextKey = Symbol('movie-reservation-service.reservation-processor-span');

export class OpenTelemetryMovieReservationObservability implements MovieReservationObservability {
  constructor(private readonly logger: ApplicationLogger = applicationLogger) {}

  recordReservationRequestCreated(attributes: ReservationRequestCreatedAttributes): void {
    recordReservationRequestCreated();
    this.logger.info('reservation_request.created', {
      message: 'Reservation request created.',
      business_operation: attributes.businessOperation,
      reservation_request_id: attributes.reservationRequestId,
    });
  }

  async runWithReservationProcessorSpan<T>(
    attributes: ReservationProcessorSpanAttributes,
    operation: () => Promise<T>,
  ): Promise<T> {
    const parentContext = extractProcessorParentContext(attributes.observabilityContext);

    return reservationProcessorTracer.startActiveSpan(
      'reservation_request.process',
      {
        kind: SpanKind.CONSUMER,
        attributes: createProcessorSpanAttributes(attributes),
      },
      parentContext,
      async (span) => {
        const processorContext = otelContext.active().setValue(reservationProcessorSpanContextKey, span);

        return otelContext.with(processorContext, async () => {
          try {
            return await operation();
          } catch (error) {
            recordSpanException(span, error);
            throw error;
          } finally {
            span.end();
          }
        });
      },
    );
  }

  recordReservationProcessorClaimed(attributes: ReservationProcessorClaimedAttributes): void {
    recordReservationProcessorClaimed();
    annotateActiveProcessorClaimedSpan(attributes);
    this.logger.info(
      'reservation_request.processing_started',
      createProcessorLogFields(attributes, {
        message: 'Reservation request processor claimed the request.',
      }),
    );
  }

  recordReservationProcessorOutcome(attributes: ReservationProcessorOutcomeAttributes): void {
    annotateActiveProcessorOutcomeSpan(attributes);
    recordReservationProcessorOutcome({
      outcome: attributes.outcome,
      durationMs: attributes.durationMs,
      ...(attributes.reason === undefined ? {} : { reason: attributes.reason }),
    });

    if (attributes.outcome === 'no-pending-request') {
      return;
    }

    this.logger.info(resolveReservationProcessorOutcomeEvent(attributes), createProcessorOutcomeLogFields(attributes));
  }

  recordReservationProcessorException(error: unknown): void {
    const activeSpan = getActiveProcessorSpan();

    if (activeSpan !== undefined) {
      recordSpanException(activeSpan, error);
    }

    recordReservationProcessorException(classifyDiagnosticException(error));
    this.logger.error('reservation_processor.exception', undefined, error);
  }
}

function extractProcessorParentContext(context: ReservationWorkObservabilityContext | undefined): Context {
  if (context === undefined) {
    return otelContext.active();
  }

  return propagation.extract(otelContext.active(), {
    traceparent: context.traceparent,
    ...(context.tracestate === undefined ? {} : { tracestate: context.tracestate }),
  });
}

function createProcessorSpanAttributes(attributes: ReservationProcessorSpanAttributes): SpanAttributes {
  return {
    'reservation_request.id': attributes.reservationRequestId,
    'reservation_request.sequence': attributes.sequence,
    'reservation_processor.operation': 'process',
    'reservation_work_queue.system': 'postgres',
    'reservation_work_queue.name': 'reservation_requests',
    ...createPersistedContextSpanAttributes(attributes.observabilityContext),
  };
}

function annotateActiveProcessorClaimedSpan(attributes: ReservationProcessorClaimedAttributes): void {
  const activeSpan = getActiveProcessorSpan();

  if (activeSpan === undefined) {
    return;
  }

  activeSpan.setAttributes(createProcessorSpanAttributes(attributes));
}

function annotateActiveProcessorOutcomeSpan(attributes: ReservationProcessorOutcomeAttributes): void {
  const activeSpan = getActiveProcessorSpan();

  if (activeSpan === undefined) {
    return;
  }

  activeSpan.setAttributes({
    ...createOptionalProcessorIdentitySpanAttributes(attributes),
    'reservation_processor.outcome': attributes.outcome,
    'reservation_processor.duration_ms': attributes.durationMs,
    ...(attributes.reason === undefined ? {} : { 'reservation_processor.reason': attributes.reason }),
  });

  if (attributes.outcome === 'failed' || attributes.outcome === 'retryable-failure') {
    activeSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: attributes.reason ?? attributes.outcome,
    });
    return;
  }

  activeSpan.setStatus({ code: SpanStatusCode.OK });
}

function getActiveProcessorSpan(): Span | undefined {
  return otelContext.active().getValue(reservationProcessorSpanContextKey) as Span | undefined;
}

function createOptionalProcessorIdentitySpanAttributes(
  attributes: Pick<ReservationProcessorOutcomeAttributes, 'reservationRequestId' | 'sequence'>,
): SpanAttributes {
  return {
    ...(attributes.reservationRequestId === undefined
      ? {}
      : { 'reservation_request.id': attributes.reservationRequestId }),
    ...(attributes.sequence === undefined ? {} : { 'reservation_request.sequence': attributes.sequence }),
  };
}

function createPersistedContextSpanAttributes(
  context: ReservationWorkObservabilityContext | undefined,
): SpanAttributes {
  if (context === undefined) {
    return {};
  }

  return {
    'app.correlation_id': context.correlationId,
    'app.request_id': context.requestId,
  };
}

function recordSpanException(span: Span, error: unknown): void {
  span.recordException(toSpanException(error));
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: readErrorMessage(error),
  });
}

function toSpanException(error: unknown): Error | string {
  return error instanceof Error ? error : String(error);
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resolveReservationProcessorOutcomeEvent(attributes: ReservationProcessorOutcomeAttributes): string {
  if (attributes.outcome === 'confirmed') {
    return 'reservation_request.confirmed';
  }

  if (attributes.outcome === 'rejected') {
    return 'reservation_request.rejected';
  }

  if (attributes.outcome === 'retryable-failure') {
    return 'reservation_request.processing_retry_scheduled';
  }

  return 'reservation_request.processing_failed';
}

function createProcessorOutcomeLogFields(attributes: ReservationProcessorOutcomeAttributes): LogFields {
  return createProcessorLogFields(attributes, {
    message: createReservationProcessorMessage(attributes),
    outcome: attributes.outcome,
    reason: attributes.reason,
    duration_ms: attributes.durationMs,
  });
}

function createProcessorLogFields(
  attributes: {
    readonly reservationRequestId?: ReservationRequestId;
    readonly observabilityContext?: ReservationWorkObservabilityContext;
  },
  fields: LogFields,
): LogFields {
  return {
    ...fields,
    reservation_request_id: attributes.reservationRequestId,
    ...createPersistedContextLogFields(attributes.observabilityContext),
  };
}

function createPersistedContextLogFields(context: ReservationWorkObservabilityContext | undefined): LogFields {
  if (context === undefined) {
    return {};
  }

  return {
    correlation_id: context.correlationId,
    trace_id: readTraceIdFromTraceparent(context.traceparent),
  };
}

function createReservationProcessorMessage(attributes: ReservationProcessorOutcomeAttributes): string {
  if (attributes.outcome === 'confirmed') {
    return 'Reservation request confirmed.';
  }

  if (attributes.reason === 'seat-conflict') {
    return 'Reservation request rejected because seats are already booked.';
  }

  if (attributes.reason === 'unexpected-error') {
    return 'Reservation request processing hit an unexpected internal error.';
  }

  if (attributes.outcome === 'retryable-failure') {
    return 'Reservation request processing will be retried.';
  }

  if (attributes.outcome === 'failed') {
    return 'Reservation request processing failed.';
  }

  return `Reservation request processing completed with outcome ${attributes.outcome}.`;
}
