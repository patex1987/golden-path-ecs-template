import type { BookingId } from '../../domain/bookings/booking-id';

export interface RequestBookingSyncCommand {
  readonly bookingId: BookingId;
}
