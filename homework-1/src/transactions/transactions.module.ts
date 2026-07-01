import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService],
  // Exported so AccountsModule can derive balances/summaries from the same store.
  exports: [TransactionsService],
})
export class TransactionsModule {}
