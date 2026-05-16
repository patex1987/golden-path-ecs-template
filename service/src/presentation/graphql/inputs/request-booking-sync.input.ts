import { Field, ID, InputType } from '@nestjs/graphql';

@InputType('RequestBookingSyncInput')
export class RequestBookingSyncInput {
  @Field(() => ID)
  bookingId!: string;
}
