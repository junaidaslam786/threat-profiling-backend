import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { RoleConfigDto } from './dto/role-config.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('roles')
@UseGuards(AuthGuard)
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Post()
  async createOrUpdate(@Body() dto: RoleConfigDto) {
    return this.service.createOrUpdateRoleConfig(dto);
  }

  @Get(':role_id')
  async get(@Param('role_id') role_id: string) {
    return this.service.getRoleConfig(role_id);
  }

  @Get()
  async list() {
    return this.service.listRoleConfigs();
  }

  @Delete(':role_id')
  async delete(@Param('role_id') role_id: string) {
    return this.service.deleteRoleConfig(role_id);
  }
}
