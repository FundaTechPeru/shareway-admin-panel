import express, {type Router} from 'express';
import type {PanelDependencies} from '../dependencies.js';
import {sendError} from '../http-errors.js';
import {ADMIN_ROLE, readClaims} from '../middleware/auth.js';

interface Credentials {
  email?: unknown;
  password?: unknown;
}

/**
 * Sign in of the panel. The credentials travel to the gateway, which answers with the token of
 * Driver Management; the panel keeps nothing. A token that does not belong to staff is refused
 * here, so the console never opens for a passenger or a driver.
 */
export function loginRouter(deps: PanelDependencies): Router {
  const router = express.Router();
  router.post('/login', async (req, res) => {
    const {email, password} = (req.body ?? {}) as Credentials;
    if (typeof email !== 'string' || typeof password !== 'string') {
      sendError(req, res, 400, 'Enter your email and your password');
      return;
    }
    const answer = await deps.gateway.call({
      method: 'POST',
      path: '/api/v1/auth/login',
      body: {email, password},
    });
    if (answer.status !== 200) {
      res.status(answer.status).json(answer.body);
      return;
    }
    const token = readToken(answer.body);
    if (!token) {
      sendError(req, res, 502, 'The gateway answered a login without a token');
      return;
    }
    const claims = readClaims(token);
    if (!claims || typeof claims.sub !== 'string') {
      sendError(req, res, 502, 'The gateway answered an unreadable token');
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
    res.json({
      token,
      admin: {
        id: claims.sub,
        email: typeof claims.email === 'string' ? claims.email : email,
        role: claims.role,
      },
    });
  });
  return router;
}

/** Driver Management names it "token"; its older builds answered "accessToken". */
function readToken(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }
  const answer = body as {token?: unknown; accessToken?: unknown};
  if (typeof answer.token === 'string' && answer.token.length > 0) {
    return answer.token;
  }
  if (typeof answer.accessToken === 'string' && answer.accessToken.length > 0) {
    return answer.accessToken;
  }
  return undefined;
}
