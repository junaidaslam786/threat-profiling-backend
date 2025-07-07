import { Module, MiddlewareConsumer } from '@nestjs/common';
import { AwsModule } from './aws/aws.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrgsModule } from './orgs/orgs.module';
import { PartnersModule } from './partners/partners.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

// Middleware (if you want to use consumer pattern instead of app.use)
import { LoggerMiddleware } from './middleware/logger.middleware';
import { OrgContextMiddleware } from './middleware/org-context.middleware';
import { RolesModule } from './roles/roles.module';
import { TiersModule } from './tiers/tiers.module';

@Module({
  imports: [
    AwsModule,
    AuthModule,
    UsersModule,
    OrgsModule,
    PartnersModule,
    SubscriptionsModule,
    RolesModule,
    TiersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware, OrgContextMiddleware).forRoutes('*');
  }
}
