import { Module } from '@nestjs/common';

import { BookingsCompositionModule } from '../../di/bookings/bookings-composition.module';
import { BookingsResolver } from './bookings.resolver';

@Module({
  imports: [BookingsCompositionModule],
  providers: [BookingsResolver],
})
export class BookingsGraphqlModule {}
