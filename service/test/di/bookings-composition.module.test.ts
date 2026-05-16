import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { BookingsService } from '../../src/application/bookings/bookings.service';
import type { BookingRepository } from '../../src/application/bookings/ports/booking-repository';
import { BOOKING_REPOSITORY } from '../../src/di/bookings/booking.tokens';
import { BookingsCompositionModule } from '../../src/di/bookings/bookings-composition.module';

describe('BookingsCompositionModule', () => {
  it('resolves the application service and repository token', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [BookingsCompositionModule],
    }).compile();

    const service = moduleRef.get(BookingsService);
    const repository = moduleRef.get<BookingRepository>(BOOKING_REPOSITORY);

    expect(service).toBeInstanceOf(BookingsService);
    await expect(repository.findAll()).resolves.toHaveLength(2);
  });
});
