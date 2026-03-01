import { Request } from 'express';

export type AuthUser = {
  sub: string;
  tenantId: string;
  role: string;
  sid?: string;
  tenantRole?: string;
  isAdmin?: boolean;
  email?: string;
  permissions?: string[];
};

export type JwtAuthRequest = Request & {
  user: AuthUser;
};
