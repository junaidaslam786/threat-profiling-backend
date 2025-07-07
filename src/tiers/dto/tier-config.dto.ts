import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';

export class TierConfigDto {
  @IsString()
  sub_level: string; // "L0", "L1", "L2", "L3", "LE"

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  max_edits: number;

  @IsNumber()
  max_apps: number;

  @IsArray()
  @IsString({ each: true })
  allowed_tabs: string[]; // ["ISM", "E8", "Detections"]

  @IsNumber()
  run_quota: number;

  @IsNumber()
  price_monthly: number;

  @IsNumber()
  price_onetime_registration: number;
}
