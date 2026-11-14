// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7).
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { name: 'core', include: ['test/**/*.test.ts'], environment: 'node' } });
