import type {RequestHandler, Response} from 'express';
import {sendError} from '../http-errors.js';

/** The admin the access token belongs to, as the panel reads it. */
export interface AdminUser {
  id: string;
  email?: string;
  role: string;
  /** The token itself, forwarded to the gateway on every call made for this admin. */
  token: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      admin?: AdminUser;
    }
  }
}

export const ADMIN_ROLE = 'ADMIN';

/**
 * Lets only a staff token through to the panel API.
 *
 * The signature is not checked here: the token is issued and validated by Driver Management and
 * the gateway, which hold the secret, and every call the panel makes carries it, so a forged
 * token is rejected one hop later. The claims are read to know whose name goes in the audit trail
 * and to answer a non-staff login with a clear message instead of a 403 from a service.
 */
export function requireAdmin(): RequestHandler {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      sendError(
        req,
        res,
        401,
        'Authentication is required to access this resource',
      );
      return;
    }
    const token = header.slice('Bearer '.length).trim();
    const claims = readClaims(token);
    if (!claims || typeof claims.sub !== 'string' || !claims.sub) {
      sendError(req, res, 401, 'Invalid or expired token');
      return;
    }
    if (claims.role !== ADMIN_ROLE) {
      sendError(
        req,
        res,
        403,
        'Only ShareWay staff can use the administration panel',
      );
      return;
    }
    res.locals.admin = {
      id: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : undefined,
      role: claims.role,
      token,
    };
    next();
  };
}

/** Claims of a token, without checking its signature; undefined when it is not a JWT. */
export function readClaims(token: string): Record<string, unknown> | undefined {
  const payload = token.split('.')[1];
  if (!payload) {
    return undefined;
  }
  try {
    const claims: unknown = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    );
    if (typeof claims !== 'object' || claims === null) {
      return undefined;
    }
    return claims as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** The admin of the request; only called from routes that sit behind requireAdmin. */
export function admin(res: Response): AdminUser {
  const user = res.locals.admin;
  if (!user) {
    throw new Error('The route is not behind requireAdmin');
  }
  return user;
}
