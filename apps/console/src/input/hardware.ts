import type { Button } from '@gamebovh/sdk';
import type { InputBus } from '@gamebovh/sdk/runtime';

/**
 * Clavier :
 *   flèches ou WASD / ZQSD : croix
 *   X, K ou Espace : A        Z, J ou C : B
 *   Entrée : Start            Maj ou Retour arrière : Select
 *   Échap : menu pause de la console
 */
const KEYMAP: Record<string, Button> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyX: 'a',
  KeyK: 'a',
  Space: 'a',
  KeyZ: 'b',
  KeyJ: 'b',
  KeyC: 'b',
  Enter: 'start',
  NumpadEnter: 'start',
  ShiftLeft: 'select',
  ShiftRight: 'select',
  Backspace: 'select',
};

/* Sur un clavier AZERTY, `code` donne la position physique : KeyW = touche Z, KeyA = touche Q.
   Les deux dispositions fonctionnent donc sans réglage. */

export function attachKeyboard(bus: InputBus, onMenu: () => void): () => void {
  const down = (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      e.preventDefault();
      onMenu();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const button = KEYMAP[e.code];
    if (!button) return;
    e.preventDefault();
    if (!e.repeat) bus.press(button, `kbd:${e.code}`);
  };
  const up = (e: KeyboardEvent) => {
    const button = KEYMAP[e.code];
    if (button) bus.release(button, `kbd:${e.code}`);
  };
  const blur = () => {
    for (const code of Object.keys(KEYMAP)) bus.release(KEYMAP[code], `kbd:${code}`);
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
  };
}

/** Manettes (disposition "standard" de l'API Gamepad). */
const PAD_BUTTONS: [number, Button][] = [
  [0, 'a'],
  [1, 'b'],
  [2, 'b'],
  [3, 'a'],
  [9, 'start'],
  [8, 'select'],
  [12, 'up'],
  [13, 'down'],
  [14, 'left'],
  [15, 'right'],
];

export function attachGamepads(bus: InputBus, onMenu: () => void): () => void {
  let frame = 0;
  const held = new Map<string, boolean>();
  const set = (key: string, button: Button, pressed: boolean) => {
    if (held.get(key) === pressed) return;
    held.set(key, pressed);
    if (pressed) bus.press(button, key);
    else bus.release(button, key);
  };
  const poll = () => {
    frame = requestAnimationFrame(poll);
    for (const pad of navigator.getGamepads?.() ?? []) {
      if (!pad) continue;
      const p = `pad${pad.index}`;
      for (const [index, button] of PAD_BUTTONS) {
        set(`${p}:b${index}`, button, !!pad.buttons[index]?.pressed);
      }
      const [x = 0, y = 0] = pad.axes;
      set(`${p}:ax-l`, 'left', x < -0.5);
      set(`${p}:ax-r`, 'right', x > 0.5);
      set(`${p}:ax-u`, 'up', y < -0.5);
      set(`${p}:ax-d`, 'down', y > 0.5);
      const home = !!pad.buttons[16]?.pressed;
      if (home && !held.get(`${p}:home`)) onMenu();
      held.set(`${p}:home`, home);
    }
  };
  const start = () => {
    if (!frame) frame = requestAnimationFrame(poll);
  };
  window.addEventListener('gamepadconnected', start);
  if ((navigator.getGamepads?.() ?? []).some(Boolean)) start();
  return () => {
    window.removeEventListener('gamepadconnected', start);
    cancelAnimationFrame(frame);
  };
}

/** Start + Select maintenus 1 seconde : menu pause de la console. */
export function watchMenuCombo(bus: InputBus, onMenu: () => void, holdMs = 1000): () => void {
  let timer: number | null = null;
  const check = () => {
    const both = bus.isDown('start') && bus.isDown('select');
    if (both && timer === null) {
      timer = window.setTimeout(() => {
        timer = null;
        onMenu();
      }, holdMs);
    } else if (!both && timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };
  const a = bus.onPress(check);
  const b = bus.onRelease(check);
  return () => {
    a();
    b();
    if (timer !== null) window.clearTimeout(timer);
  };
}

/** A + B + Start + Select enfoncés ensemble : redémarrage de la console (comme le « soft reset » d'époque). */
export function watchResetCombo(bus: InputBus, onReset: () => void): () => void {
  let armed = true;
  const all = () => bus.isDown('a') && bus.isDown('b') && bus.isDown('start') && bus.isDown('select');
  const a = bus.onPress(() => {
    if (armed && all()) {
      armed = false;
      onReset();
    }
  });
  const b = bus.onRelease(() => {
    if (!all()) armed = true;
  });
  return () => {
    a();
    b();
  };
}
