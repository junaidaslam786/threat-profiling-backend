import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrgDto } from './dto/create-org.dto';
import { UpdateOrgDto } from './dto/update-org.dto';
import { LeCreateOrgDto } from './dto/le-create-org.dto';
import { generateLeOrgClientName } from './orgs.le';
import { DynamoDbService } from '../aws/dynamodb.service';

@Injectable()
export class OrgsService {
  constructor(private readonly dynamo: DynamoDbService) {}

  async createOrg(dto: CreateOrgDto, creator) {
    // Standard org: derive client_name from domain
    const clientName = dto.orgDomain.replace(/\./g, '_');
    const exists = await this.dynamo.findById('clients_data', clientName);
    if (exists)
      throw new ForbiddenException('Org with this domain already exists');
    // Save org data (add creator as admin)
    await this.dynamo.insert('clients_data', {
      client_name: clientName,
      org_name: dto.orgName,
      ...dto,
      admins: [creator.userId],
      viewers: [],
      created_by: creator.userId,
    });
    // Also create entry in clients_subs
    await this.dynamo.insert('clients_subs', {
      client_name: clientName,
      subscription: 'L0',
      run_number: 0,
      max_edits: 0,
      max_apps: 0,
      admins: [creator.userId],
      viewers: [],
    });
    return { clientName };
  }

  async createLeOrg(dto: LeCreateOrgDto, leUser) {
    const clientName = generateLeOrgClientName(leUser.domain, dto.orgDomain);
    const exists = await this.dynamo.findById('clients_data', clientName);
    if (exists) throw new ForbiddenException('LE Org already exists');
    // Save LE org data (under LE account)
    await this.dynamo.insert('clients_data', {
      client_name: clientName,
      org_name: dto.orgName,
      le_master: leUser.userId,
      ...dto,
      admins: [leUser.userId],
      viewers: [],
      created_by: leUser.userId,
      type: 'LE_ORG',
    });
    // Also create entry in clients_subs
    await this.dynamo.insert('clients_subs', {
      client_name: clientName,
      subscription: 'LE',
      run_number: 0,
      max_edits: Infinity,
      max_apps: Infinity,
      admins: [leUser.userId],
      viewers: [],
      le_master: leUser.userId,
    });
    return { clientName };
  }

  async updateOrg(clientName: string, dto: UpdateOrgDto, user) {
    // Only admins can update
    const org = await this.dynamo.findById('clients_data', clientName);
    if (!org) throw new NotFoundException('Org not found');
    if (!org.admins.includes(user.userId)) throw new ForbiddenException();
    // Update org fields
    await this.dynamo.update('clients_data', clientName, dto);
    return { updated: true };
  }

  async getOrgsForUser(user) {
    // For standard: orgs where user is admin or viewer
    // For LE: orgs where le_master === user.userId
    const filter =
      user.subscription === 'LE'
        ? { le_master: user.userId }
        : { $or: [{ admins: user.userId }, { viewers: user.userId }] };
    return this.dynamo.find('clients_data', filter);
  }

  async switchOrg(clientName: string, user) {
    // Validate access
    const org = await this.dynamo.findById('clients_data', clientName);
    if (!org) throw new NotFoundException();
    if (
      user.subscription === 'LE'
        ? org.le_master !== user.userId
        : ![...(org.admins || []), ...(org.viewers || [])].includes(user.userId)
    ) {
      throw new ForbiddenException('Not authorized for this org');
    }
    // Set org in session/context handled elsewhere (e.g. JWT, middleware)
    return { switchedTo: clientName };
  }
}
