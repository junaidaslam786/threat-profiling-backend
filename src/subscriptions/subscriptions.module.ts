import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.services';
import { SubscriptionsController } from './subscriptions.controller';
import { DynamoDbService } from '../aws/dynamodb.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, DynamoDbService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
