// src/auth/auth.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers['authorization'];
    if (!authHeader)
      throw new UnauthorizedException('Missing Authorization header');

    const token = authHeader.replace('Bearer ', '');
    try {
      const decoded = await this.authService.verifyToken(token);

      // Enrich user with application role and org info from your DB
      const userDb = await this.usersService.getUser(decoded.email);
      // Merge JWT fields with DB user fields
      req.user = { ...decoded, ...userDb };

      // Optionally, you can log this for debug
      // console.log('Enriched req.user:', req.user);

      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
