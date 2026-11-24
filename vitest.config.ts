// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7, T11a).
// Codex added the client placement test project under Hao's direction.
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { projects: ['core', 'game', 'worker'] } });
