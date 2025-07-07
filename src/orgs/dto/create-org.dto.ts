import { IsString, IsOptional, IsArray } from 'class-validator';
export class CreateOrgDto {
  @IsString()
  orgName: string;

  @IsString()
  orgDomain: string;

  @IsOptional() @IsString() sector?: string;
  @IsOptional() @IsString() websiteUrl?: string;
  @IsOptional() @IsArray() countriesOfOperation?: string[];
  @IsOptional() @IsString() homeUrl?: string;
  @IsOptional() @IsString() aboutUsUrl?: string;
  @IsOptional() @IsString() additionalDetails?: string;
}
