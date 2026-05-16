declare const bookingSyncJobIdBrand: unique symbol;

export type BookingSyncJobId = string & {
  readonly [bookingSyncJobIdBrand]: 'BookingSyncJobId';
};

export function createBookingSyncJobId(value: string): BookingSyncJobId {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new Error('BookingSyncJobId cannot be empty');
  }

  return trimmedValue as BookingSyncJobId;
}
