import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
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
    const clientName = dto.orgDomain.replace(/\./g, '_');
    const exists = await this.dynamo.findById('clients_data', clientName);
    if (exists)
      throw new ForbiddenException('Org with this domain already exists');
    await this.dynamo.insert('clients_data', {
      client_name: clientName,
      organization_name: dto.orgName,
      owner_email: creator.email,
      sector: dto.sector,
      website_url: dto.websiteUrl,
      countries_of_operation: dto.countriesOfOperation,
      home_url: dto.homeUrl,
      about_us_url: dto.aboutUsUrl,
      additional_details: dto.additionalDetails,
      admins: [creator.userId],
      viewers: [],
      created_by: creator.userId,
      created_at: new Date().toISOString(),
    });
    await this.dynamo.insert('clients_subs', {
      client_name: clientName,
      subscription_level: 'L0',
      run_number: 0,
      max_edits: 0,
      max_apps: 0,
      admins: [creator.userId],
      viewers: [],
      created_at: new Date().toISOString(),
    });
    return { clientName };
  }

  async createLeOrg(dto: LeCreateOrgDto, leUser) {
    const clientName = generateLeOrgClientName(leUser.domain, dto.orgDomain);
    const exists = await this.dynamo.findById('clients_data', clientName);
    if (exists) throw new ForbiddenException('LE Org already exists');
    await this.dynamo.insert('clients_data', {
      client_name: clientName,
      organization_name: dto.orgName,
      le_master: leUser.userId,
      sector: dto.sector,
      website_url: dto.websiteUrl,
      countries_of_operation: dto.countriesOfOperation,
      home_url: dto.homeUrl,
      about_us_url: dto.aboutUsUrl,
      additional_details: dto.additionalDetails,
      admins: [leUser.userId],
      viewers: [],
      created_by: leUser.userId,
      type: 'LE_ORG',
      created_at: new Date().toISOString(),
    });
    await this.dynamo.insert('clients_subs', {
      client_name: clientName,
      subscription_level: 'LE',
      run_number: 0,
      max_edits: null,
      max_apps: null,
      admins: [leUser.userId],
      viewers: [],
      le_master: leUser.userId,
      created_at: new Date().toISOString(),
    });
    return { clientName };
  }

  async updateOrg(clientName: string, dto: UpdateOrgDto, user) {
    const org = await this.dynamo.findById('clients_data', clientName);
    if (!org) throw new NotFoundException('Org not found');
    if (!org.admins.includes(user.userId))
      throw new ForbiddenException('Not an org admin');
    await this.dynamo.update('clients_data', clientName, {
      sector: dto.sector,
      website_url: dto.websiteUrl,
      countries_of_operation: dto.countriesOfOperation,
      home_url: dto.homeUrl,
      about_us_url: dto.aboutUsUrl,
      additional_details: dto.additionalDetails,
    });
    return { updated: true };
  }

  async getOrgsForUser(user) {
    const userId = user?.userId || user?.sub;
    console.log('Searching orgs for userId:', userId);

    if (!userId) throw new BadRequestException('Missing user context');
    if (user.subscription_level === 'LE' && userId) {
      return this.dynamo.find('clients_data', { le_master: userId });
    }
    const adminOrgs = await this.dynamo.find('clients_data', {
      admins: userId,
    });
    const viewerOrgs = await this.dynamo.find('clients_data', {
      viewers: userId,
    });
    const orgMap = {};
    for (const org of [...adminOrgs, ...viewerOrgs])
      orgMap[org.client_name] = org;
    return Object.values(orgMap);
  }

  async switchOrg(clientName: string, user) {
    const org = await this.dynamo.findById('clients_data', clientName);
    if (!org) throw new NotFoundException();
    if (
      user.subscription_level === 'LE'
        ? org.le_master !== user.userId
        : ![...(org.admins || []), ...(org.viewers || [])].includes(user.userId)
    )
      throw new ForbiddenException('Not authorized for this org');
    // Session switch would be handled via JWT/session update in real implementation.
    return { switchedTo: clientName };
  }
}
