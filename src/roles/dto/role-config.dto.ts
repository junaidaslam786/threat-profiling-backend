import { IsString, IsArray, IsOptional } from 'class-validator';

export class RoleConfigDto {
  @IsString()
  role_id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
