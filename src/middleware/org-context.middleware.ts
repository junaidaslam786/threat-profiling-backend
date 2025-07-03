import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class OrgContextMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    // Only set org context if user is authenticated
    if (req.user) {
      req.org =
        req.headers['x-org'] ||
        req.query.org ||
        req.user.defaultOrg ||
        req.user.orgs?.[0] ||
        null;
      req.client_name = req.org; // Alias for consistency

      // You can optionally check for org on authenticated requests only:
      if (!req.org) {
        // You could throw here if you want to enforce org for authenticated requests
        // throw new UnauthorizedException('No organization context found.');
      }
    }
    // For public requests, just skip org logic
    next();
  }
}
