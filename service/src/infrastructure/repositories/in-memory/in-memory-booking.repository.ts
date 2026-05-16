import type { BookingRepository } from '../../../application/bookings/ports/booking-repository';
import type { Booking } from '../../../domain/bookings/booking';
import {
  type BookingId,
  createBookingId,
} from '../../../domain/bookings/booking-id';
import { BookingStatus } from '../../../domain/bookings/booking-status';
import type { BookingSyncJob } from '../../../domain/bookings/booking-sync-job';
import type { BookingSyncJobId } from '../../../domain/bookings/booking-sync-job-id';

export class InMemoryBookingRepository implements BookingRepository {
  private readonly bookings = new Map<BookingId, Booking>();
  private readonly syncJobs = new Map<BookingSyncJobId, BookingSyncJob>();

  constructor(seedBookings: readonly Booking[] = []) {
    for (const booking of seedBookings) {
      this.bookings.set(booking.id, booking);
    }
  }

  static withSeedData(): InMemoryBookingRepository {
    return new InMemoryBookingRepository([
      {
        id: createBookingId('booking-1'),
        customerName: 'Ada Lovelace',
        status: BookingStatus.CONFIRMED,
        startsAt: '2026-06-01T09:00:00.000Z',
        endsAt: '2026-06-01T10:00:00.000Z',
      },
      {
        id: createBookingId('booking-2'),
        customerName: 'Grace Hopper',
        status: BookingStatus.REQUESTED,
        startsAt: '2026-06-02T13:00:00.000Z',
        endsAt: '2026-06-02T14:00:00.000Z',
      },
    ]);
  }

  async findById(id: BookingId): Promise<Booking | null> {
    return this.bookings.get(id) ?? null;
  }

  async findAll(): Promise<readonly Booking[]> {
    return Array.from(this.bookings.values());
  }

  async saveSyncJob(job: BookingSyncJob): Promise<BookingSyncJob> {
    this.syncJobs.set(job.id, job);
    return job;
  }
}
