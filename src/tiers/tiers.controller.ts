// src/tiers/tiers.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { TiersService } from './tiers.service';
import { TierConfigDto } from './dto/tier-config.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('tiers')
@UseGuards(AuthGuard)
export class TiersController {
  constructor(private readonly service: TiersService) {}

  @Post()
  async createOrUpdate(@Body() dto: TierConfigDto) {
    return this.service.createOrUpdateTier(dto);
  }

  @Get(':sub_level')
  async get(@Param('sub_level') sub_level: string) {
    return this.service.getTier(sub_level);
  }

  @Get()
  async list() {
    return this.service.listTiers();
  }

  @Delete(':sub_level')
  async delete(@Param('sub_level') sub_level: string) {
    return this.service.deleteTier(sub_level);
  }
}
