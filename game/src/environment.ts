// AI-use disclosure: Codex wired the original farm environment assets under Hao's direction.
import type { Scene } from 'phaser';

const props = import.meta.glob<string>('./assets/environment/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
});

export function preloadEnvironment(scene: Scene): void {
  for (const [path, url] of Object.entries(props)) {
    scene.load.image(path.slice(path.lastIndexOf('/') + 1, -4), url);
  }
}
