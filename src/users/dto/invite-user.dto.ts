import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Organization name is required' })
  orgName: string;
}
