import {
  Injectable,
  // ConflictException,
  // ForbiddenException,
} from '@nestjs/common';
import { AwsService } from '../aws/aws.service';
import { CreateUserDto } from './dto/create-user.dto';
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

@Injectable()
export class UsersService {
  constructor(private readonly awsService: AwsService) {}

  async registerOrJoinOrg(dto: CreateUserDto) {
    // Step 1: Derive organization (client) name from email domain
    const emailDomain = dto.email
      .split('@')[1]
      .toLowerCase()
      .replace(/\./g, '_');
    const clientName = emailDomain;

    // Step 2: Check if org exists in clients_data
    const { Item: orgItem } = await this.awsService.docClient.send(
      new GetCommand({
        TableName: process.env.DYNAMODB_TABLE_CLIENTS_DATA,
        Key: { client_name: clientName },
      }),
    );

    if (orgItem) {
      // Organization exists, simulate join request for now
      // Future: Send join request, require admin approval
      return {
        message:
          'Organization exists, join request sent (auto-approved for milestone 1)',
        client_name: clientName,
      };
    }

    // Step 3: If not, create new org & initial subscription
    const newClient = {
      client_name: clientName,
      organization_name: clientName.replace(/_/g, '.'),
      email: dto.email,
      name: dto.name,
      partner_code: dto.partnerCode || null,
      created_at: new Date().toISOString(),
      // more fields as needed
    };
    await this.awsService.docClient.send(
      new PutCommand({
        TableName: process.env.DYNAMODB_TABLE_CLIENTS_DATA,
        Item: newClient,
      }),
    );

    const newSubs = {
      client_name: clientName,
      subscription_level: 'L0', // Default to free tier
      run_quota: 0,
      progress: 0,
      created_at: new Date().toISOString(),
    };
    await this.awsService.docClient.send(
      new PutCommand({
        TableName: process.env.DYNAMODB_TABLE_CLIENTS_SUBS,
        Item: newSubs,
      }),
    );

    return {
      message: 'New organization and user registered',
      client_name: clientName,
    };
  }
}
