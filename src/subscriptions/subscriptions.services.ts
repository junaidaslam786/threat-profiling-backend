import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { DynamoDbService } from '../aws/dynamodb.service';
import { TiersService } from 'src/tiers/tiers.service';

function getTable(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing or empty env variable: ${name}`);
  Logger.debug(`Resolving table name for ${name}: ${value}`, 'getTable');
  return value;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly dynamo: DynamoDbService,
    private readonly tiersService: TiersService,
  ) {}

  async createSubscription(dto: CreateSubscriptionDto) {
    const { client_name, tier } = dto;
    const limits = await this.tiersService.getTier(tier);
    await this.dynamo.insert(getTable('DYNAMODB_TABLE_CLIENTS_SUBS'), {
      client_name,
      subscription_level: tier,
      run_number: 0,
      max_edits: limits.maxEdits,
      max_apps: limits.maxApps,
      features_access: limits.allowedTabs,
      run_quota: limits.runQuota,
      progress: 0,
      created_at: new Date().toISOString(),
      payment_status: 'unpaid',
    });
    return { client_name, subscription_level: tier };
  }

  async getSubscription(client_name: string) {
    const sub = await this.dynamo.findById(
      getTable('DYNAMODB_TABLE_CLIENTS_SUBS'), // <-- FIXED HERE
      client_name,
    );
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  async updateSubscription(client_name: string, dto: UpdateSubscriptionDto) {
    if (dto.tier) {
      // Update limits if tier is being changed
      const limits = await this.tiersService.getTier(dto.tier);
      Object.assign(dto, {
        max_edits: limits.max_edits,
        max_apps: limits.max_apps,
        allowed_tabs: limits.allowed_tabs,
        run_quota: limits.run_quota,
        price_monthly: limits.price_monthly,
        price_onetime_registration: limits.price_onetime_registration,
      });
    }
    return this.dynamo.update(
      getTable('DYNAMODB_TABLE_CLIENTS_SUBS'),
      client_name,
      dto,
    );
  }

  async checkFeatureAllowed(
    client_name: string,
    feature: keyof Awaited<ReturnType<TiersService['getTier']>>,
  ) {
    const sub = await this.getSubscription(client_name);
    if (!sub) throw new NotFoundException();
    return sub[feature];
  }

  async incrementRunNumber(client_name: string) {
    return this.dynamo.increment(
      getTable('DYNAMODB_TABLE_CLIENTS_SUBS'), // <-- FIXED HERE
      client_name,
      'run_number',
    );
  }

  // Tier enforcement helper: called before mutating apps/fields/runs
  async enforceLimits(client_name: string, action: 'addApp' | 'edit' | 'run') {
    const sub = await this.getSubscription(client_name);
    if (!sub) throw new NotFoundException();
    if (
      action === 'addApp' &&
      sub.max_apps !== Infinity &&
      sub.apps_count >= sub.max_apps
    ) {
      throw new Error('App limit reached for this subscription tier');
    }
    if (
      action === 'edit' &&
      sub.max_edits !== Infinity &&
      sub.edit_count >= sub.max_edits
    ) {
      throw new Error('Edit limit reached for this subscription tier');
    }
    if (
      action === 'run' &&
      sub.run_quota !== Infinity &&
      sub.run_number >= sub.run_quota
    ) {
      throw new Error('Profiling run quota exceeded');
    }
    return true;
  }
}
