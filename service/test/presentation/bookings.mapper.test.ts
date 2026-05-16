import { describe, expect, it } from 'vitest';

import { createBookingId } from '../../src/domain/bookings/booking-id';
import { BookingStatus } from '../../src/domain/bookings/booking-status';
import { createBookingSyncJobId } from '../../src/domain/bookings/booking-sync-job-id';
import { BookingSyncJobStatus } from '../../src/domain/bookings/booking-sync-job-status';
import { RequestBookingSyncInput } from '../../src/presentation/graphql/inputs/request-booking-sync.input';
import { toBookingGql } from '../../src/presentation/graphql/mappers/booking.mapper';
import {
  toBookingSyncJobGql,
  toRequestBookingSyncCommand,
} from '../../src/presentation/graphql/mappers/booking-sync.mapper';

describe('GraphQL booking mappers', () => {
  it('maps a domain booking to a GraphQL object', () => {
    const actualGql = toBookingGql({
      id: createBookingId('booking-1'),
      customerName: 'Ada Lovelace',
      status: BookingStatus.CONFIRMED,
      startsAt: '2026-06-01T09:00:00.000Z',
      endsAt: '2026-06-01T10:00:00.000Z',
    });

    expect(actualGql).toMatchObject({
      id: 'booking-1',
      customerName: 'Ada Lovelace',
      status: BookingStatus.CONFIRMED,
    });
  });

  it('maps a GraphQL sync input to an application command', () => {
    const input = new RequestBookingSyncInput();
    input.bookingId = 'booking-1';

    expect(toRequestBookingSyncCommand(input)).toEqual({
      bookingId: 'booking-1',
    });
  });

  it('maps a domain sync job to a GraphQL object', () => {
    const actualGql = toBookingSyncJobGql({
      id: createBookingSyncJobId('sync-1'),
      bookingId: createBookingId('booking-1'),
      status: BookingSyncJobStatus.REQUESTED,
    });

    expect(actualGql).toMatchObject({
      id: 'sync-1',
      bookingId: 'booking-1',
      status: BookingSyncJobStatus.REQUESTED,
    });
  });
});
