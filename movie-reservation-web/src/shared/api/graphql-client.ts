import { createRequestId, type DemoTraceContext } from '../observability/trace-context';

export interface GraphqlExchange {
  readonly operationName: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly traceparent: string;
  readonly statusCode: number;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly responseCorrelationId?: string;
  readonly responseRequestId?: string;
}

export interface GraphqlRequestInput<TVariables> {
  readonly operationName: string;
  readonly query: string;
  readonly variables: TVariables;
  readonly workflow: DemoTraceContext;
  readonly onExchange?: (exchange: GraphqlExchange) => void;
}

interface GraphqlResponse<TData> {
  readonly data?: TData;
  readonly errors?: readonly { readonly message?: string }[];
}

export class GraphqlClientError extends Error {
  constructor(
    message: string,
    readonly operationName: string,
  ) {
    super(message);
    this.name = 'GraphqlClientError';
  }
}

export async function requestGraphql<TData, TVariables extends Record<string, unknown>>(
  input: GraphqlRequestInput<TVariables>,
): Promise<TData> {
  const endpoint = import.meta.env.VITE_GRAPHQL_URL || '/graphql';
  const bearerToken = import.meta.env.VITE_DEMO_BEARER_TOKEN?.trim();
  const requestId = createRequestId(input.operationName);
  const started = performance.now();
  const startedAt = new Date().toISOString();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    traceparent: input.workflow.traceparent,
    'X-Correlation-Id': input.workflow.correlationId,
    'X-Request-Id': requestId,
  };

  if (bearerToken !== undefined && bearerToken.length > 0) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: input.query,
      operationName: input.operationName,
      variables: input.variables,
    }),
  });

  input.onExchange?.({
    operationName: input.operationName,
    requestId,
    correlationId: input.workflow.correlationId,
    traceparent: input.workflow.traceparent,
    statusCode: response.status,
    startedAt,
    durationMs: performance.now() - started,
    responseCorrelationId: response.headers.get('X-Correlation-Id') ?? undefined,
    responseRequestId: response.headers.get('X-Request-Id') ?? undefined,
  });

  const responseText = await response.text();
  const payload = parseGraphqlResponse<TData>(responseText, input.operationName);

  if (!response.ok) {
    throw new GraphqlClientError(`GraphQL HTTP ${response.status}: ${response.statusText}`, input.operationName);
  }

  if (payload.errors !== undefined && payload.errors.length > 0) {
    const message = payload.errors.map((error) => error.message ?? 'Unknown GraphQL error').join('; ');
    throw new GraphqlClientError(message, input.operationName);
  }

  if (payload.data === undefined) {
    throw new GraphqlClientError('GraphQL response did not include data', input.operationName);
  }

  return payload.data;
}

function parseGraphqlResponse<TData>(responseText: string, operationName: string): GraphqlResponse<TData> {
  try {
    return JSON.parse(responseText) as GraphqlResponse<TData>;
  } catch (error) {
    throw new GraphqlClientError(
      error instanceof Error ? `Invalid JSON response: ${error.message}` : 'Invalid JSON response',
      operationName,
    );
  }
}
