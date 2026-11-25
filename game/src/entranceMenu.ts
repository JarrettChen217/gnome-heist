// AI-use disclosure: Codex built the entrance selector and its input handling under Hao's direction.
import { PLAYTEST_NIGHT_LIMIT } from '@gnome-heist/core';
import './entranceMenu.css';

export class EntranceMenu {
  private readonly root = document.createElement('section');
  private readonly list: HTMLElement;
  private readonly night: HTMLElement;
  private selected = 0;
  private open = false;
  private buttons: HTMLButtonElement[] = [];

  constructor(private readonly choose: (id: string) => void) {
    this.root.className = 'entrance-menu';
    this.root.inert = true;
    this.root.setAttribute('aria-labelledby', 'entrance-title');
    this.root.innerHTML = `
      <div class="entrance-content">
        <h1 id="entrance-title">Gnome Heist</h1>
        <div class="entrance-card">
          <span class="entrance-night"></span>
          <h2 id="entrance-heading">Choose an entrance</h2>
          <div class="entrance-options" role="group" aria-labelledby="entrance-heading"></div>
          <p class="entrance-keys"><kbd>↑</kbd><kbd>↓</kbd> Choose <span><kbd>Enter</kbd> Confirm</span></p>
        </div>
      </div>`;
    this.list = this.root.querySelector('.entrance-options')!;
    this.night = this.root.querySelector('.entrance-night')!;
    document.body.append(this.root);
    window.addEventListener('keydown', this.navigate, true);
  }

  private focus(index: number): void {
    if (!this.open) return;
    this.buttons[this.selected]?.classList.remove('current');
    this.selected = index;
    const button = this.buttons[index]!;
    button.classList.add('current');
    if (document.activeElement !== button) button.focus({ preventScroll: true });
  }

  private readonly navigate = (event: KeyboardEvent): void => {
    if (!this.open || event.altKey || event.ctrlKey || event.metaKey) return;
    const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (!step && event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (step) this.focus((this.selected + step + this.buttons.length) % this.buttons.length);
    else if (!event.repeat) this.buttons[this.selected]?.click();
  };

  setVisible(open: boolean, night: number, holes: readonly string[]): void {
    if (open === this.open) return;
    this.open = open;
    this.root.inert = !open;
    this.root.classList.toggle('open', open);
    if (!open) return;
    this.night.textContent = `Night ${night} of ${PLAYTEST_NIGHT_LIMIT}`;
    this.buttons = holes.map((id, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      const direction = id.replace(/^hole_/, '').replaceAll('_', ' ');
      button.textContent = direction.charAt(0).toUpperCase() + direction.slice(1) + ' hedge';
      button.addEventListener('focus', () => this.focus(index));
      button.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'mouse') this.focus(index);
      });
      button.addEventListener('click', () => { if (this.open) this.choose(id); });
      return button;
    });
    this.list.replaceChildren(...this.buttons);
    this.focus(0);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.navigate, true);
    this.root.remove();
  }
}
