import { describe, expect, it } from 'vitest';

import { BookingsService } from '../../src/application/bookings/bookings.service';
import { BookingNotFoundError } from '../../src/application/bookings/errors/booking-not-found-error';
import type { BookingRepository } from '../../src/application/bookings/ports/booking-repository';
import type { Booking } from '../../src/domain/bookings/booking';
import { createBookingId } from '../../src/domain/bookings/booking-id';
import { BookingStatus } from '../../src/domain/bookings/booking-status';
import { BookingSyncJobStatus } from '../../src/domain/bookings/booking-sync-job-status';

const existingBooking: Booking = {
  id: createBookingId('booking-1'),
  customerName: 'Ada Lovelace',
  status: BookingStatus.CONFIRMED,
  startsAt: '2026-06-01T09:00:00.000Z',
  endsAt: '2026-06-01T10:00:00.000Z',
};

function createFakeRepository(): BookingRepository {
  return {
    async findById(id) {
      return id === existingBooking.id ? existingBooking : null;
    },
    async findAll() {
      return [existingBooking];
    },
    async saveSyncJob(job) {
      return job;
    },
  };
}

describe('BookingsService', () => {
  it('lists bookings from the repository port', async () => {
    const repository = createFakeRepository();
    const service = new BookingsService(repository);

    await expect(service.listBookings()).resolves.toEqual([existingBooking]);
  });

  it('returns an existing booking', async () => {
    const service = new BookingsService(createFakeRepository());

    await expect(service.getBooking(existingBooking.id)).resolves.toEqual(
      existingBooking,
    );
  });

  it('returns null for a missing booking', async () => {
    const service = new BookingsService(createFakeRepository());

    await expect(service.getBooking(createBookingId('missing'))).resolves.toBe(
      null,
    );
  });

  it('creates a requested sync job', async () => {
    const service = new BookingsService(createFakeRepository());

    const actualJob = await service.requestBookingSync({
      bookingId: existingBooking.id,
    });

    expect(actualJob).toMatchObject({
      bookingId: existingBooking.id,
      status: BookingSyncJobStatus.REQUESTED,
    });
    expect(actualJob.id).toMatch(
      /^sync-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('rejects a sync request for a missing booking', async () => {
    const service = new BookingsService(createFakeRepository());

    await expect(
      service.requestBookingSync({ bookingId: createBookingId('missing') }),
    ).rejects.toBeInstanceOf(BookingNotFoundError);
  });
});
