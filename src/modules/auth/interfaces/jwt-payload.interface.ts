import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email?: string;
  phone?: string;
  role: Role;
  type: 'access' | 'refresh';
  jti?: string;
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  phone?: string;
  role: Role;
}
