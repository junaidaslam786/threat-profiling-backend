import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers['authorization'];
    if (!authHeader)
      throw new UnauthorizedException('Missing Authorization header');

    const token = authHeader.replace('Bearer ', '');
    try {
      const decoded = await this.authService.verifyToken(token);
      req.user = decoded; // Attach to request for downstream use
      return true;
    } catch (err) {
      console.log('Token verification error:', err);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
