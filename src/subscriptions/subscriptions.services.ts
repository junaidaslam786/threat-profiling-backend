import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SUBSCRIPTION_TIERS } from './subscription-tiers';
import { DynamoDbService } from '../aws/dynamodb.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly dynamo: DynamoDbService) {}

  async createSubscription(dto: CreateSubscriptionDto) {
    const { client_name, tier } = dto;
    // Build initial limits based on tier
    const limits = SUBSCRIPTION_TIERS[tier];
    await this.dynamo.insert('clients_subs', {
      client_name,
      subscription: tier,
      run_number: 0,
      max_edits: limits.maxEdits,
      max_apps: limits.maxApps,
      allowed_tabs: limits.allowedTabs,
      run_quota: limits.runQuota,
      created_at: new Date().toISOString(),
    });
    return { client_name, subscription: tier };
  }

  async getSubscription(client_name: string) {
    const sub = await this.dynamo.findById('clients_subs', client_name);
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  async updateSubscription(client_name: string, dto: UpdateSubscriptionDto) {
    if (dto.tier) {
      // Update limits if tier is being changed
      const limits = SUBSCRIPTION_TIERS[dto.tier];
      Object.assign(dto, {
        max_edits: limits.maxEdits,
        max_apps: limits.maxApps,
        allowed_tabs: limits.allowedTabs,
        run_quota: limits.runQuota,
      });
    }
    return this.dynamo.update('clients_subs', client_name, dto);
  }

  async checkFeatureAllowed(
    client_name: string,
    feature: keyof (typeof SUBSCRIPTION_TIERS)['L1'],
  ) {
    const sub = await this.getSubscription(client_name);
    if (!sub) throw new NotFoundException();
    return sub[feature];
  }

  async incrementRunNumber(client_name: string) {
    return this.dynamo.increment('clients_subs', client_name, 'run_number');
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
