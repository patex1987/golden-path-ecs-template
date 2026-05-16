import { describe, expect, it } from 'vitest';

import { createBookingId } from '../../src/domain/bookings/booking-id';
import { createBookingSyncJobId } from '../../src/domain/bookings/booking-sync-job-id';
import { BookingSyncJobStatus } from '../../src/domain/bookings/booking-sync-job-status';
import { InMemoryBookingRepository } from '../../src/infrastructure/repositories/in-memory/in-memory-booking.repository';

describe('InMemoryBookingRepository', () => {
  it('lists seeded bookings', async () => {
    const repository = InMemoryBookingRepository.withSeedData();

    const actualBookings = await repository.findAll();

    expect(actualBookings).toHaveLength(2);
    expect(actualBookings[0]).toMatchObject({
      id: 'booking-1',
      customerName: 'Ada Lovelace',
    });
  });

  it('finds an existing booking', async () => {
    const repository = InMemoryBookingRepository.withSeedData();

    await expect(
      repository.findById(createBookingId('booking-1')),
    ).resolves.toMatchObject({
      id: 'booking-1',
    });
  });

  it('returns null for a missing booking', async () => {
    const repository = InMemoryBookingRepository.withSeedData();

    await expect(repository.findById(createBookingId('missing'))).resolves.toBe(
      null,
    );
  });

  it('saves and returns a sync job', async () => {
    const repository = InMemoryBookingRepository.withSeedData();
    const job = {
      id: createBookingSyncJobId('sync-1'),
      bookingId: createBookingId('booking-1'),
      status: BookingSyncJobStatus.REQUESTED,
    };

    await expect(repository.saveSyncJob(job)).resolves.toEqual(job);
  });
});
