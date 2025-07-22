import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requirePlatformAdmin = this.reflector.get<boolean>(
      'platformAdmin',
      context.getHandler(),
    );
    if (!requirePlatformAdmin) return true; // not needed on this endpoint
    const req = context.switchToHttp().getRequest();
    if (req.user && req.user.role === 'platform_admin') return true;
    throw new ForbiddenException('Only platform admins allowed');
  }
}
