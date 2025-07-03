import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    // Admins always have all permissions for their org
    if (requiredRoles.includes('admin') && user.role === 'admin') return true;
    if (requiredRoles.includes('LE_ADMIN') && user.subscription === 'LE')
      return true;
    if (requiredRoles.includes('viewer') && user.role === 'viewer') return true;

    throw new ForbiddenException('Insufficient permissions');
  }
}
