import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Param,
  Get,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('test-log')
  async testLog() {
    console.log('TestLog endpoint hit!');
    return { status: 'ok' };
  }

  @Post('register')
  @UseGuards(AuthGuard)
  async register(@Body() dto: CreateUserDto, @Req() req) {
    console.log('Register endpoint: req.user =', req.user);
    return this.usersService.registerOrJoinOrg(dto);
  }

  @Post('approve-join/:joinId')
  @UseGuards(AuthGuard)
  async approveJoin(@Param('joinId') joinId: string, @Req() req) {
    // req.user.email comes from Cognito
    return this.usersService.approveJoinRequest(joinId, req.user.email);
  }

  @Post('me')
  @UseGuards(AuthGuard)
  async getMe(@Req() req) {
    return this.usersService.getUser(req.user.email);
  }
}
