import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  @UseGuards(AuthGuard)
  async register(@Body() dto: CreateUserDto) {
    // req.user contains the Cognito token data
    return this.usersService.registerOrJoinOrg(dto);
  }
}
