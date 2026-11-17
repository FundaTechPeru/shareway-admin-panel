import express, {type Router} from 'express';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import type {Logger} from './logger.js';

/**
 * Serves the built SPA when this process also ships the user interface, which is how the panel
 * runs in production: one container with the BFF and the Angular build next to it. Every path
 * that is not part of the panel API falls back to index.html, so the router of the SPA answers
 * a reload on /liquidaciones. During development the Angular dev server serves the SPA instead
 * and this router is not installed.
 */
export function spaRouter(webRoot: string, logger: Logger): Router | undefined {
  const root = resolve(webRoot);
  const index = resolve(root, 'index.html');
  if (!existsSync(index)) {
    logger.debug({webRoot: root}, 'no SPA build to serve');
    return undefined;
  }
  const router = express.Router();
  router.use(express.static(root, {index: false, maxAge: '1h'}));
  router.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/panel-api/')) {
      next();
      return;
    }
    res.sendFile(index);
  });
  logger.info({webRoot: root}, 'serving the panel user interface');
  return router;
}
