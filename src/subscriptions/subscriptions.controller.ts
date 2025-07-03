import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.services';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RbacGuard } from '../middleware/rbac.guard';

@Controller('subscriptions')
@UseGuards(AuthGuard, RbacGuard)
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  @Post()
  @Roles('admin', 'LE_ADMIN')
  async create(@Body() dto: CreateSubscriptionDto) {
    return this.service.createSubscription(dto);
  }

  @Get(':client_name')
  async get(@Param('client_name') client_name: string) {
    return this.service.getSubscription(client_name);
  }

  @Patch(':client_name')
  @Roles('admin', 'LE_ADMIN')
  async update(
    @Param('client_name') client_name: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.service.updateSubscription(client_name, dto);
  }
}
