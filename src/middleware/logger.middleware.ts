import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const { method, originalUrl } = req;
    const user = req.user ? req.user.email : 'Guest';
    console.log(
      `[${new Date().toISOString()}] ${method} ${originalUrl} - User: ${user}`,
    );
    next();
  }
}
