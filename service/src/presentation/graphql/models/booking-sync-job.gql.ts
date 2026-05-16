import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

import { BookingSyncJobStatus } from '../../../domain/bookings/booking-sync-job-status';

registerEnumType(BookingSyncJobStatus, {
  name: 'BookingSyncJobStatus',
});

@ObjectType('BookingSyncJob')
export class BookingSyncJobGql {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  bookingId!: string;

  @Field(() => BookingSyncJobStatus)
  status!: BookingSyncJobStatus;
}
