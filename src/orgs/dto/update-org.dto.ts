import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateOrgDto {
  @IsOptional() @IsString() sector?: string;
  @IsOptional() @IsString() websiteUrl?: string;
  @IsOptional() @IsArray() countriesOfOperation?: string[];
  @IsOptional() @IsString() homeUrl?: string;
  @IsOptional() @IsString() aboutUsUrl?: string;
  @IsOptional() @IsString() additionalDetails?: string;
}
