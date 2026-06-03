import type { ReservationRequestId } from '../../../domain/movie-reservations/reservation-request-id';
import type { ReservationRequestSequence } from '../../../domain/movie-reservations/reservation-request-sequence';
import type { ReservationWorkObservabilityContext } from './reservation-work-observability-context-provider';

export type MovieReservationBusinessOperation =
  | 'me'
  | 'movies'
  | 'screenings'
  | 'requestReservation'
  | 'reservationRequestStatus'
  | 'reservationResult'
  | 'unknown';

export type ReservationProcessorOutcome =
  | 'no-pending-request'
  | 'confirmed'
  | 'rejected'
  | 'retryable-failure'
  | 'failed';

export interface ReservationRequestCreatedAttributes {
  readonly reservationRequestId: ReservationRequestId;
  readonly businessOperation: 'requestReservation';
}

export interface ReservationProcessorClaimedAttributes {
  readonly reservationRequestId: ReservationRequestId;
  readonly sequence: ReservationRequestSequence;
  readonly observabilityContext?: ReservationWorkObservabilityContext;
}

export interface ReservationProcessorSpanAttributes {
  readonly reservationRequestId: ReservationRequestId;
  readonly sequence: ReservationRequestSequence;
  readonly observabilityContext?: ReservationWorkObservabilityContext;
}

export interface ReservationProcessorOutcomeAttributes {
  readonly outcome: ReservationProcessorOutcome;
  readonly reservationRequestId?: ReservationRequestId;
  readonly sequence?: ReservationRequestSequence;
  readonly reason?: string;
  readonly durationMs: number;
  readonly observabilityContext?: ReservationWorkObservabilityContext;
}

export interface MovieReservationObservability {
  recordReservationRequestCreated(attributes: ReservationRequestCreatedAttributes): void;
  runWithReservationProcessorSpan<T>(
    attributes: ReservationProcessorSpanAttributes,
    operation: () => Promise<T>,
  ): Promise<T>;
  recordReservationProcessorClaimed(attributes: ReservationProcessorClaimedAttributes): void;
  recordReservationProcessorOutcome(attributes: ReservationProcessorOutcomeAttributes): void;
  recordReservationProcessorException(error: unknown): void;
}

export class NoopMovieReservationObservability implements MovieReservationObservability {
  recordReservationRequestCreated(): void {}

  async runWithReservationProcessorSpan<T>(
    _attributes: ReservationProcessorSpanAttributes,
    operation: () => Promise<T>,
  ): Promise<T> {
    return operation();
  }

  recordReservationProcessorClaimed(): void {}

  recordReservationProcessorOutcome(): void {}

  recordReservationProcessorException(): void {}
}
