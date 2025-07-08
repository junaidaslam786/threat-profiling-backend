import { forwardRef, Module } from '@nestjs/common';
import { OrgsController } from './orgs.controller';
import { OrgsService } from './orgs.service';
import { DynamoDbService } from '../aws/dynamodb.service';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [AuthModule, forwardRef(() => UsersModule)],
  controllers: [OrgsController],
  providers: [OrgsService, DynamoDbService],
  exports: [OrgsService],
})
export class OrgsModule {}
