import { randomUUID } from 'node:crypto';

import type { Booking } from '../../domain/bookings/booking';
import type { BookingId } from '../../domain/bookings/booking-id';
import type { BookingSyncJob } from '../../domain/bookings/booking-sync-job';
import { createBookingSyncJobId } from '../../domain/bookings/booking-sync-job-id';
import { BookingSyncJobStatus } from '../../domain/bookings/booking-sync-job-status';
import type { RequestBookingSyncCommand } from './booking-sync.types';
import { BookingNotFoundError } from './errors/booking-not-found-error';
import type { BookingRepository } from './ports/booking-repository';

export class BookingsService {
  constructor(private readonly bookingRepository: BookingRepository) {}

  async getBooking(id: BookingId): Promise<Booking | null> {
    // TODO: Revisit this when splitting business use cases. Query use cases may
    //  intentionally expose "missing" as null, while command use cases may map
    //  the same repository result to a domain/application error.
    return this.bookingRepository.findById(id);
  }

  async listBookings(): Promise<readonly Booking[]> {
    return this.bookingRepository.findAll();
  }

  async requestBookingSync(
    input: RequestBookingSyncCommand,
  ): Promise<BookingSyncJob> {
    // TODO: Extract this command into a dedicated use case once booking sync
    //  grows real business behavior, validation, or side effects.
    const booking = await this.bookingRepository.findById(input.bookingId);

    if (booking === null) {
      throw new BookingNotFoundError(input.bookingId);
    }

    const job: BookingSyncJob = {
      id: createBookingSyncJobId(`sync-${randomUUID()}`),
      bookingId: input.bookingId,
      status: BookingSyncJobStatus.REQUESTED,
    };

    return this.bookingRepository.saveSyncJob(job);
  }
}
