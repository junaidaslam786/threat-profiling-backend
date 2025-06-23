import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';

interface JwtHeader {
  alg: string;
  kid: string;
  typ?: string;
}

interface GetKeyCallback {
  (err: Error | null, key?: string | Buffer | undefined): void;
}

@Injectable()
export class AuthService {
  private client = new JwksClient({
    jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  });

  getKey(header: JwtHeader, callback: GetKeyCallback): void {
    this.client.getSigningKey(header.kid, function (err, key) {
      if (err) {
        console.error('Error fetching signing key:', err);
        callback(err, null);
      } else {
        callback(null, key.getPublicKey());
      }
    });
  }

  async verifyToken(token: string) {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        this.getKey.bind(this),
        {
          audience: process.env.COGNITO_CLIENT_ID,
          issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
        },
        (err, decoded) => {
          if (err) {
            console.error('JWT verify error:', err);
            reject(err);
          } else resolve(decoded);
        },
      );
    });
  }
}
