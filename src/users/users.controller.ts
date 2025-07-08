// src/users/users.controller.ts
import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  Query,
  Get,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JoinOrgRequestDto } from './dto/join-org-request.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ApproveJoinDto } from './dto/approve-join.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  @UseGuards(AuthGuard)
  async register(@Body() dto: CreateUserDto, @Req() req) {
    return this.usersService.registerOrJoinOrg(dto, req.user);
  }

  @Post('join-request')
  @UseGuards(AuthGuard)
  async joinRequest(@Body() dto: JoinOrgRequestDto, @Req() req) {
    return this.usersService.joinRequest(dto, req.user.email, req.user.name);
  }

  @Post('approve-join/:joinId')
  @UseGuards(AuthGuard)
  async approveJoin(
    @Param('joinId') joinId: string,
    @Body() dto: ApproveJoinDto,
    @Req() req,
  ) {
    return this.usersService.approveJoinRequest(
      joinId,
      req.user.email,
      dto.role,
    );
  }

  // Controller should pass all required parameters
  // Replace the existing inviteUser method with this
  @Post('invite')
  @UseGuards(AuthGuard)
  async inviteUser(@Body() dto: InviteUserDto, @Req() req: any) {
    console.log(
      `Invite request for org: ${dto.orgName}, user: ${req.user.email}, inviting: ${dto.email}`,
    );

    return this.usersService.inviteUser(
      dto,
      dto.orgName.trim(),
      req.user.email,
    );
  }

  // Add this new endpoint to UsersController
  @Get('admin-orgs')
  @UseGuards(AuthGuard)
  async getAdminOrganizations(@Req() req) {
    return this.usersService.getAdminOrganizations(req.user.email);
  }

  @Patch('role/:userId')
  @UseGuards(AuthGuard)
  async updateRole(
    @Param('userId') userId: string,
    @Query('org') org: string,
    @Body('role') role: 'admin' | 'viewer',
    @Req() req,
  ) {
    return this.usersService.updateUserRole(userId, org, role, req.user.email);
  }

  @Delete('remove/:userId')
  @UseGuards(AuthGuard)
  async removeUser(
    @Param('userId') userId: string,
    @Query('org') org: string,
    @Req() req,
  ) {
    return this.usersService.removeUser(userId, org, req.user.email);
  }

  @Get('join-requests')
  @UseGuards(AuthGuard)
  async getJoinRequests(@Query('org') org: string, @Req() req) {
    return this.usersService.getPendingJoinRequests(org, req.user.email);
  }

  @Post('me')
  @UseGuards(AuthGuard)
  async getMe(@Req() req) {
    return this.usersService.getUser(req.user.email);
  }
}
