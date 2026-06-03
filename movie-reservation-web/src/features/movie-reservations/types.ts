export interface AuthenticatedUser {
  readonly userId: string;
  readonly username: string;
  readonly email: string;
  readonly movieProviderId: string;
  readonly movieProviderCode?: string | null;
  readonly roles: readonly string[];
  readonly scopes: readonly string[];
}

export interface Movie {
  readonly id: string;
  readonly title: string;
  readonly rating: string;
  readonly durationMinutes: number;
}

export interface Seat {
  readonly id: string;
  readonly row: string;
  readonly number: number;
}

export interface Screening {
  readonly id: string;
  readonly movieId: string;
  readonly auditoriumId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly seats: readonly Seat[];
}

export type ReservationRequestStatus = 'REQUESTED' | 'PROCESSING' | 'CONFIRMED' | 'REJECTED' | 'FAILED';

export interface ReservationRequest {
  readonly id: string;
  readonly requestedByUserId: string;
  readonly screeningId: string;
  readonly seatIds: readonly string[];
  readonly status: ReservationRequestStatus;
}

export interface Reservation {
  readonly id: string;
  readonly reservationRequestId: string;
  readonly screeningId: string;
  readonly seatIds: readonly string[];
  readonly reservedByUserId: string;
  readonly confirmedAt: string;
}

export interface Catalog {
  readonly me: AuthenticatedUser;
  readonly movies: readonly Movie[];
  readonly screenings: readonly Screening[];
}
