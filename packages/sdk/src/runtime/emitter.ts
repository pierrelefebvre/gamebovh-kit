import type { Unsubscribe } from '../contract.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyListener = (...args: any[]) => void;

/** Petit émetteur d'événements typé. */
export class Emitter<Events extends Record<string, unknown[]>> {
  private listeners = new Map<keyof Events, Set<AnyListener>>();

  on<K extends keyof Events>(event: K, cb: (...args: Events[K]) => void): Unsubscribe {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(cb);
    return () => set!.delete(cb);
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of [...set]) {
      try {
        cb(...args);
      } catch (error) {
        console.error(`[gamebovh] listener for "${String(event)}" threw`, error);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

/** Regroupe des désabonnements pour tout nettoyer d'un coup (fin de partie). */
export class Subscriptions {
  private items = new Set<Unsubscribe>();

  add(unsub: Unsubscribe): Unsubscribe {
    this.items.add(unsub);
    return () => {
      unsub();
      this.items.delete(unsub);
    };
  }

  disposeAll(): void {
    for (const unsub of this.items) unsub();
    this.items.clear();
  }
}
