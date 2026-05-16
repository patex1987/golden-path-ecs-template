import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app';

describe('booking GraphQL operations', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns fake booking data', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `{
          bookings {
            id
            customerName
            status
            startsAt
            endsAt
          }
        }`,
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.bookings).toHaveLength(2);
    expect(response.body.data.bookings[0]).toMatchObject({
      id: 'booking-1',
      customerName: 'Ada Lovelace',
      status: 'CONFIRMED',
    });
  });

  it('returns one booking by id', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `query Booking($id: ID!) {
          booking(id: $id) {
            id
            customerName
          }
        }`,
        variables: { id: 'booking-1' },
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.booking).toEqual({
      id: 'booking-1',
      customerName: 'Ada Lovelace',
    });
  });

  it('returns null when a booking id is missing', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `query Booking($id: ID!) {
          booking(id: $id) {
            id
          }
        }`,
        variables: { id: 'missing' },
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.booking).toBeNull();
  });

  it('requests a booking sync job', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `mutation RequestBookingSync($input: RequestBookingSyncInput!) {
          requestBookingSync(input: $input) {
            id
            bookingId
            status
          }
        }`,
        variables: { input: { bookingId: 'booking-1' } },
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.requestBookingSync).toMatchObject({
      bookingId: 'booking-1',
      status: 'REQUESTED',
    });
    expect(response.body.data.requestBookingSync.id).toMatch(
      /^sync-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('rejects a sync request for a missing booking', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `mutation RequestBookingSync($input: RequestBookingSyncInput!) {
          requestBookingSync(input: $input) {
            id
          }
        }`,
        variables: { input: { bookingId: 'missing' } },
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toBeNull();
    expect(response.body.errors[0].message).toBe('Booking missing was not found');
  });
});
