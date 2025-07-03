function getTable(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing or empty env variable: ${name}`);
  return value;
}

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AwsService } from '../aws/aws.service';
import { CreateUserDto } from './dto/create-user.dto';
import { PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

@Injectable()
export class UsersService {
  constructor(public readonly awsService: AwsService) {}

  // Helper: list of non-business domains
  private static readonly GENERIC_DOMAINS = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'aol.com',
    'icloud.com',
    'mail.com',
    'protonmail.com',
    'gmx.com',
    'yandex.com',
    'zoho.com',
    'msn.com',
    'live.com',
  ];

  // Helper: returns client_name from email domain
  private static getClientNameFromEmail(email: string) {
    const emailDomain = email.split('@')[1].toLowerCase();
    return emailDomain.replace(/\./g, '_');
  }

  async registerOrJoinOrg(dto: CreateUserDto) {
    // 1. Validate business email
    const emailDomain = dto.email.split('@')[1].toLowerCase();
    if (UsersService.GENERIC_DOMAINS.includes(emailDomain)) {
      throw new BadRequestException('Please use your business email address.');
    }

    // 2. Create unique client name from business domain
    const clientName = UsersService.getClientNameFromEmail(dto.email);

    // 3. Check if org exists
    const { Item: orgItem } = await this.awsService.docClient.send(
      new GetCommand({
        TableName: getTable('DYNAMODB_TABLE_CLIENTS_DATA'),
        Key: { client_name: clientName },
      }),
    );

    if (orgItem) {
      // 4. Org exists: Check if user is already a member
      const { Item: userItem } = await this.awsService.docClient.send(
        new GetCommand({
          TableName: process.env.DYNAMODB_TABLE_USERS,
          Key: { email: dto.email },
        }),
      );
      if (userItem) {
        // User already exists in the system/org
        return {
          message: 'User already registered with this organization',
          client_name: clientName,
          joined: true,
        };
      }

      // Org exists, register as "viewer" and require approval
      const user = {
        email: dto.email,
        name: dto.name,
        client_name: clientName,
        role: 'viewer',
        status: 'pending_approval',
        created_at: new Date().toISOString(),
        partner_code: dto.partnerCode || null,
      };
      await this.awsService.docClient.send(
        new PutCommand({
          TableName: process.env.DYNAMODB_TABLE_USERS,
          Item: user,
        }),
      );
      // Optional: create join request record for admin to approve
      await this.awsService.docClient.send(
        new PutCommand({
          TableName: process.env.DYNAMODB_TABLE_PENDING_JOINS,
          Item: {
            join_id: `${dto.email}:${clientName}`,
            email: dto.email,
            name: dto.name,
            client_name: clientName,
            message: '',
            status: 'pending',
            created_at: new Date().toISOString(),
          },
        }),
      );
      return {
        message:
          'Organization exists, join request submitted (pending approval)',
        client_name: clientName,
        joined: false,
      };
    }

    // 5. Org does not exist: Register new org and user as admin
    const newClient = {
      client_name: clientName,
      organization_name: clientName.replace(/_/g, '.'),
      created_at: new Date().toISOString(),
      owner_email: dto.email,
    };
    await this.awsService.docClient.send(
      new PutCommand({
        TableName: process.env.DYNAMODB_TABLE_CLIENTS_DATA,
        Item: newClient,
      }),
    );

    // 6. Create user as admin
    const newUser = {
      email: dto.email,
      name: dto.name,
      client_name: clientName,
      role: 'admin',
      status: 'active',
      created_at: new Date().toISOString(),
      partner_code: dto.partnerCode || null,
    };
    await this.awsService.docClient.send(
      new PutCommand({
        TableName: process.env.DYNAMODB_TABLE_USERS,
        Item: newUser,
      }),
    );

    // 7. Create entry in clients_subs
    const newSubs = {
      client_name: clientName,
      subscription_level: 'L0',
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
      message: 'New organization and user registered as admin',
      client_name: clientName,
      joined: true,
    };
  }

  // For org admins to approve join requests
  async approveJoinRequest(joinId: string, adminEmail: string) {
    // Find join request
    const { Item: joinReq } = await this.awsService.docClient.send(
      new GetCommand({
        TableName: process.env.DYNAMODB_TABLE_PENDING_JOINS,
        Key: { join_id: joinId },
      }),
    );
    if (!joinReq) throw new NotFoundException('Join request not found');

    // Check admin has permission
    const { Item: org } = await this.awsService.docClient.send(
      new GetCommand({
        TableName: process.env.DYNAMODB_TABLE_CLIENTS_DATA,
        Key: { client_name: joinReq.client_name },
      }),
    );
    if (!org || org.owner_email !== adminEmail)
      throw new ForbiddenException('Only org admin can approve');

    // Update user to 'active'
    await this.awsService.docClient.send(
      new UpdateCommand({
        TableName: process.env.DYNAMODB_TABLE_USERS,
        Key: { email: joinReq.email },
        UpdateExpression: 'SET #status = :active, #role = :viewer',
        ExpressionAttributeNames: { '#status': 'status', '#role': 'role' },
        ExpressionAttributeValues: { ':active': 'active', ':viewer': 'viewer' },
      }),
    );
    // Mark join as approved
    await this.awsService.docClient.send(
      new UpdateCommand({
        TableName: process.env.DYNAMODB_TABLE_PENDING_JOINS,
        Key: { join_id: joinId },
        UpdateExpression: 'SET #status = :approved',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':approved': 'approved' },
      }),
    );
    return { approved: true };
  }

  async getUser(email: string) {
    const { Item: user } = await this.awsService.docClient.send(
      new GetCommand({
        TableName: process.env.DYNAMODB_TABLE_USERS,
        Key: { email },
      }),
    );
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
