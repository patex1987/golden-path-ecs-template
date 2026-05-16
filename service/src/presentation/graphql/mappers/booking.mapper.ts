import type { Booking } from '../../../domain/bookings/booking';
import { BookingGql } from '../models/booking.gql';

export function toBookingGql(booking: Booking): BookingGql {
  const gql = new BookingGql();
  gql.id = booking.id;
  gql.customerName = booking.customerName;
  gql.status = booking.status;
  gql.startsAt = booking.startsAt;
  gql.endsAt = booking.endsAt;
  return gql;
}
