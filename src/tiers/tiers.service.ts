// src/tiers/tiers.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { TierConfigDto } from './dto/tier-config.dto';
import { AwsService } from '../aws/aws.service';
import {
  PutCommand,
  GetCommand,
  ScanCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

@Injectable()
export class TiersService {
  private table = process.env.DYNAMODB_TABLE_TIERS_CONFIG;

  constructor(private readonly awsService: AwsService) {}

  async createOrUpdateTier(dto: TierConfigDto) {
    await this.awsService.docClient.send(
      new PutCommand({ TableName: this.table, Item: dto }),
    );
    return { saved: true, sub_level: dto.sub_level };
  }

  async getTier(sub_level: string) {
    const { Item } = await this.awsService.docClient.send(
      new GetCommand({ TableName: this.table, Key: { sub_level } }),
    );
    if (!Item) throw new NotFoundException('Tier not found');
    return Item;
  }

  async listTiers() {
    const { Items } = await this.awsService.docClient.send(
      new ScanCommand({ TableName: this.table }),
    );
    return Items || [];
  }

  async deleteTier(sub_level: string) {
    await this.awsService.docClient.send(
      new DeleteCommand({ TableName: this.table, Key: { sub_level } }),
    );
    return { deleted: true, sub_level };
  }
}
