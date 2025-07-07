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
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { JoinOrgRequestDto } from './dto/join-org-request.dto';
import { InviteUserDto } from './dto/invite-user.dto';

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

  async registerOrJoinOrg(dto: CreateUserDto, creator?: any) {
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
    // Use Cognito sub for admin if available, fallback to email
    const adminUserId = creator?.sub || creator?.userId || dto.email;

    const newClient = {
      client_name: clientName,
      organization_name: clientName.replace(/_/g, '.'),
      created_at: new Date().toISOString(),
      owner_email: dto.email,
      admins: [adminUserId], // <-- Add admin to admins array
      viewers: [], // <-- Always initialize viewers
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

    // 7. Create entry in clients_subs (add admins/viewers for quick access if needed)
    const newSubs = {
      client_name: clientName,
      subscription_level: 'L0',
      run_quota: 0,
      progress: 0,
      admins: [adminUserId],
      viewers: [],
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

  async joinRequest(
    dto: JoinOrgRequestDto,
    userEmail: string,
    userName: string,
  ) {
    const clientName = dto.orgDomain.replace(/\./g, '_').toLowerCase();

    // Validate org exists
    const { Item: orgItem } = await this.awsService.docClient.send(
      new GetCommand({
        TableName: getTable('DYNAMODB_TABLE_CLIENTS_DATA'),
        Key: { client_name: clientName },
      }),
    );
    if (!orgItem) throw new NotFoundException('Organization does not exist');
    // Create pending user if not exists
    await this.awsService.docClient.send(
      new PutCommand({
        TableName: getTable('DYNAMODB_TABLE_USERS'),
        Item: {
          email: userEmail,
          name: userName,
          client_name: clientName,
          role: 'viewer',
          status: 'pending_approval',
          created_at: new Date().toISOString(),
        },
      }),
    );
    // Create join request
    await this.awsService.docClient.send(
      new PutCommand({
        TableName: getTable('DYNAMODB_TABLE_PENDING_JOINS'),
        Item: {
          join_id: `${userEmail}:${clientName}`,
          email: userEmail,
          name: userName,
          client_name: clientName,
          message: dto.message || '',
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      }),
    );
    return { message: 'Join request sent', client_name: clientName };
  }
  // For org admins to approve join requests
  async approveJoinRequest(
    joinId: string,
    adminEmail: string,
    assignedRole: 'admin' | 'viewer' | 'runner' = 'viewer',
  ) {
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

    // Update user to 'active' and assign the role
    await this.awsService.docClient.send(
      new UpdateCommand({
        TableName: process.env.DYNAMODB_TABLE_USERS,
        Key: { email: joinReq.email },
        UpdateExpression: 'SET #status = :active, #role = :role',
        ExpressionAttributeNames: { '#status': 'status', '#role': 'role' },
        ExpressionAttributeValues: {
          ':active': 'active',
          ':role': assignedRole,
        },
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
    return { approved: true, assignedRole };
  }

  async getPendingJoinRequests(orgClientName: string, adminEmail: string) {
    // Only allow org admin
    const { Item: org } = await this.awsService.docClient.send(
      new GetCommand({
        TableName: getTable('DYNAMODB_TABLE_CLIENTS_DATA'),
        Key: { client_name: orgClientName },
      }),
    );
    if (!org || org.owner_email !== adminEmail) {
      throw new ForbiddenException('Only org admin can view join requests');
    }

    // Scan for pending join requests for this org
    const { Items } = await this.awsService.docClient.send(
      new ScanCommand({
        TableName: getTable('DYNAMODB_TABLE_PENDING_JOINS'),
        FilterExpression: 'client_name = :clientName AND #status = :pending',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':clientName': orgClientName,
          ':pending': 'pending',
        },
      }),
    );
    return Items || [];
  }

  async inviteUser(
    dto: InviteUserDto,
    orgClientName: string,
    adminEmail: string,
  ) {
    // Only org admin can invite
    const { Item: org } = await this.awsService.docClient.send(
      new GetCommand({
        TableName: getTable('DYNAMODB_TABLE_CLIENTS_DATA'),
        Key: { client_name: orgClientName },
      }),
    );
    if (!org || org.owner_email !== adminEmail)
      throw new ForbiddenException('Only org admin can invite users');
    // Pre-create user as pending
    await this.awsService.docClient.send(
      new PutCommand({
        TableName: getTable('DYNAMODB_TABLE_USERS'),
        Item: {
          email: dto.email,
          name: dto.name,
          client_name: orgClientName,
          role: 'viewer',
          status: 'pending_approval',
          created_at: new Date().toISOString(),
        },
      }),
    );
    // TODO: Optionally send invite email here
    return { invited: true };
  }

  // /api/users/role/:userId
  async updateUserRole(
    userId: string,
    orgClientName: string,
    role: 'admin' | 'viewer',
    adminEmail: string,
  ) {
    // Only org admin can update role
    const { Item: org } = await this.awsService.docClient.send(
      new GetCommand({
        TableName: getTable('DYNAMODB_TABLE_CLIENTS_DATA'),
        Key: { client_name: orgClientName },
      }),
    );
    if (!org || org.owner_email !== adminEmail)
      throw new ForbiddenException('Only org admin can update roles');
    // Update user's role
    await this.awsService.docClient.send(
      new UpdateCommand({
        TableName: getTable('DYNAMODB_TABLE_USERS'),
        Key: { email: userId },
        UpdateExpression: 'SET #role = :role',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: { ':role': role },
      }),
    );
    return { updated: true, role };
  }

  // /api/users/remove/:userId
  async removeUser(userId: string, orgClientName: string, adminEmail: string) {
    // Only org admin can remove users
    const { Item: org } = await this.awsService.docClient.send(
      new GetCommand({
        TableName: getTable('DYNAMODB_TABLE_CLIENTS_DATA'),
        Key: { client_name: orgClientName },
      }),
    );
    if (!org || org.owner_email !== adminEmail)
      throw new ForbiddenException('Only org admin can remove users');
    // Remove user
    await this.awsService.docClient.send(
      new DeleteCommand({
        TableName: getTable('DYNAMODB_TABLE_USERS'),
        Key: { email: userId },
      }),
    );
    return { removed: true };
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
