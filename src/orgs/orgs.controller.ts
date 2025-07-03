import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Param,
  Patch,
} from '@nestjs/common';
import { OrgsService } from './orgs.service';
import { CreateOrgDto } from './dto/create-org.dto';
import { LeCreateOrgDto } from './dto/le-create-org.dto';
import { UpdateOrgDto } from './dto/update-org.dto';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RbacGuard } from '../middleware/rbac.guard';

@Controller('orgs')
@UseGuards(AuthGuard)
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

  @Post()
  @Roles('admin')
  @UseGuards(RbacGuard)
  async createOrg(@Body() dto: CreateOrgDto, @Req() req) {
    return this.orgsService.createOrg(dto, req.user);
  }

  @Post('le')
  @Roles('LE_ADMIN')
  @UseGuards(RbacGuard)
  async createLeOrg(@Body() dto: LeCreateOrgDto, @Req() req) {
    return this.orgsService.createLeOrg(dto, req.user);
  }

  @Get()
  async getUserOrgs(@Req() req) {
    return this.orgsService.getOrgsForUser(req.user);
  }

  @Patch(':clientName')
  @Roles('admin')
  @UseGuards(RbacGuard)
  async updateOrg(
    @Param('clientName') clientName: string,
    @Body() dto: UpdateOrgDto,
    @Req() req,
  ) {
    return this.orgsService.updateOrg(clientName, dto, req.user);
  }

  @Get('switch/:clientName')
  async switchOrg(@Param('clientName') clientName: string, @Req() req) {
    return this.orgsService.switchOrg(clientName, req.user);
  }
}
