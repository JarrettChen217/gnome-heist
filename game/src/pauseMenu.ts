// AI-use disclosure: Codex built the keyboard-accessible pause controls under Hao's direction.
import './pauseMenu.css';

export class PauseMenu {
  private readonly dialog = document.createElement('dialog');
  private readonly volumeInput: HTMLInputElement;
  private readonly percentage: HTMLOutputElement;

  constructor(resume: () => void, restart: () => void, changeVolume: (value: number) => void, initialVolume: number) {
    this.dialog.className = 'farm-pause';
    this.dialog.setAttribute('aria-labelledby', 'farm-pause-title');
    this.dialog.innerHTML = `
      <h1 id="farm-pause-title">Paused</h1>
      <button type="button" data-resume autofocus>Resume</button>
      <details>
        <summary>Controls</summary>
        <p><kbd>WASD</kbd> or arrow keys to walk.<br>Hold <kbd>E</kbd> beside an object to act.<br>Press <kbd>E</kbd> inside a dog hole to leave.<br><kbd>Esc</kbd> to pause or resume.</p>
      </details>
      <label>Sound volume <output></output><input aria-label="Sound volume" type="range" min="0" max="100" step="5"></label>
      <button type="button" data-restart>Restart this night</button>`;
    this.dialog.querySelector('[data-resume]')!.addEventListener('click', resume);
    this.dialog.querySelector('[data-restart]')!.addEventListener('click', restart);
    this.volumeInput = this.dialog.querySelector('input')!;
    this.percentage = this.dialog.querySelector('output')!;
    this.volumeInput.value = String(Math.round(initialVolume * 100));
    this.percentage.value = this.volumeInput.value + '%';
    this.volumeInput.addEventListener('input', () => {
      this.percentage.value = this.volumeInput.value + '%';
      changeVolume(this.volumeInput.valueAsNumber / 100);
    });
    // Night handles Esc for both opening and closing, including while this dialog has focus.
    this.dialog.addEventListener('cancel', (event) => event.preventDefault());
    // Let native buttons, disclosure and slider own their keyboard input. Phaser listens on window.
    this.dialog.addEventListener('keydown', (event) => {
      if (['Tab', 'Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) event.stopPropagation();
    });
    document.body.append(this.dialog);
  }

  setVisible(show: boolean): void {
    if (show === this.dialog.open) return;
    if (show) {
      this.dialog.querySelector('details')!.open = false;
      this.dialog.showModal();
    } else this.dialog.close();
  }

  destroy(): void {
    this.dialog.remove();
  }
}
