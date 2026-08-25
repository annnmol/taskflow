import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateFileDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\.csv$/i, {
    message: 'Only CSV files are supported.',
  })
  name!: string;

  @IsString()
  contentType = 'text/csv';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  size!: number;
}
