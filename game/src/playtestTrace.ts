// AI-use disclosure: Codex implemented the local playtest trace at Hao's request.
import type { NightEvent, Tile } from '@gnome-heist/core';

export class PlaytestTrace {
  private events: object[] = [];
  private lastTile: Tile | null = null;
  private started = new Date();
  private readonly button = document.createElement('button');

  constructor(private readonly mapVersion: string) {
    this.button.textContent = 'Save playtest trace';
    this.button.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:4';
    this.button.onclick = () => this.save();
    document.body.append(this.button);
  }

  reset(): void {
    this.events = [];
    this.started = new Date();
    this.lastTile = null;
  }

  record(event: object): void {
    this.events.push(event);
  }

  enter(night: number, entrance: string, tile: Tile): void {
    this.record({ type: 'enter', night, entrance });
    this.lastTile = null;
    this.move(tile);
  }

  move(tile: Tile): void {
    if (tile.x === this.lastTile?.x && tile.y === this.lastTile.y) return;
    this.lastTile = tile;
    this.record({ type: 'tile', ...tile });
  }

  observe(event: NightEvent): void {
    if (event.type === 'footprint' || event.type === 'action' || event.type === 'spotted') this.record(event);
  }

  private save(): void {
    const started = this.started.toISOString();
    const data = { version: 1, mapVersion: this.mapVersion, started, events: this.events };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gnome-heist-' + started.replace(/:/g, '-') + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  destroy(): void {
    this.button.remove();
  }
}
