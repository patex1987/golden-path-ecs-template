import type { Booking } from '../../../domain/bookings/booking';
import type { BookingId } from '../../../domain/bookings/booking-id';
import type { BookingSyncJob } from '../../../domain/bookings/booking-sync-job';

export interface BookingRepository {
  // TODO: Decide whether "record not found" belongs in the repository contract
  //  as null, or whether repositories should raise an infrastructure/application
  //  error that use cases translate into their own response semantics.
  findById(id: BookingId): Promise<Booking | null>;
  findAll(): Promise<readonly Booking[]>;
  saveSyncJob(job: BookingSyncJob): Promise<BookingSyncJob>;
}
