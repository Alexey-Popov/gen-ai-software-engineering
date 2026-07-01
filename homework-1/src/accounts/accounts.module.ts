import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { AccountsController } from './accounts.controller';

@Module({
  imports: [TransactionsModule],
  controllers: [AccountsController],
})
export class AccountsModule {}
