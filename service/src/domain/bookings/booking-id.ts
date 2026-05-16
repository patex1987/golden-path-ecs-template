declare const bookingIdBrand: unique symbol;

export type BookingId = string & {
  readonly [bookingIdBrand]: 'BookingId';
};

export function createBookingId(value: string): BookingId {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new Error('BookingId cannot be empty');
  }

  return trimmedValue as BookingId;
}
