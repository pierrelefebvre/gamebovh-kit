/**
 * SLALOM EXPRESS : jeu de démonstration multijoueur (1 à 4 joueurs).
 *
 * Ce qu'il montre aux étudiants :
 *  - une boucle de jeu sur canvas (useGameLoop + useCanvas) ;
 *  - une piste identique pour tous grâce à ctx.seed ;
 *  - des messages typés (SlalomMsg) pour voir les autres skieurs en direct ;
 *  - la fin de partie (gameOver) et l'échange de scores (useScoreGossip).
 */
import { useRef } from 'react';
import {
  drawText,
  formatTime,
  PALETTE,
  PLAYER_COLORS,
  useCanvas,
  useGameLoop,
  useMessages,
  useRoomPlayers,
  useScoreGossip,
  type GameProps,
  defineTexts,
} from '@gamebovh/sdk';
import { GATE_WIDTH, generateCourse } from './course.ts';
import { drawFlag, drawOffscreenMarker, drawSkier, drawTree, type Pose } from './sprites.ts';

/* ---------- Messages échangés entre joueurs ---------- */

export type SlalomMsg =
  /** Ma position, envoyée ~14 fois par seconde. */
  | { type: 'pos'; x: number; y: number; pose: Pose }
  /** J'ai passé la ligne d'arrivée. */
  | { type: 'finish'; timeMs: number; missed: number };

/* ---------- Réglages ---------- */

const SKIER_SCREEN_Y = 64; // le skieur reste à cette hauteur, la piste défile
const COUNTDOWN_MS = 3000;
const MISSED_GATE_PENALTY_MS = 3000;
const CRASH_MS = 900;
const SEND_EVERY_MS = 70;
const SPEED = { normal: 0.1, tuck: 0.14, brake: 0.04 }; // pixels par milliseconde
const STEER_SPEED = 0.085;
const WAIT_OTHERS_MS = 20000; // attente max des autres après mon arrivée
const BLUE = '#2b59c3';
const TRACK = '#cfe0f1';

interface Ghost {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  pose: Pose;
  finishMs: number | null;
}

const TEXTS = defineTexts({
  fr: {
    missed: 'RATÉE +3s',
    ouch: 'AÏE !',
    gate: (n: number, total: number) => `PORTE ${n}/${total}`,
    go: 'PARTEZ !',
    controls: 'A : SCHUSS  B : FREIN',
    finish: 'ARRIVÉE !',
    missedCount: (n: number) => `${n} porte(s) ratée(s)`,
  },
  en: {
    missed: 'MISSED +3s',
    ouch: 'OUCH!',
    gate: (n: number, total: number) => `GATE ${n}/${total}`,
    go: 'GO!',
    controls: 'A: TUCK  B: BRAKE',
    finish: 'FINISH!',
    missedCount: (n: number) => `${n} gate(s) missed`,
  },
});

export function Slalom({ ctx }: GameProps<SlalomMsg>) {
  const t = TEXTS[ctx.lang];
  const { width, height } = ctx.screen;
  const { canvasProps, get2d } = useCanvas(ctx);
  const players = useRoomPlayers(ctx);
  const { share } = useScoreGossip(ctx);

  // La piste ne change pas pendant la partie : calculée une seule fois.
  const course = useRef(generateCourse(ctx.seed)).current;

  // Tout l'état du jeu (modifié 60 fois par seconde, sans re-rendu React).
  const s = useRef({
    phase: 'countdown' as 'countdown' | 'race' | 'finished',
    countdown: COUNTDOWN_MS,
    lastBeep: 4,
    x: width / 2,
    y: 0,
    vx: 0,
    speed: 0,
    pose: 'straight' as Pose,
    crash: 0,
    elapsed: 0,
    penalty: 0,
    gate: 0,
    missed: 0,
    flash: { text: '', ms: 0 },
    trail: [] as { x: number; y: number }[],
    sendIn: 0,
    finishMs: null as number | null,
    sinceFinish: 0,
    over: false,
    ghosts: new Map<string, Ghost>(),
  }).current;

  // Les joueurs de la salle, lus dans la boucle de jeu.
  const playersRef = useRef(players);
  playersRef.current = players;

  /* ----- Réception des messages des autres joueurs ----- */
  useMessages(ctx, (msg, from) => {
    let ghost = s.ghosts.get(from.id);
    if (!ghost) {
      ghost = { x: width / 2, y: 0, targetX: width / 2, targetY: 0, pose: 'straight', finishMs: null };
      s.ghosts.set(from.id, ghost);
    }
    if (msg.type === 'pos') {
      if (ghost.targetY === 0) {
        ghost.x = msg.x;
        ghost.y = msg.y;
      }
      ghost.targetX = msg.x;
      ghost.targetY = msg.y;
      ghost.pose = msg.pose;
    } else if (msg.type === 'finish') {
      ghost.finishMs = msg.timeMs;
    }
  });

  const flash = (text: string) => {
    s.flash = { text, ms: 1200 };
  };

  const finishGame = () => {
    s.over = true;
    const myTime = s.finishMs ?? 0;
    const inRoom = ctx.multiplayer.room !== null;
    let outcome: 'win' | 'lose' | undefined;
    if (inRoom) {
      const better = [...s.ghosts.values()].filter((g) => g.finishMs !== null && g.finishMs < myTime).length;
      outcome = better === 0 ? 'win' : 'lose';
    }
    void ctx.lifecycle
      .gameOver({ score: myTime, display: formatTime(myTime), outcome })
      .then(() => share()); // diffuse mon nouveau score aux autres
  };

  /* ----- La boucle de jeu ----- */
  useGameLoop(ctx, (dt) => {
    const input = ctx.input;

    // 1. Compte à rebours
    if (s.phase === 'countdown') {
      s.countdown -= dt;
      const n = Math.ceil(s.countdown / 1000);
      if (n < s.lastBeep) {
        s.lastBeep = n;
        ctx.audio.play(n > 0 ? 'countdown' : 'go');
      }
      if (s.countdown <= 0) s.phase = 'race';
    }

    // 2. Déplacement du skieur
    if (s.phase !== 'countdown') {
      if (s.phase === 'race') s.elapsed += dt;
      const steer = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
      const tuck = input.isDown('a') || input.isDown('up');
      const brake = input.isDown('b') || input.isDown('down');

      if (s.crash > 0) {
        s.crash -= dt;
        s.speed = 0;
        s.vx = 0;
        s.pose = 'crash';
      } else {
        let target = s.phase === 'finished' ? 0 : tuck ? SPEED.tuck : brake ? SPEED.brake : SPEED.normal;
        if (steer !== 0 && !tuck) target *= 0.92;
        s.speed += (target - s.speed) * Math.min(1, dt * 0.0016);
        s.vx += (steer * STEER_SPEED - s.vx) * Math.min(1, dt * 0.012);
        s.pose = steer < 0 ? 'left' : steer > 0 ? 'right' : tuck ? 'tuck' : 'straight';
      }
      s.x = Math.max(10, Math.min(width - 10, s.x + s.vx * dt));
      s.y += s.speed * dt;

      // Traces de skis
      const last = s.trail[s.trail.length - 1];
      if (!last || s.y - last.y > 3) s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 80) s.trail.shift();
    }

    // 3. Portes : passées entre les deux piquets, ou ratées (+3 s)
    while (s.phase === 'race' && s.gate < course.gates.length && s.y >= course.gates[s.gate].y) {
      const gate = course.gates[s.gate];
      if (Math.abs(s.x - gate.x) <= GATE_WIDTH / 2) {
        ctx.audio.play('coin');
      } else {
        s.missed++;
        s.penalty += MISSED_GATE_PENALTY_MS;
        flash(t.missed);
        ctx.audio.play('back');
        ctx.audio.vibrate(80);
      }
      s.gate++;
    }

    // 4. Sapins : on tombe si on en touche un
    if (s.crash <= 0 && s.speed > 0.02) {
      for (const tree of course.trees) {
        if (Math.abs(tree.y - s.y) < 5 && Math.abs(tree.x - s.x) < tree.size / 2 + 2) {
          s.crash = CRASH_MS;
          flash(t.ouch);
          ctx.audio.play('hit');
          ctx.audio.vibrate([60, 40, 60]);
          break;
        }
      }
    }

    // 5. Arrivée
    if (s.phase === 'race' && s.y >= course.finishY) {
      s.phase = 'finished';
      s.finishMs = Math.round(s.elapsed + s.penalty);
      ctx.audio.play('win');
      ctx.multiplayer.send({ type: 'finish', timeMs: s.finishMs, missed: s.missed });
    }

    // 6. Fin de partie : seul, tout de suite ; à plusieurs, quand tout le monde est arrivé
    if (s.phase === 'finished' && !s.over) {
      s.sinceFinish += dt;
      const others = playersRef.current.filter((p) => !p.isMe);
      const allDone = others.every((p) => s.ghosts.get(p.id)?.finishMs != null);
      if ((others.length === 0 && s.sinceFinish > 1500) || (others.length > 0 && allDone && s.sinceFinish > 1500) || s.sinceFinish > WAIT_OTHERS_MS) {
        finishGame();
      }
    }

    // 7. Envoi de ma position aux autres
    s.sendIn -= dt;
    if (s.sendIn <= 0 && ctx.multiplayer.room) {
      s.sendIn = SEND_EVERY_MS;
      ctx.multiplayer.send({ type: 'pos', x: Math.round(s.x), y: Math.round(s.y), pose: s.pose });
    }

    // Les fantômes glissent doucement vers leur dernière position connue
    for (const g of s.ghosts.values()) {
      const k = Math.min(1, dt * 0.015);
      g.x += (g.targetX - g.x) * k;
      g.y += (g.targetY - g.y) * k;
    }
    if (s.flash.ms > 0) s.flash.ms -= dt;

    draw();
  });

  /* ----- Dessin ----- */
  function draw() {
    const g = get2d();
    if (!g) return;
    const camY = s.y - SKIER_SCREEN_Y;
    const toScreen = (worldY: number) => worldY - camY;
    const visible = (worldY: number) => worldY > camY - 20 && worldY < camY + height + 20;
    const me = playersRef.current.find((p) => p.isMe);
    const myColor = PLAYER_COLORS[me?.slot ?? 0];

    // Neige
    g.fillStyle = PALETTE.snow;
    g.fillRect(0, 0, width, height);

    // Traces de skis
    g.fillStyle = TRACK;
    for (const p of s.trail) {
      const sy = toScreen(p.y);
      g.fillRect(Math.round(p.x) - 3, Math.round(sy), 1, 3);
      g.fillRect(Math.round(p.x) + 3, Math.round(sy), 1, 3);
    }

    // Ligne d'arrivée (damier)
    if (visible(course.finishY)) {
      const fy = Math.round(toScreen(course.finishY));
      for (let i = 0; i < width / 6; i++) {
        g.fillStyle = i % 2 === 0 ? PALETTE.night : PALETTE.snow;
        g.fillRect(i * 6, fy, 6, 3);
        g.fillStyle = i % 2 === 1 ? PALETTE.night : PALETTE.snow;
        g.fillRect(i * 6, fy + 3, 6, 3);
      }
    }

    // Portes
    course.gates.forEach((gate, i) => {
      if (!visible(gate.y)) return;
      const sy = toScreen(gate.y);
      const color = gate.color === 'red' ? PALETTE.red : BLUE;
      const passed = i < s.gate;
      g.globalAlpha = passed ? 0.4 : 1;
      drawFlag(g, gate.x - GATE_WIDTH / 2, sy, color, 'left');
      drawFlag(g, gate.x + GATE_WIDTH / 2, sy, color, 'right');
      g.globalAlpha = 1;
    });

    // Sapins
    for (const tree of course.trees) {
      if (visible(tree.y)) drawTree(g, tree.x, toScreen(tree.y), tree.size);
    }

    // Les autres skieurs
    for (const p of playersRef.current) {
      if (p.isMe) continue;
      const ghost = s.ghosts.get(p.id);
      if (!ghost) continue;
      const sy = toScreen(ghost.y);
      const color = PLAYER_COLORS[p.slot];
      if (sy < 14) drawOffscreenMarker(g, ghost.x, true, color, height);
      else if (sy > height) drawOffscreenMarker(g, ghost.x, false, color, height);
      else drawSkier(g, ghost.x, sy, ghost.pose, color, 0.8);
    }

    // Moi
    drawSkier(g, s.x, SKIER_SCREEN_Y, s.pose, myColor);

    // Barre du haut : chrono et portes
    g.fillStyle = PALETTE.night;
    g.fillRect(0, 0, width, 12);
    const shownTime = s.finishMs ?? s.elapsed + s.penalty;
    drawText(g, formatTime(shownTime), 3, 2, { color: PALETTE.snow });
    drawText(g, t.gate(Math.min(s.gate, course.gates.length), course.gates.length), width - 3, 2, {
      color: PALETTE.gold,
      align: 'right',
    });

    // Message ponctuel (porte ratée, chute)
    if (s.flash.ms > 0) {
      drawText(g, s.flash.text, width / 2, 92, { color: PALETTE.red, align: 'center', shadow: PALETTE.snow });
    }

    // Compte à rebours
    if (s.phase === 'countdown') {
      const n = Math.ceil(s.countdown / 1000);
      drawText(g, n > 0 ? String(n) : t.go, width / 2, 100, { size: 16, color: PALETTE.red, align: 'center', shadow: PALETTE.night });
      drawText(g, t.controls, width / 2, 130, { color: PALETTE.night, align: 'center' });
    }

    // Arrivée : classement de la manche
    if (s.phase === 'finished') drawBoard(g);
  }

  function drawBoard(g: CanvasRenderingContext2D) {
    const rows = playersRef.current.length
      ? playersRef.current.map((p) => ({
          name: p.nickname,
          color: PLAYER_COLORS[p.slot],
          time: p.isMe ? s.finishMs : (s.ghosts.get(p.id)?.finishMs ?? null),
        }))
      : [{ name: ctx.player.nickname, color: PLAYER_COLORS[0], time: s.finishMs }];
    rows.sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));

    const top = 100;
    g.fillStyle = 'rgba(11, 30, 63, 0.88)';
    g.fillRect(30, top, width - 60, 22 + rows.length * 12);
    drawText(g, t.finish, width / 2, top + 5, { color: PALETTE.gold, align: 'center' });
    rows.forEach((r, i) => {
      const y = top + 18 + i * 12;
      g.fillStyle = r.color;
      g.fillRect(36, y, 6, 6);
      drawText(g, r.name.slice(0, 8), 46, y, { color: PALETTE.snow });
      drawText(g, r.time === null ? '...' : formatTime(r.time), width - 36, y, { color: PALETTE.snow, align: 'right' });
    });
    if (s.missed) {
      drawText(g, t.missedCount(s.missed), width / 2, top + 26 + rows.length * 12, {
        color: PALETTE.ice,
        align: 'center',
      });
    }
  }

  return <canvas {...canvasProps} />;
}
