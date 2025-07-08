import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
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
import { DynamoDbService } from '../aws/dynamodb.service';

function getTable(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing or empty env variable: ${name}`);
  Logger.debug(`Resolving table name for ${name}: ${value}`, 'getTable');
  return value;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    public readonly awsService: AwsService,
    private readonly dynamoDbService: DynamoDbService,
  ) {
    this.logger.log('UsersService initialized');
  }

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
    this.logger.debug(`Registering or joining org for email: ${dto.email}`);

    // 1. Validate business email
    const emailDomain = dto.email.split('@')[1].toLowerCase();
    if (UsersService.GENERIC_DOMAINS.includes(emailDomain)) {
      this.logger.warn(
        `Registration attempt with generic email domain: ${emailDomain}`,
      );
      throw new BadRequestException('Please use your business email address.');
    }

    // 2. Create unique client name from business domain
    const clientName = UsersService.getClientNameFromEmail(dto.email);
    this.logger.debug(
      `Generated client name: ${clientName} from domain: ${emailDomain}`,
    );

    // 3. Check if org exists
    this.logger.debug(`Checking if org exists for client name: ${clientName}`);
    const getOrgParams = {
      TableName: getTable('DYNAMODB_TABLE_CLIENTS_DATA'),
      Key: { client_name: clientName },
    };
    this.awsService.logDynamoOperation('GET', getOrgParams);

    const { Item: orgItem } = await this.awsService.docClient.send(
      new GetCommand(getOrgParams),
    );

    if (orgItem) {
      this.logger.debug(`Organization exists for client name: ${clientName}`);

      // 4. Org exists: Check if user is already a member
      const getUserParams = {
        TableName: getTable('DYNAMODB_TABLE_USERS'),
        Key: { email: dto.email },
      };
      this.awsService.logDynamoOperation('GET', getUserParams);

      const { Item: userItem } = await this.awsService.docClient.send(
        new GetCommand(getUserParams),
      );

      if (userItem) {
        this.logger.debug(
          `User ${dto.email} already exists in organization ${clientName}`,
        );
        // User already exists in the system/org
        return {
          message: 'User already registered with this organization',
          client_name: clientName,
          joined: true,
        };
      }

      // Org exists, register as "viewer" and require approval
      this.logger.debug(
        `Creating pending user for ${dto.email} in existing org ${clientName}`,
      );
      const user = {
        email: dto.email,
        name: dto.name,
        client_name: clientName,
        role: 'viewer',
        status: 'pending_approval',
        created_at: new Date().toISOString(),
        partner_code: dto.partnerCode || null,
      };

      const putUserParams = {
        TableName: getTable('DYNAMODB_TABLE_USERS'),
        Item: user,
      };
      this.awsService.logDynamoOperation('PUT', putUserParams);

      await this.awsService.docClient.send(new PutCommand(putUserParams));

      // Optional: create join request record for admin to approve
      this.logger.debug(
        `Creating join request for ${dto.email} in ${clientName}`,
      );
      const putJoinParams = {
        TableName: getTable('DYNAMODB_TABLE_PENDING_JOINS'),
        Item: {
          join_id: `${dto.email}:${clientName}`,
          email: dto.email,
          name: dto.name,
          client_name: clientName,
          message: '',
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      };
      this.awsService.logDynamoOperation('PUT', putJoinParams);

      await this.awsService.docClient.send(new PutCommand(putJoinParams));

      this.logger.debug(
        `Join request created for ${dto.email} in ${clientName}`,
      );
      return {
        message:
          'Organization exists, join request submitted (pending approval)',
        client_name: clientName,
        joined: false,
      };
    }

    // 5. Org does not exist: Register new org and user as admin
    this.logger.debug(`Creating new organization for ${clientName}`);
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

    const putOrgParams = {
      TableName: getTable('DYNAMODB_TABLE_CLIENTS_DATA'),
      Item: newClient,
    };
    this.awsService.logDynamoOperation('PUT', putOrgParams);

    await this.awsService.docClient.send(new PutCommand(putOrgParams));

    // 6. Create user as admin
    this.logger.debug(
      `Creating admin user ${dto.email} for new org ${clientName}`,
    );
    const newUser = {
      email: dto.email,
      name: dto.name,
      client_name: clientName,
      role: 'admin',
      status: 'active',
      created_at: new Date().toISOString(),
      partner_code: dto.partnerCode || null,
    };

    const putNewUserParams = {
      TableName: getTable('DYNAMODB_TABLE_USERS'),
      Item: newUser,
    };
    this.awsService.logDynamoOperation('PUT', putNewUserParams);

    await this.awsService.docClient.send(new PutCommand(putNewUserParams));

    // 7. Create entry in clients_subs (add admins/viewers for quick access if needed)
    this.logger.debug(`Creating subscription entry for ${clientName}`);
    const newSubs = {
      client_name: clientName,
      subscription_level: 'L0',
      run_quota: 0,
      progress: 0,
      admins: [adminUserId],
      viewers: [],
      created_at: new Date().toISOString(),
    };

    const putSubsParams = {
      TableName: getTable('DYNAMODB_TABLE_CLIENTS_SUBS'),
      Item: newSubs,
    };
    this.awsService.logDynamoOperation('PUT', putSubsParams);

    await this.awsService.docClient.send(new PutCommand(putSubsParams));

    this.logger.debug(
      `Successfully created organization ${clientName} with admin ${dto.email}`,
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
    this.logger.debug(
      `Processing join request for user ${userEmail} to org ${dto.orgDomain}`,
    );
    const clientName = dto.orgDomain.replace(/\./g, '_').toLowerCase();

    // Validate org exists
    this.logger.debug(`Checking if org exists: ${clientName}`);
    const getOrgParams = {
      TableName: getTable('DYNAMODB_TABLE_CLIENTS_DATA'),
      Key: { client_name: clientName },
    };
    this.awsService.logDynamoOperation('GET', getOrgParams);

    const { Item: orgItem } = await this.awsService.docClient.send(
      new GetCommand(getOrgParams),
    );

    if (!orgItem) {
      this.logger.warn(`Organization does not exist: ${clientName}`);
      throw new NotFoundException('Organization does not exist');
    }

    // Create pending user if not exists
    this.logger.debug(
      `Creating pending user: ${userEmail} for org ${clientName}`,
    );
    const putUserParams = {
      TableName: getTable('DYNAMODB_TABLE_USERS'),
      Item: {
        email: userEmail,
        name: userName,
        client_name: clientName,
        role: 'viewer',
        status: 'pending_approval',
        created_at: new Date().toISOString(),
      },
    };
    this.awsService.logDynamoOperation('PUT', putUserParams);

    await this.awsService.docClient.send(new PutCommand(putUserParams));

    // Create join request
    this.logger.debug(
      `Creating join request for ${userEmail} to org ${clientName}`,
    );
    const putJoinParams = {
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
    };
    this.awsService.logDynamoOperation('PUT', putJoinParams);

    await this.awsService.docClient.send(new PutCommand(putJoinParams));

    this.logger.debug(
      `Join request created for ${userEmail} to org ${clientName}`,
    );
    return { message: 'Join request sent', client_name: clientName };
  }

  // For org admins to approve join requests
  async approveJoinRequest(
    joinId: string,
    adminEmail: string,
    assignedRole: 'admin' | 'viewer' | 'runner' = 'viewer',
  ) {
    this.logger.debug(
      `Processing approval for join request ${joinId} by admin ${adminEmail}`,
    );

    // Find join request
    const getJoinParams = {
      TableName: getTable('DYNAMODB_TABLE_PENDING_JOINS'),
      Key: { join_id: joinId },
    };
    this.awsService.logDynamoOperation('GET', getJoinParams);

    const { Item: joinReq } = await this.awsService.docClient.send(
      new GetCommand(getJoinParams),
    );

    if (!joinReq) {
      this.logger.warn(`Join request not found: ${joinId}`);
      throw new NotFoundException('Join request not found');
    }

    // Check admin has permission
    this.logger.debug(
      `Verifying admin permissions for ${adminEmail} in org ${joinReq.client_name}`,
    );
    const getOrgParams = {
      TableName: getTable('DYNAMODB_TABLE_CLIENTS_DATA'),
      Key: { client_name: joinReq.client_name },
    };
    this.awsService.logDynamoOperation('GET', getOrgParams);

    const { Item: org } = await this.awsService.docClient.send(
      new GetCommand(getOrgParams),
    );

    if (!org || org.owner_email !== adminEmail) {
      this.logger.warn(
        `Permission denied: ${adminEmail} is not admin of ${joinReq.client_name}`,
      );
      throw new ForbiddenException('Only org admin can approve');
    }

    // Update user to 'active' and assign the role
    this.logger.debug(
      `Updating user ${joinReq.email} status to active with role ${assignedRole}`,
    );
    const updateUserParams = {
      TableName: getTable('DYNAMODB_TABLE_USERS'),
      Key: { email: joinReq.email },
      UpdateExpression: 'SET #status = :active, #role = :role',
      ExpressionAttributeNames: { '#status': 'status', '#role': 'role' },
      ExpressionAttributeValues: {
        ':active': 'active',
        ':role': assignedRole,
      },
    };
    this.awsService.logDynamoOperation('UPDATE', updateUserParams);

    await this.awsService.docClient.send(new UpdateCommand(updateUserParams));

    // Mark join as approved
    this.logger.debug(`Marking join request ${joinId} as approved`);
    const updateJoinParams = {
      TableName: getTable('DYNAMODB_TABLE_PENDING_JOINS'),
      Key: { join_id: joinId },
      UpdateExpression: 'SET #status = :approved',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':approved': 'approved' },
    };
    this.awsService.logDynamoOperation('UPDATE', updateJoinParams);

    await this.awsService.docClient.send(new UpdateCommand(updateJoinParams));

    this.logger.debug(`Successfully approved join request ${joinId}`);
    return { approved: true, assignedRole };
  }

  async getPendingJoinRequests(orgClientName: string, adminEmail: string) {
    this.logger.debug(
      `Getting pending join requests for org ${orgClientName} by admin ${adminEmail}`,
    );

    try {
      // Only allow org admin (keep this check)
      const getOrgParams = {
        TableName: getTable('DYNAMODB_TABLE_CLIENTS_DATA'),
        Key: { client_name: orgClientName },
      };
      this.awsService.logDynamoOperation('GET', getOrgParams);

      const { Item: org } = await this.awsService.docClient.send(
        new GetCommand(getOrgParams),
      );

      if (!org || org.owner_email !== adminEmail) {
        this.logger.warn(
          `Permission denied: ${adminEmail} is not admin of ${orgClientName}`,
        );
        throw new ForbiddenException('Only org admin can view join requests');
      }

      // Use scan operation directly with AWS SDK v3
      this.logger.debug(
        `Scanning for pending join requests for org ${orgClientName}`,
      );
      const scanParams = {
        TableName: getTable('DYNAMODB_TABLE_PENDING_JOINS'),
        FilterExpression: 'client_name = :clientName AND #status = :pending',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':clientName': orgClientName,
          ':pending': 'pending',
        },
      };
      this.awsService.logDynamoOperation('SCAN', scanParams);

      const scanResult = await this.awsService.docClient.send(
        new ScanCommand(scanParams),
      );

      this.logger.debug(
        `Found ${scanResult.Items?.length || 0} pending join requests for org ${orgClientName}`,
      );
      return scanResult.Items || [];
    } catch (error) {
      this.logger.error(
        `Error in getPendingJoinRequests: ${error.message}`,
        error.stack,
      );
      if (error instanceof ForbiddenException) {
        throw error;
      }
      // Fall back to empty array for other errors
      return [];
    }
  }

  async inviteUser(
    dto: InviteUserDto,
    orgClientName: string,
    adminEmail: string,
  ) {
    // Validate required parameters
    if (!orgClientName) {
      this.logger.warn(`Invite attempt failed: Missing organization name`);
      throw new BadRequestException('Organization name is required');
    }

    this.logger.debug(
      `Processing invite for user ${dto.email} to org ${orgClientName} by admin ${adminEmail}`,
    );

    try {
      // Only org admin can invite
      const getOrgParams = {
        TableName: getTable('DYNAMODB_TABLE_CLIENTS_DATA'),
        Key: { client_name: orgClientName },
      };
      this.logger.debug(
        `Checking org with key: ${JSON.stringify(getOrgParams.Key)}`,
      );
      this.awsService.logDynamoOperation('GET', getOrgParams);

      const { Item: org } = await this.awsService.docClient.send(
        new GetCommand(getOrgParams),
      );

      if (!org) {
        this.logger.warn(`Organization not found: ${orgClientName}`);
        throw new NotFoundException(`Organization ${orgClientName} not found`);
      }

      if (org.owner_email !== adminEmail) {
        this.logger.warn(
          `Permission denied: ${adminEmail} is not admin of ${orgClientName}`,
        );
        throw new ForbiddenException('Only org admin can invite users');
      }

      // Pre-create user as pending
      this.logger.debug(
        `Creating pending user ${dto.email} for org ${orgClientName}`,
      );
      const putUserParams = {
        TableName: getTable('DYNAMODB_TABLE_USERS'),
        Item: {
          email: dto.email,
          name: dto.name,
          client_name: orgClientName,
          role: 'viewer',
          status: 'pending_approval',
          created_at: new Date().toISOString(),
        },
      };
      this.awsService.logDynamoOperation('PUT', putUserParams);

      await this.awsService.docClient.send(new PutCommand(putUserParams));

      this.logger.debug(
        `Successfully invited user ${dto.email} to org ${orgClientName}`,
      );
      // TODO: Optionally send invite email here
      return { invited: true };
    } catch (error) {
      this.logger.error(`Error in inviteUser: ${error.message}`, error.stack);

      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new Error(`Failed to invite user: ${error.message}`);
    }
  }

  // /api/users/role/:userId
  async updateUserRole(
    userId: string,
    orgClientName: string,
    role: 'admin' | 'viewer',
    adminEmail: string,
  ) {
    this.logger.debug(
      `Updating role for user ${userId} to ${role} in org ${orgClientName} by admin ${adminEmail}`,
    );

    // Only org admin can update role
    const getOrgParams = {
      TableName: getTable('DYNAMODB_TABLE_CLIENTS_DATA'),
      Key: { client_name: orgClientName },
    };
    this.awsService.logDynamoOperation('GET', getOrgParams);

    const { Item: org } = await this.awsService.docClient.send(
      new GetCommand(getOrgParams),
    );

    if (!org || org.owner_email !== adminEmail) {
      this.logger.warn(
        `Permission denied: ${adminEmail} is not admin of ${orgClientName}`,
      );
      throw new ForbiddenException('Only org admin can update roles');
    }

    // Update user's role
    this.logger.debug(`Updating role for user ${userId} to ${role}`);
    const updateRoleParams = {
      TableName: getTable('DYNAMODB_TABLE_USERS'),
      Key: { email: userId },
      UpdateExpression: 'SET #role = :role',
      ExpressionAttributeNames: { '#role': 'role' },
      ExpressionAttributeValues: { ':role': role },
    };
    this.awsService.logDynamoOperation('UPDATE', updateRoleParams);

    await this.awsService.docClient.send(new UpdateCommand(updateRoleParams));

    this.logger.debug(
      `Successfully updated role for user ${userId} to ${role}`,
    );
    return { updated: true, role };
  }

  // /api/users/remove/:userId
  async removeUser(userId: string, orgClientName: string, adminEmail: string) {
    this.logger.debug(
      `Removing user ${userId} from org ${orgClientName} by admin ${adminEmail}`,
    );

    // Only org admin can remove users
    const getOrgParams = {
      TableName: getTable('DYNAMODB_TABLE_CLIENTS_DATA'),
      Key: { client_name: orgClientName },
    };
    this.awsService.logDynamoOperation('GET', getOrgParams);

    const { Item: org } = await this.awsService.docClient.send(
      new GetCommand(getOrgParams),
    );

    if (!org || org.owner_email !== adminEmail) {
      this.logger.warn(
        `Permission denied: ${adminEmail} is not admin of ${orgClientName}`,
      );
      throw new ForbiddenException('Only org admin can remove users');
    }

    // Remove user
    this.logger.debug(`Deleting user ${userId}`);
    const deleteUserParams = {
      TableName: getTable('DYNAMODB_TABLE_USERS'),
      Key: { email: userId },
    };
    this.awsService.logDynamoOperation('DELETE', deleteUserParams);

    await this.awsService.docClient.send(new DeleteCommand(deleteUserParams));

    this.logger.debug(
      `Successfully removed user ${userId} from org ${orgClientName}`,
    );
    return { removed: true };
  }

  async getUser(email: string) {
    this.logger.debug(`Getting user information for ${email}`);

    const getUserParams = {
      TableName: getTable('DYNAMODB_TABLE_USERS'),
      Key: { email },
    };
    this.awsService.logDynamoOperation('GET', getUserParams);

    const { Item: user } = await this.awsService.docClient.send(
      new GetCommand(getUserParams),
    );

    if (!user) {
      this.logger.warn(`User not found: ${email}`);
      throw new NotFoundException('User not found');
    }

    this.logger.debug(`Successfully retrieved user information for ${email}`);
    return user;
  }

  // Add this new method to UsersService
  async getAdminOrganizations(adminEmail: string) {
    this.logger.debug(`Getting organizations owned by admin: ${adminEmail}`);

    try {
      const scanParams = {
        TableName: getTable('DYNAMODB_TABLE_CLIENTS_DATA'),
        FilterExpression: 'owner_email = :adminEmail',
        ExpressionAttributeValues: {
          ':adminEmail': adminEmail,
        },
      };
      this.awsService.logDynamoOperation('SCAN', scanParams);

      const scanResult = await this.awsService.docClient.send(
        new ScanCommand(scanParams),
      );

      this.logger.debug(
        `Found ${scanResult.Items?.length || 0} organizations for admin ${adminEmail}`,
      );

      return scanResult.Items || [];
    } catch (error) {
      this.logger.error(
        `Error in getAdminOrganizations: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
