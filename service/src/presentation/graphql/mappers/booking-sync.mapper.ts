import type { RequestBookingSyncCommand } from '../../../application/bookings/booking-sync.types';
import { createBookingId } from '../../../domain/bookings/booking-id';
import type { BookingSyncJob } from '../../../domain/bookings/booking-sync-job';
import type { RequestBookingSyncInput } from '../inputs/request-booking-sync.input';
import { BookingSyncJobGql } from '../models/booking-sync-job.gql';

export function toRequestBookingSyncCommand(
  input: RequestBookingSyncInput,
): RequestBookingSyncCommand {
  return {
    bookingId: createBookingId(input.bookingId),
  };
}

export function toBookingSyncJobGql(job: BookingSyncJob): BookingSyncJobGql {
  const gql = new BookingSyncJobGql();
  gql.id = job.id;
  gql.bookingId = job.bookingId;
  gql.status = job.status;
  return gql;
}
