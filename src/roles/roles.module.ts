// src/roles/roles.module.ts
import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { AwsService } from '../aws/aws.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RolesController],
  providers: [RolesService, AwsService],
  exports: [RolesService],
})
export class RolesModule {}
