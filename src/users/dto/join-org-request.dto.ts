import { IsOptional, IsString } from 'class-validator';

export class JoinOrgRequestDto {
  @IsString()
  orgDomain: string;

  @IsString()
  @IsOptional()
  message?: string;
}
