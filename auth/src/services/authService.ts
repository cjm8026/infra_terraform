/**
 * Auth Service Module - JWT verification and Cognito operations
 */

import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AdminGetUserCommand,
  AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { isValidPassword } from './databaseUtils';

export interface CognitoUser {
  sub: string;
  email: string;
  email_verified: boolean;
  preferred_username?: string;
  token_use?: string;
  [key: string]: any;
}

export class TokenVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenVerificationError';
  }
}

export class TokenExpiredError extends Error {
  constructor() {
    super('Token has expired');
    this.name = 'TokenExpiredError';
  }
}

export class InvalidTokenError extends Error {
  constructor() {
    super('Invalid token');
    this.name = 'InvalidTokenError';
  }
}

export class PasswordValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PasswordValidationError';
  }
}

export class CognitoError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'CognitoError';
  }
}

export class AuthService {
  private cognitoClient: CognitoIdentityProviderClient;
  private jwksClient: jwksClient.JwksClient;
  private userPoolId: string;
  private region: string;
  private clientId: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.userPoolId = process.env.AWS_USER_POOL_ID || '';
    this.clientId = process.env.AWS_CLIENT_ID || '';

    if (!this.userPoolId || !this.clientId) {
      throw new Error('Cognito configuration missing: USER_POOL_ID or CLIENT_ID not set');
    }

    this.cognitoClient = new CognitoIdentityProviderClient({
      region: this.region,
    });

    const jwksUri = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}/.well-known/jwks.json`;
    this.jwksClient = jwksClient({
      jwksUri,
      cache: true,
      cacheMaxAge: 600000,
    });
  }

  async verifyToken(token: string): Promise<CognitoUser> {
    try {
      const cleanToken = token.replace(/^Bearer\s+/i, '');
      const decodedHeader = jwt.decode(cleanToken, { complete: true });
      
      if (!decodedHeader || typeof decodedHeader === 'string') {
        throw new InvalidTokenError();
      }

      const kid = decodedHeader.header.kid;
      if (!kid) {
        throw new InvalidTokenError();
      }

      const key = await this.jwksClient.getSigningKey(kid);
      const signingKey = key.getPublicKey();

      const decoded = jwt.verify(cleanToken, signingKey, {
        algorithms: ['RS256'],
        issuer: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`,
      }) as CognitoUser;

      if (decoded.token_use !== 'id' && decoded.token_use !== 'access') {
        throw new InvalidTokenError();
      }

      return decoded;

    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new TokenExpiredError();
      }
      if (error.name === 'JsonWebTokenError') {
        throw new InvalidTokenError();
      }
      if (error instanceof TokenExpiredError || error instanceof InvalidTokenError) {
        throw error;
      }
      throw new TokenVerificationError(error.message || 'Token verification failed');
    }
  }

  async updateCognitoAttribute(userId: string, attributeName: string, value: string): Promise<void> {
    try {
      const command = new AdminUpdateUserAttributesCommand({
        UserPoolId: this.userPoolId,
        Username: userId,
        UserAttributes: [{ Name: attributeName, Value: value }],
      });
      await this.cognitoClient.send(command);
    } catch (error: any) {
      throw new CognitoError(`Failed to update Cognito attribute: ${error.message}`, error.name);
    }
  }

  async initiatePasswordReset(email: string): Promise<void> {
    try {
      const command = new ForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
      });
      await this.cognitoClient.send(command);
    } catch (error: any) {
      throw new CognitoError(`Failed to initiate password reset: ${error.message}`, error.name);
    }
  }

  async confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
    if (!isValidPassword(newPassword)) {
      throw new PasswordValidationError(
        'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character'
      );
    }

    try {
      const command = new ConfirmForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword,
      });
      await this.cognitoClient.send(command);
    } catch (error: any) {
      if (error.name === 'CodeMismatchException') {
        throw new CognitoError('Invalid or expired verification code', error.name);
      }
      if (error.name === 'ExpiredCodeException') {
        throw new CognitoError('Verification code has expired', error.name);
      }
      throw new CognitoError(`Failed to confirm password reset: ${error.message}`, error.name);
    }
  }

  async deleteUser(userId: string, email?: string): Promise<void> {
    try {
      console.log(`[AuthService.deleteUser] Deleting user from Cognito: ${userId}`);
      
      const command = new AdminDeleteUserCommand({
        UserPoolId: this.userPoolId,
        Username: userId,
      });
      
      await this.cognitoClient.send(command);
      console.log(`[AuthService.deleteUser] Successfully deleted user from Cognito: ${userId}`);
      
    } catch (error: any) {
      if (error.name === 'UserNotFoundException') {
        console.log(`[AuthService.deleteUser] User not found in Cognito (already deleted): ${userId}`);
        return;
      }
      console.error(`[AuthService.deleteUser] Failed to delete user from Cognito:`, error);
      throw new CognitoError(`Failed to delete user from Cognito: ${error.message}`, error.name);
    }
  }

  async getUser(userId: string): Promise<any> {
    try {
      const command = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: userId,
      });

      const response = await this.cognitoClient.send(command);
      
      const attributes: any = {};
      if (response.UserAttributes) {
        for (const attr of response.UserAttributes) {
          if (attr.Name && attr.Value) {
            attributes[attr.Name] = attr.Value;
          }
        }
      }

      return {
        username: response.Username,
        userStatus: response.UserStatus,
        enabled: response.Enabled,
        attributes,
      };
    } catch (error: any) {
      throw new CognitoError(`Failed to get user from Cognito: ${error.message}`, error.name);
    }
  }

  async getUserIdFromToken(token: string): Promise<string> {
    const user = await this.verifyToken(token);
    return user.sub;
  }
}

let authServiceInstance: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService();
  }
  return authServiceInstance;
}
