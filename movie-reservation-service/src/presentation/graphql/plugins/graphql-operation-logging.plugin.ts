import type { ApolloServerPlugin } from '@apollo/server';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { Kind, type GraphQLError, type OperationDefinitionNode, type OperationTypeNode } from 'graphql';

import type { MovieReservationBusinessOperation } from '../../../application/movie-reservations/ports/movie-reservation-observability';
import {
  applicationLogger,
  type ApplicationLogger,
  type LogFields,
} from '../../../infrastructure/observability/application-logger';
import {
  classifyDiagnosticException,
  recordGraphqlException,
  recordGraphqlOperation,
  type GraphqlOperationOutcome,
} from '../../../infrastructure/observability/metrics';
import type { MovieReservationGraphqlContext } from '../graphql-context';

export type GraphqlOperationLogger = ApplicationLogger;

interface GraphqlOperationLogMetadata {
  readonly operationName: string;
  readonly operationType: OperationTypeNode | 'unknown';
  readonly businessOperation: MovieReservationBusinessOperation;
  readonly movieProviderCode: string;
  readonly userId: string;
}

interface GraphqlOperationLogRequestState {
  readonly startedAt: bigint;
  readonly span: ReturnType<ReturnType<typeof trace.getTracer>['startSpan']>;
  metadata: GraphqlOperationLogMetadata;
  operationStartLogged: boolean;
  terminalLogWritten: boolean;
}

interface GraphqlOperationResponse {
  readonly body: {
    readonly kind: string;
    readonly singleResult?: {
      readonly errors?: readonly unknown[];
    };
  };
}

const anonymousOperationName = 'anonymous';
const tracer = trace.getTracer('movie-reservation-service.graphql');

/**
 * Apollo plugin for structured GraphQL operation observability.
 *
 * Apollo gives us operation lifecycle callbacks after HTTP middleware and
 * authentication have run. That makes this boundary the right place for
 * GraphQL-specific facts such as operation name, operation type, top-level
 * business operation, duration, and GraphQL errors.
 */
export function createGraphqlOperationLoggingPlugin(
  logger: GraphqlOperationLogger = applicationLogger,
): ApolloServerPlugin<MovieReservationGraphqlContext> {
  return {
    async requestDidStart(requestContext) {
      const state = createRequestLogState(requestContext.contextValue);

      return {
        async didResolveOperation(resolvedOperationContext) {
          const businessOperation = resolveBusinessOperation(resolvedOperationContext.operation);

          state.metadata = {
            ...state.metadata,
            operationName: resolvedOperationContext.operationName ?? anonymousOperationName,
            operationType: resolvedOperationContext.operation?.operation ?? 'unknown',
            businessOperation,
          };
          annotateSpan(state);
          ensureOperationStartLogged(logger, state);
        },

        async didEncounterErrors(errorContext) {
          logOperationFailure(logger, state, errorContext.errors);
        },

        async willSendResponse(responseContext) {
          if (state.terminalLogWritten) {
            return;
          }

          if (readResponseErrors(responseContext.response).length > 0) {
            logOperationFailure(logger, state, []);
            return;
          }

          logOperationFinish(logger, state);
        },
      };
    },

    async contextCreationDidFail({ error }) {
      logger.error(
        'graphql.context.failure',
        { error_type: error.constructor.name, error_message: error.message },
        error,
      );
      recordGraphqlOperation({
        businessOperation: 'unknown',
        operationType: 'unknown',
        outcome: 'auth_error',
        durationMs: 0,
      });
    },

    async unexpectedErrorProcessingRequest({ error }) {
      logger.error(
        'graphql.operation.unexpected_error',
        { error_type: error.constructor.name, error_message: error.message },
        error,
      );
      recordGraphqlOperation({
        businessOperation: 'unknown',
        operationType: 'unknown',
        outcome: 'unexpected_error',
        durationMs: 0,
      });
    },
  };
}

function createRequestLogState(context: MovieReservationGraphqlContext): GraphqlOperationLogRequestState {
  return {
    startedAt: process.hrtime.bigint(),
    span: tracer.startSpan('graphql.operation'),
    metadata: createInitialMetadata(context),
    operationStartLogged: false,
    terminalLogWritten: false,
  };
}

function logOperationFailure(
  logger: GraphqlOperationLogger,
  state: GraphqlOperationLogRequestState,
  errors: readonly GraphQLError[],
): void {
  ensureOperationStartLogged(logger, state);
  const durationMs = calculateDurationMs(state.startedAt);
  const outcome = classifyGraphqlOutcome(errors);
  const errorTypes = errors.map((error) => getGraphqlErrorType(error));
  const errorMessages = errors.map((error) => error.message);

  state.terminalLogWritten = true;
  state.span.setStatus({
    code: SpanStatusCode.ERROR,
    message: errorMessages.join(' | ') || outcome,
  });
  state.span.setAttribute('graphql.error.count', errors.length);
  state.span.end();

  logger.error(
    'graphql.operation.failure',
    createOperationLogFields(state, {
      duration_ms: durationMs,
      outcome,
      error_count: errors.length,
      error_types: errorTypes,
      error_messages: errorMessages,
    }),
    errors[0]?.originalError ?? errors[0],
  );
  recordGraphqlOperation({
    businessOperation: state.metadata.businessOperation,
    operationType: state.metadata.operationType,
    outcome,
    durationMs,
  });

  for (const error of errors) {
    recordGraphqlException({
      businessOperation: state.metadata.businessOperation,
      exceptionType: classifyDiagnosticException(error.originalError ?? error),
    });
  }
}

function logOperationFinish(logger: GraphqlOperationLogger, state: GraphqlOperationLogRequestState): void {
  ensureOperationStartLogged(logger, state);
  const durationMs = calculateDurationMs(state.startedAt);

  state.terminalLogWritten = true;
  state.span.setStatus({ code: SpanStatusCode.OK });
  state.span.end();

  logger.info(
    'graphql.operation.finish',
    createOperationLogFields(state, {
      duration_ms: durationMs,
      outcome: 'success',
    }),
  );
  recordGraphqlOperation({
    businessOperation: state.metadata.businessOperation,
    operationType: state.metadata.operationType,
    outcome: 'success',
    durationMs,
  });
}

function ensureOperationStartLogged(logger: GraphqlOperationLogger, state: GraphqlOperationLogRequestState): void {
  if (state.operationStartLogged) {
    return;
  }

  state.operationStartLogged = true;
  logger.info('graphql.operation.start', createOperationLogFields(state));
}

function createInitialMetadata(context: MovieReservationGraphqlContext): GraphqlOperationLogMetadata {
  return {
    operationName: anonymousOperationName,
    operationType: 'unknown',
    businessOperation: 'unknown',
    movieProviderCode: context.authenticatedUser.movieProviderCode ?? 'unknown',
    userId: context.actor.userId,
  };
}

function createOperationLogFields(state: GraphqlOperationLogRequestState, fields: LogFields = {}): LogFields {
  return {
    graphql_operation_name: sanitizeLogToken(state.metadata.operationName),
    graphql_operation_type: sanitizeLogToken(state.metadata.operationType),
    business_operation: state.metadata.businessOperation,
    movie_provider_code: sanitizeLogToken(state.metadata.movieProviderCode),
    user_id: sanitizeLogToken(state.metadata.userId),
    ...fields,
  };
}

function annotateSpan(state: GraphqlOperationLogRequestState): void {
  state.span.setAttribute('graphql.operation.name', state.metadata.operationName);
  state.span.setAttribute('graphql.operation.type', state.metadata.operationType);
  state.span.setAttribute('business.operation', state.metadata.businessOperation);
  state.span.setAttribute('movie.provider.code', state.metadata.movieProviderCode);
  state.span.setAttribute('enduser.id', state.metadata.userId);
}

function resolveBusinessOperation(operation: OperationDefinitionNode | undefined): MovieReservationBusinessOperation {
  const knownOperations = new Set<MovieReservationBusinessOperation>([
    'me',
    'movies',
    'screenings',
    'requestReservation',
    'reservationRequestStatus',
    'reservationResult',
  ]);
  const fieldNames = operation?.selectionSet.selections.flatMap((selection) =>
    selection.kind === Kind.FIELD ? [selection.name.value] : [],
  );
  const firstFieldName = fieldNames?.[0];

  if (firstFieldName !== undefined && knownOperations.has(firstFieldName as MovieReservationBusinessOperation)) {
    return firstFieldName as MovieReservationBusinessOperation;
  }

  return 'unknown';
}

function classifyGraphqlOutcome(errors: readonly GraphQLError[]): GraphqlOperationOutcome {
  if (errors.some((error) => getGraphqlErrorType(error) === 'AuthenticationError')) {
    return 'auth_error';
  }

  return errors.length === 0 ? 'graphql_error' : 'graphql_error';
}

function calculateDurationMs(startedAt: bigint): number {
  const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
  return Number(elapsedNanoseconds) / 1_000_000;
}

function readResponseErrors(response: GraphqlOperationResponse): readonly unknown[] {
  if (response.body.kind !== 'single') {
    return [];
  }

  return response.body.singleResult?.errors ?? [];
}

function getGraphqlErrorType(error: GraphQLError): string {
  return error.originalError?.constructor.name ?? error.constructor.name;
}

function sanitizeLogToken(value: string): string {
  return value.replaceAll('"', "'").replaceAll('\n', ' ').replaceAll(/\s/g, '_').replaceAll('=', ':');
}
