import {
  IsEnum,
  IsISO4217CurrencyCode,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';
import { TransactionStatus, TransactionType } from '../entities/transaction.entity';

/** Account numbers must follow the format ACC-XXXXX where X is alphanumeric. */
export const ACCOUNT_REGEX = /^ACC-[A-Za-z0-9]+$/;

export class CreateTransactionDto {
  // Source account is required for withdrawals and transfers (money leaves it),
  // and optional for deposits (funds come from an external source).
  @ValidateIf((o) => o.type !== TransactionType.DEPOSIT || o.fromAccount != null)
  @IsString()
  @Matches(ACCOUNT_REGEX, {
    message: 'fromAccount must follow the format ACC-XXXXX (alphanumeric)',
  })
  fromAccount?: string;

  // Destination account is required for deposits and transfers (money arrives),
  // and optional for withdrawals (funds go to an external destination).
  @ValidateIf((o) => o.type !== TransactionType.WITHDRAWAL || o.toAccount != null)
  @IsString()
  @Matches(ACCOUNT_REGEX, {
    message: 'toAccount must follow the format ACC-XXXXX (alphanumeric)',
  })
  toAccount?: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'amount must be a number with at most 2 decimal places' },
  )
  @IsPositive({ message: 'amount must be a positive number' })
  amount: number;

  @IsISO4217CurrencyCode({ message: 'currency must be a valid ISO 4217 code (e.g. USD, EUR, GBP)' })
  currency: string;

  @IsEnum(TransactionType, {
    message: 'type must be one of: deposit, withdrawal, transfer',
  })
  type: TransactionType;

  // Optional on input; defaults to "completed" so balances reflect the transaction.
  @IsOptional()
  @IsEnum(TransactionStatus, {
    message: 'status must be one of: pending, completed, failed',
  })
  status?: TransactionStatus;
}
