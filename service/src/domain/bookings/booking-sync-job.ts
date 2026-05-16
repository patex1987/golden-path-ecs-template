import type { BookingId } from './booking-id';
import type { BookingSyncJobId } from './booking-sync-job-id';
import type { BookingSyncJobStatus } from './booking-sync-job-status';

export interface BookingSyncJob {
  readonly id: BookingSyncJobId;
  readonly bookingId: BookingId;
  readonly status: BookingSyncJobStatus;
}
