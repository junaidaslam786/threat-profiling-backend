import { IsString } from 'class-validator';

export class ApproveJoinDto {
  @IsString()
  role: 'admin' | 'viewer' | 'runner';
}
