import { Module, MiddlewareConsumer } from '@nestjs/common';

// Core AWS + DB
import { AwsModule } from './aws/aws.module';

// Feature Modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrgsModule } from './orgs/orgs.module';
import { PartnersModule } from './partners/partners.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

// Middleware (if you want to use consumer pattern instead of app.use)
import { LoggerMiddleware } from './middleware/logger.middleware';
import { OrgContextMiddleware } from './middleware/org-context.middleware';

@Module({
  imports: [
    AwsModule,
    AuthModule,
    UsersModule,
    OrgsModule,
    PartnersModule,
    SubscriptionsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware, OrgContextMiddleware).forRoutes('*');
  }
}
