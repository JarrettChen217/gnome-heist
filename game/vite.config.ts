// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7).
import { defineConfig } from 'vite';

export default defineConfig({
  // Tiled maps are loaded as files (Phaser's Tiled loader), not bundled as code.
  assetsInclude: ['**/*.tmj'],
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
});
