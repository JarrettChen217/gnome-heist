// AI-use disclosure: Codex configured client placement tests under Hao's direction for the M0 review fixes.
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { name: 'game', include: ['test/**/*.test.ts'], environment: 'node' } });
