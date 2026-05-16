import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { generatedGraphqlSchemaPath } from '../src/generated-graphql-schema';

describe('generated GraphQL schema', () => {
  it('contains the first booking API contract', () => {
    const schema = readFileSync(generatedGraphqlSchemaPath, 'utf8');

    expect(schema).toContain('type Query');
    expect(schema).toContain('booking(id: ID!): Booking');
    expect(schema).toContain('bookings: [Booking!]!');
    expect(schema).toContain(
      'requestBookingSync(input: RequestBookingSyncInput!): BookingSyncJob!',
    );
  });
});
