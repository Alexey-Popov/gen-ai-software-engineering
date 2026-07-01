import { Type } from 'class-transformer';
import { IsNumber, IsPositive, Max } from 'class-validator';

/** Query params for GET /accounts/:accountId/interest (Task 4B). */
export class InterestQueryDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'rate must be a number (e.g. 0.05 for 5%)' })
  @IsPositive({ message: 'rate must be a positive number' })
  @Max(1, { message: 'rate must be a decimal fraction between 0 and 1 (e.g. 0.05)' })
  rate: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'days must be a number' })
  @IsPositive({ message: 'days must be a positive number' })
  days: number;
}
