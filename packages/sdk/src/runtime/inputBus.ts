import { BUTTONS, type Button, type ButtonState } from '../contract.ts';
import { Emitter } from './emitter.ts';

type Events = { press: [Button]; release: [Button] };

/**
 * Source unique des entrées de la console.
 * Plusieurs sources (clavier, tactile, manette) peuvent tenir le même bouton :
 * il reste enfoncé tant qu'au moins une source le tient.
 */
export class InputBus {
  private readonly holders = new Map<Button, Set<string>>();
  private readonly events = new Emitter<Events>();

  constructor() {
    for (const b of BUTTONS) this.holders.set(b, new Set());
  }

  press(button: Button, source = 'default'): void {
    const set = this.holders.get(button)!;
    const wasDown = set.size > 0;
    set.add(source);
    if (!wasDown) this.events.emit('press', button);
  }

  release(button: Button, source = 'default'): void {
    const set = this.holders.get(button)!;
    if (!set.delete(source)) return;
    if (set.size === 0) this.events.emit('release', button);
  }

  /** Relâche tout ce qu'une source tient (ou tout, sans argument). */
  releaseAll(source?: string): void {
    for (const b of BUTTONS) {
      if (source) this.release(b, source);
      else for (const s of [...this.holders.get(b)!]) this.release(b, s);
    }
  }

  isDown(button: Button): boolean {
    return this.holders.get(button)!.size > 0;
  }

  snapshot(): ButtonState {
    const state = {} as Record<Button, boolean>;
    for (const b of BUTTONS) state[b] = this.isDown(b);
    return state;
  }

  onPress(cb: (button: Button) => void) {
    return this.events.on('press', cb);
  }

  onRelease(cb: (button: Button) => void) {
    return this.events.on('release', cb);
  }
}
