import { Module } from '@nestjs/common';
import { AwsService } from './aws.service';
import { DynamoDbService } from './dynamodb.service';

@Module({
  providers: [AwsService, DynamoDbService],
  exports: [AwsService, DynamoDbService],
})
export class AwsModule {}
