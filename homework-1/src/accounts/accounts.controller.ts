import { Controller, Get, Param, Query } from '@nestjs/common';
import { TransactionsService } from '../transactions/transactions.service';
import { InterestQueryDto } from './dto/interest-query.dto';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get(':accountId/balance')
  getBalance(@Param('accountId') accountId: string) {
    return {
      accountId,
      balance: this.transactionsService.getBalance(accountId),
    };
  }

  // Task 4A — aggregated account activity.
  @Get(':accountId/summary')
  getSummary(@Param('accountId') accountId: string) {
    return this.transactionsService.getSummary(accountId);
  }

  // Task 4B — simple interest on the current balance.
  @Get(':accountId/interest')
  getInterest(@Param('accountId') accountId: string, @Query() query: InterestQueryDto) {
    return this.transactionsService.calculateInterest(accountId, query.rate, query.days);
  }
}
