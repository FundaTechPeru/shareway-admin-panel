import type {Express} from 'express';
import {createApp} from '../src/app.js';
import {loadConfig, type PanelConfig} from '../src/config.js';

export const GATEWAY_URL = 'https://gateway.shareway.test';

export function testConfig(env: NodeJS.ProcessEnv = {}): PanelConfig {
  return loadConfig({
    GATEWAY_URL,
    DB_FILE: ':memory:',
    WEB_ROOT: './does-not-exist',
    LOG_LEVEL: 'silent',
    ...env,
  });
}

export function testApp(env: NodeJS.ProcessEnv = {}): Express {
  return createApp(testConfig(env));
}
