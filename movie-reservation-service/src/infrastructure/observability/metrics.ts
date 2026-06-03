import { metrics } from '@opentelemetry/api';

import type {
  MovieReservationBusinessOperation,
  ReservationProcessorOutcome,
} from '../../application/movie-reservations/ports/movie-reservation-observability';

export type GraphqlOperationOutcome = 'success' | 'graphql_error' | 'auth_error' | 'unexpected_error';

export type DiagnosticExceptionType =
  | 'AuthenticationError'
  | 'ReservationRequestAlreadyExistsError'
  | 'Error'
  | 'unexpected_error';

const meter = metrics.getMeter('movie-reservation-service');

const graphqlOperationTotal = meter.createCounter('graphql_operation_total', {
  description: 'GraphQL operations by bounded business operation and outcome.',
});
const graphqlOperationDurationMs = meter.createHistogram('graphql_operation_duration_ms', {
  description: 'GraphQL operation duration in milliseconds.',
  unit: 'ms',
});
const graphqlOperationExceptionsTotal = meter.createCounter('graphql_operation_exceptions_total', {
  description: 'GraphQL diagnostic exception counts with bounded exception labels.',
});
const reservationRequestCreatedTotal = meter.createCounter('reservation_request_created_total', {
  description: 'Reservation requests accepted by the API.',
});
const reservationProcessorClaimTotal = meter.createCounter('reservation_processor_claim_total', {
  description: 'Reservation requests claimed by the processor.',
});
const reservationProcessorOutcomeTotal = meter.createCounter('reservation_processor_outcome_total', {
  description: 'Reservation processor outcomes.',
});
const reservationProcessorDurationMs = meter.createHistogram('reservation_processor_duration_ms', {
  description: 'Reservation processor execution duration in milliseconds.',
  unit: 'ms',
});
const reservationProcessorExceptionsTotal = meter.createCounter('reservation_processor_exceptions_total', {
  description: 'Reservation processor diagnostic exception counts.',
});
const httpRequestTotal = meter.createCounter('http_request_total', {
  description: 'HTTP requests by method, route, and status family.',
});
const httpRequestDurationMs = meter.createHistogram('http_request_duration_ms', {
  description: 'HTTP request duration in milliseconds.',
  unit: 'ms',
});

const graphqlBusinessOperations: readonly MovieReservationBusinessOperation[] = [
  'me',
  'movies',
  'screenings',
  'requestReservation',
  'reservationRequestStatus',
  'reservationResult',
  'unknown',
];
const graphqlOperationOutcomes: readonly GraphqlOperationOutcome[] = [
  'success',
  'graphql_error',
  'auth_error',
  'unexpected_error',
];
const reservationProcessorOutcomes: readonly ReservationProcessorOutcome[] = [
  'no-pending-request',
  'confirmed',
  'rejected',
  'retryable-failure',
  'failed',
];

let metricSeriesInitialized = false;

export function initializeObservabilityMetricSeries(): void {
  if (metricSeriesInitialized) {
    return;
  }

  metricSeriesInitialized = true;

  for (const businessOperation of graphqlBusinessOperations) {
    for (const outcome of graphqlOperationOutcomes) {
      graphqlOperationTotal.add(0, { business_operation: businessOperation, outcome });
    }
  }

  for (const outcome of reservationProcessorOutcomes) {
    reservationProcessorOutcomeTotal.add(0, { outcome });
  }
}

export function recordGraphqlOperation(input: {
  readonly businessOperation: MovieReservationBusinessOperation;
  readonly operationType: string;
  readonly outcome: GraphqlOperationOutcome;
  readonly durationMs: number;
}): void {
  const attributes = {
    business_operation: input.businessOperation,
    graphql_operation_type: input.operationType,
    outcome: input.outcome,
  };

  graphqlOperationTotal.add(1, attributes);
  graphqlOperationDurationMs.record(input.durationMs, attributes);
}

export function recordGraphqlException(input: {
  readonly businessOperation: MovieReservationBusinessOperation;
  readonly exceptionType: DiagnosticExceptionType;
}): void {
  graphqlOperationExceptionsTotal.add(1, {
    business_operation: input.businessOperation,
    exception_type: input.exceptionType,
  });
}

export function recordReservationRequestCreated(): void {
  reservationRequestCreatedTotal.add(1, { business_operation: 'requestReservation' });
}

export function recordReservationProcessorClaimed(): void {
  reservationProcessorClaimTotal.add(1);
}

export function recordReservationProcessorOutcome(input: {
  readonly outcome: ReservationProcessorOutcome;
  readonly durationMs: number;
  readonly reason?: string;
}): void {
  const attributes = {
    outcome: input.outcome,
    ...(input.reason === undefined ? {} : { reason: input.reason }),
  };

  reservationProcessorOutcomeTotal.add(1, attributes);
  reservationProcessorDurationMs.record(input.durationMs, attributes);
}

export function recordReservationProcessorException(exceptionType: DiagnosticExceptionType): void {
  reservationProcessorExceptionsTotal.add(1, { exception_type: exceptionType });
}

export function recordHttpRequest(input: {
  readonly method: string;
  readonly route: string;
  readonly statusCode: number;
  readonly durationMs: number;
}): void {
  const attributes = {
    http_method: input.method,
    http_route: input.route,
    status_family: `${Math.floor(input.statusCode / 100)}xx`,
  };

  httpRequestTotal.add(1, attributes);
  httpRequestDurationMs.record(input.durationMs, attributes);
}

export function classifyDiagnosticException(error: unknown): DiagnosticExceptionType {
  if (!(error instanceof Error)) {
    return 'unexpected_error';
  }

  if (
    error.constructor.name === 'AuthenticationError' ||
    error.constructor.name === 'ReservationRequestAlreadyExistsError' ||
    error.constructor.name === 'Error'
  ) {
    return error.constructor.name;
  }

  return 'unexpected_error';
}
