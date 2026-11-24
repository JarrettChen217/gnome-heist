// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T11a).
// Worker tests run inside the Workers runtime (workerd) through Cloudflare's Vitest integration.
import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    // Wrangler bundles .tmj as text (wrangler.jsonc `rules`); Vite needs the same in tests.
    {
      name: 'tmj-as-text',
      transform(code, id) {
        if (id.endsWith('.tmj')) return { code: `export default ${JSON.stringify(code)};`, map: null };
        return undefined;
      },
    },
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: { bindings: { FARMER_PROVIDER: '', ANTHROPIC_API_KEY: '' } },
    }),
  ],
  test: { name: 'worker', include: ['test/**/*.test.ts'] },
});
