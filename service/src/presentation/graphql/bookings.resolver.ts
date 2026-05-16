import { Inject } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

// biome-ignore lint/style/useImportType: Nest decorator metadata needs this class at runtime.
import { BookingsService } from '../../application/bookings/bookings.service';
import { createBookingId } from '../../domain/bookings/booking-id';
// biome-ignore lint/style/useImportType: GraphQL parameter metadata needs this class at runtime.
import { RequestBookingSyncInput } from './inputs/request-booking-sync.input';
import { toBookingGql } from './mappers/booking.mapper';
import {
  toBookingSyncJobGql,
  toRequestBookingSyncCommand,
} from './mappers/booking-sync.mapper';
import { BookingGql } from './models/booking.gql';
import { BookingSyncJobGql } from './models/booking-sync-job.gql';

@Resolver(() => BookingGql)
export class BookingsResolver {
  constructor(
    @Inject(BookingsService) private readonly bookingsService: BookingsService,
  ) {}

  /**
   * Returns null when the booking id is well-formed but no booking exists.
   */
  @Reflect.metadata('design:paramtypes', [String])
  @Query(() => BookingGql, { nullable: true })
  async booking(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<BookingGql | null> {
    const bookingId = createBookingId(id);
    const booking = await this.bookingsService.getBooking(bookingId);
    return booking === null ? null : toBookingGql(booking);
  }

  @Query(() => [BookingGql])
  async bookings(): Promise<BookingGql[]> {
    const bookings = await this.bookingsService.listBookings();
    return bookings.map(toBookingGql);
  }

  @Reflect.metadata('design:paramtypes', [RequestBookingSyncInput])
  @Mutation(() => BookingSyncJobGql)
  async requestBookingSync(
    @Args('input', { type: () => RequestBookingSyncInput })
    input: RequestBookingSyncInput,
  ): Promise<BookingSyncJobGql> {
    const job = await this.bookingsService.requestBookingSync(
      toRequestBookingSyncCommand(input),
    );

    return toBookingSyncJobGql(job);
  }
}
