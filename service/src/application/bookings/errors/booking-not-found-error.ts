import type { BookingId } from '../../../domain/bookings/booking-id';

export class BookingNotFoundError extends Error {
  constructor(bookingId: BookingId) {
    super(`Booking ${bookingId} was not found`);
    this.name = 'BookingNotFoundError';
  }
}
