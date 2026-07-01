import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccountsModule } from './accounts/accounts.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    // Task 4D — rate limiting: max 100 requests per minute per IP.
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // 1 minute (ms)
        limit: 100,
      },
    ]),
    TransactionsModule,
    AccountsModule,
  ],
  providers: [
    // Apply the throttler globally; exceeding the limit returns 429.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
