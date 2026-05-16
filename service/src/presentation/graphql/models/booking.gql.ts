import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

import { BookingStatus } from '../../../domain/bookings/booking-status';

registerEnumType(BookingStatus, {
  name: 'BookingStatus',
});

/**
 * GraphQL representation of a booking returned by the API.
 *
 * This GraphQL object belongs to the presentation layer. The resolver returns it after
 * mapping from the domain `Booking`, keeping GraphQL-specific decorators out of
 * the domain model.
 */
@ObjectType('Booking')
export class BookingGql {
  /** Stable booking identifier exposed as the GraphQL `ID` scalar. */
  @Field(() => ID, {
    description: 'Stable booking identifier exposed as the GraphQL ID scalar.',
  })
  id!: string;

  /** Human-readable customer name associated with this booking. */
  @Field(() => String, {
    description: 'Human-readable customer name associated with this booking.',
  })
  customerName!: string;

  /** Current lifecycle state of the booking. */
  @Field(() => BookingStatus, {
    description: 'Current lifecycle state of the booking.',
  })
  status!: BookingStatus;

  /** ISO-8601 timestamp for when the booking starts. */
  @Field(() => String, {
    description: 'ISO-8601 timestamp for when the booking starts.',
  })
  startsAt!: string;

  /** ISO-8601 timestamp for when the booking ends. */
  @Field(() => String, {
    description: 'ISO-8601 timestamp for when the booking ends.',
  })
  endsAt!: string;
}
