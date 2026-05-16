import { describe, expect, it } from 'vitest';

import { createBookingId } from '../../src/domain/bookings/booking-id';
import { createBookingSyncJobId } from '../../src/domain/bookings/booking-sync-job-id';

describe('booking domain ids', () => {
  it('creates a booking id from a non-empty string', () => {
    expect(createBookingId('booking-1')).toBe('booking-1');
  });

  it('rejects an empty booking id', () => {
    expect(() => createBookingId('   ')).toThrow('BookingId cannot be empty');
  });

  it('creates a booking sync job id from a non-empty string', () => {
    expect(createBookingSyncJobId('sync-1')).toBe('sync-1');
  });

  it('rejects an empty booking sync job id', () => {
    expect(() => createBookingSyncJobId('')).toThrow(
      'BookingSyncJobId cannot be empty',
    );
  });
});
