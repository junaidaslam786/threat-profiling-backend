import { Injectable, NotFoundException } from '@nestjs/common';
import { RoleConfigDto } from './dto/role-config.dto';
import { AwsService } from '../aws/aws.service';
import {
  PutCommand,
  GetCommand,
  ScanCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

@Injectable()
export class RolesService {
  constructor(private readonly awsService: AwsService) {}

  private table = process.env.DYNAMODB_TABLE_ROLES_CONFIG;

  async createOrUpdateRoleConfig(dto: RoleConfigDto) {
    await this.awsService.docClient.send(
      new PutCommand({
        TableName: this.table,
        Item: dto,
      }),
    );
    return { saved: true };
  }

  async getRoleConfig(role_id: string) {
    const { Item } = await this.awsService.docClient.send(
      new GetCommand({
        TableName: this.table,
        Key: { role_id },
      }),
    );
    if (!Item) throw new NotFoundException('Role not found');
    return Item;
  }

  async listRoleConfigs() {
    const { Items } = await this.awsService.docClient.send(
      new ScanCommand({
        TableName: this.table,
      }),
    );
    return Items || [];
  }

  async deleteRoleConfig(role_id: string) {
    await this.awsService.docClient.send(
      new DeleteCommand({
        TableName: this.table,
        Key: { role_id },
      }),
    );
    return { deleted: true };
  }
}
