import { Module } from '@nestjs/common';
import { TiersService } from './tiers.service';
import { TiersController } from './tiers.controller';
import { AwsService } from '../aws/aws.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TiersController],
  providers: [TiersService, AwsService],
  exports: [TiersService],
})
export class TiersModule {}
