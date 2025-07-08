// src/roles/roles.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { AwsService } from '../aws/aws.service';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [AuthModule, forwardRef(() => UsersModule)],
  controllers: [RolesController],
  providers: [RolesService, AwsService],
  exports: [RolesService],
})
export class RolesModule {}
