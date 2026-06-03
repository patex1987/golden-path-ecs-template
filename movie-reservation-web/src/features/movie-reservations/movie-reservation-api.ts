import { requestGraphql, type GraphqlExchange } from '../../shared/api/graphql-client';
import type { DemoTraceContext } from '../../shared/observability/trace-context';
import type { Catalog, Reservation, ReservationRequest } from './types';

const catalogQuery = `
query ReservationUiCatalog {
  me {
    userId
    username
    email
    movieProviderId
    movieProviderCode
    roles
    scopes
  }
  movies {
    id
    title
    rating
    durationMinutes
  }
  screenings {
    id
    movieId
    auditoriumId
    startsAt
    endsAt
    seats {
      id
      row
      number
    }
  }
}`;

const requestReservationMutation = `
mutation ReservationUiRequestReservation($input: RequestReservationInput!) {
  requestReservation(input: $input) {
    id
    status
    screeningId
    seatIds
    requestedByUserId
  }
}`;

const reservationStatusQuery = `
query ReservationUiReservationStatus($id: ID!) {
  reservationRequestStatus(id: $id) {
    id
    status
    screeningId
    seatIds
    requestedByUserId
  }
}`;

const reservationResultQuery = `
query ReservationUiReservationResult($requestId: ID!) {
  reservationResult(requestId: $requestId) {
    id
    reservationRequestId
    screeningId
    seatIds
    reservedByUserId
    confirmedAt
  }
}`;

interface ApiCallInput {
  readonly workflow: DemoTraceContext;
  readonly onExchange: (exchange: GraphqlExchange) => void;
}

export function fetchCatalog(input: ApiCallInput): Promise<Catalog> {
  return requestGraphql<Catalog, Record<string, never>>({
    operationName: 'ReservationUiCatalog',
    query: catalogQuery,
    variables: {},
    workflow: input.workflow,
    onExchange: input.onExchange,
  });
}

export function requestReservation(input: ApiCallInput & { readonly screeningId: string; readonly seatIds: readonly string[] }) {
  return requestGraphql<{ readonly requestReservation: ReservationRequest }, { readonly input: Record<string, unknown> }>({
    operationName: 'ReservationUiRequestReservation',
    query: requestReservationMutation,
    variables: {
      input: {
        screeningId: input.screeningId,
        seatIds: input.seatIds,
      },
    },
    workflow: input.workflow,
    onExchange: input.onExchange,
  }).then((response) => response.requestReservation);
}

export function fetchReservationStatus(input: ApiCallInput & { readonly requestId: string }) {
  return requestGraphql<
    { readonly reservationRequestStatus: ReservationRequest | null },
    { readonly id: string }
  >({
    operationName: 'ReservationUiReservationStatus',
    query: reservationStatusQuery,
    variables: {
      id: input.requestId,
    },
    workflow: input.workflow,
    onExchange: input.onExchange,
  }).then((response) => response.reservationRequestStatus);
}

export function fetchReservationResult(input: ApiCallInput & { readonly requestId: string }) {
  return requestGraphql<{ readonly reservationResult: Reservation | null }, { readonly requestId: string }>({
    operationName: 'ReservationUiReservationResult',
    query: reservationResultQuery,
    variables: {
      requestId: input.requestId,
    },
    workflow: input.workflow,
    onExchange: input.onExchange,
  }).then((response) => response.reservationResult);
}
