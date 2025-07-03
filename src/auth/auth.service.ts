import * as dotenv from 'dotenv';
dotenv.config(); // Ensure .env is loaded before anything else

import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as jwks from 'jwks-rsa';

@Injectable()
export class AuthService {
  private client: jwks.JwksClient;
  private issuer: string;
  private clientId: string;

  constructor() {
    // Always get process.env variables here, never at top-level
    const REGION = process.env.AWS_REGION!;
    const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
    this.clientId = process.env.COGNITO_CLIENT_ID!;
    this.issuer = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`;
    this.client = jwks({
      jwksUri: `${this.issuer}/.well-known/jwks.json`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000, // 10 min
    });

    // Log to verify (remove in prod)
    console.log('AuthService config:', {
      REGION,
      USER_POOL_ID,
      CLIENT_ID: this.clientId,
      ISSUER: this.issuer,
    });

    // Defensive: Throw if missing config
    if (!REGION || !USER_POOL_ID || !this.clientId) {
      throw new Error(
        'Missing AWS_REGION, COGNITO_USER_POOL_ID, or COGNITO_CLIENT_ID in environment.',
      );
    }
  }

  getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback): void {
    this.client.getSigningKey(header.kid, (err, key) => {
      if (err) {
        console.error('Error fetching signing key:', err);
        callback(err, undefined);
      } else {
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
      }
    });
  }

  async verifyToken(token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        this.getKey.bind(this),
        {
          algorithms: ['RS256'],
          issuer: this.issuer,
          ignoreExpiration: false,
        },
        (err, decoded: any) => {
          if (err) {
            console.error('JWT verify error:', err);
            reject(new Error('Token verification failed'));
            return;
          }
          // Optional: Check token_use, aud/client_id
          if (decoded.token_use !== 'id' && decoded.token_use !== 'access') {
            reject(new Error('Invalid token use'));
            return;
          }
          if (
            decoded.aud !== this.clientId &&
            decoded.client_id !== this.clientId
          ) {
            reject(new Error('Invalid audience/client_id'));
            return;
          }
          resolve(decoded);
        },
      );
    });
  }
}
