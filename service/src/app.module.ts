import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';

import { generatedGraphqlSchemaPath } from './generated-graphql-schema';
import { BookingsGraphqlModule } from './presentation/graphql/bookings-graphql.module';
import { HealthModule } from './presentation/http/health.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: generatedGraphqlSchemaPath,
      sortSchema: true,
    }),
    HealthModule,
    BookingsGraphqlModule,
  ],
})
export class AppModule {}
