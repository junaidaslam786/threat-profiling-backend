import { forwardRef, Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.services';
import { SubscriptionsController } from './subscriptions.controller';
import { DynamoDbService } from '../aws/dynamodb.service';
import { AuthModule } from 'src/auth/auth.module';
import { TiersModule } from 'src/tiers/tiers.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [AuthModule, TiersModule, forwardRef(() => UsersModule)],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, DynamoDbService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
