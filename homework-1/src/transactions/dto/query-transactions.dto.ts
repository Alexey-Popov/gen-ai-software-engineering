import { IsEnum, IsIn, IsISO8601, IsOptional, Matches } from 'class-validator';
import { TransactionType } from '../entities/transaction.entity';
import { ACCOUNT_REGEX } from './create-transaction.dto';

/** Filters for GET /transactions (Task 3). All optional and combinable. */
export class QueryTransactionsDto {
  @IsOptional()
  @Matches(ACCOUNT_REGEX, {
    message: 'accountId must follow the format ACC-XXXXX (alphanumeric)',
  })
  accountId?: string;

  @IsOptional()
  @IsEnum(TransactionType, {
    message: 'type must be one of: deposit, withdrawal, transfer',
  })
  type?: TransactionType;

  // Accept full ISO 8601 or plain YYYY-MM-DD dates for the range bounds.
  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'from must be an ISO 8601 date (e.g. 2024-01-01)' })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'to must be an ISO 8601 date (e.g. 2024-01-31)' })
  to?: string;

  // Used only by GET /transactions/export to pick the output format.
  @IsOptional()
  @IsIn(['csv', 'json'], { message: 'format must be either csv or json' })
  format?: 'csv' | 'json';
}
