import type { BookingId } from './booking-id';
import type { BookingStatus } from './booking-status';

export interface Booking {
  readonly id: BookingId;
  readonly customerName: string;
  readonly status: BookingStatus;
  readonly startsAt: string;
  readonly endsAt: string;
}
