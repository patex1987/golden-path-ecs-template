import { Module } from '@nestjs/common';

import { BookingsService } from '../../application/bookings/bookings.service';
import type { BookingRepository } from '../../application/bookings/ports/booking-repository';
import { InMemoryBookingRepository } from '../../infrastructure/repositories/in-memory/in-memory-booking.repository';
import { BOOKING_REPOSITORY } from './booking.tokens';

@Module({
  providers: [
    {
      provide: BOOKING_REPOSITORY,
      useFactory: (): BookingRepository =>
        InMemoryBookingRepository.withSeedData(),
    },
    {
      provide: BookingsService,
      useFactory: (repository: BookingRepository): BookingsService =>
        new BookingsService(repository),
      inject: [BOOKING_REPOSITORY],
    },
  ],
  exports: [BOOKING_REPOSITORY, BookingsService],
})
export class BookingsCompositionModule {}
