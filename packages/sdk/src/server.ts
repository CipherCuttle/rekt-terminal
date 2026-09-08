import {createInkubatorClient} from './index.js';

export function createInkubatorServerClientFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const accessToken = env.REKT_DEVKIT_TOKEN;
  if (!accessToken) throw new Error('REKT_DEVKIT_TOKEN is required');
  const baseUrl = env.REKT_API_URL ?? 'http://127.0.0.1:8787';
  return createInkubatorClient({baseUrl, accessToken});
}
