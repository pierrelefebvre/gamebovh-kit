/**
 * BATAILLE DE BOULES DE NEIGE : jeu de démonstration en équipes (2 contre 2).
 *
 * Ce qu'il montre aux étudiants :
 *  - des équipes calculées à partir de la place dans la salle (slot) ;
 *  - des événements réseau ponctuels (lancer, touche) en plus de la position ;
 *  - une règle simple d'arbitrage sans serveur : chaque joueur décide lui-même
 *    s'il a été touché, et prévient les autres (triche possible, c'est assumé) ;
 *  - un mode entraînement en solo contre un petit robot.
 */
import { useRef } from 'react';
import {
  drawText,
  PALETTE,
  useButton,
  useCanvas,
  useGameLoop,
  useMessages,
  useRoomPlayers,
  useScoreGossip,
  type GameProps,
  type Slot,
  defineTexts,
} from '@gamebovh/sdk';
import {
  generateWalls,
  H,
  hitsWall,
  MID,
  spawnOf,
  TEAM_COLORS,
  teamOf,
  TOP,
  W,
  type Team,
} from './arena.ts';
import { drawBall, drawKid, drawPuff, drawWall, type Puff } from './sprites.ts';

/* ---------- Messages échangés entre joueurs ---------- */

export type SnowMsg =
  /** Ma position, ~12 fois par seconde. c = accroupi, s = sonné. */
  | { type: 'state'; x: number; y: number; c: boolean; s: boolean }
  /** Je lance une boule. */
  | { type: 'throw'; id: string; x: number; y: number; dir: 1 | -1 }
  /** J'ai été touché par la boule `ballId` lancée par `by`. */
  | { type: 'hit'; ballId: string; by: string };

/* ---------- Réglages ---------- */

const HITS_TO_WIN = 5;
const ROUND_MS = 120_000;
const COUNTDOWN_MS = 3000;
const MOVE_SPEED = 0.06; // pixels par milliseconde
const BALL_SPEED = 0.17;
const MAX_AMMO = 3;
const RELOAD_MS = 1100;
const RELOAD_CROUCH_MS = 400;
const THROW_COOLDOWN_MS = 350;
const STUN_MS = 1200;
const SEND_EVERY_MS = 80;
const END_SCREEN_MS = 2500;

interface Actor {
  id: string;
  name: string;
  slot: Slot;
  team: Team;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  crouch: boolean;
  stun: number;
}

interface Ball {
  id: string;
  owner: string;
  team: Team;
  x: number;
  y: number;
  dir: 1 | -1;
}

const TEXTS = defineTexts({
  fr: {
    teams: ['ROUGES', 'BLEUS'],
    hits: (n: number) => `${n} touche${n > 1 ? 's' : ''}`,
    go: 'GO !',
    yourTeam: (team: string) => `TU ES CHEZ LES ${team}`,
    controls: 'A LANCER  B ABRI',
    draw: 'ÉGALITÉ !',
    victory: (team: string) => `VICTOIRE ${team} !`,
    robot: 'ROBOT',
  },
  en: {
    teams: ['REDS', 'BLUES'],
    hits: (n: number) => `${n} hit${n > 1 ? 's' : ''}`,
    go: 'GO!',
    yourTeam: (team: string) => `YOU ARE WITH THE ${team}`,
    controls: 'A THROW  B COVER',
    draw: 'DRAW!',
    victory: (team: string) => `${team} WIN!`,
    robot: 'ROBOT',
  },
});

export function Snowball({ ctx }: GameProps<SnowMsg>) {
  const t = TEXTS[ctx.lang];
  const { canvasProps, get2d } = useCanvas(ctx);
  const players = useRoomPlayers(ctx);
  const { share } = useScoreGossip(ctx);
  const walls = useRef(generateWalls(ctx.seed)).current;

  const playersRef = useRef(players);
  playersRef.current = players;

  const solo = ctx.multiplayer.room === null;
  const mySlot: Slot = ctx.multiplayer.me?.slot ?? 0;
  const myId = ctx.multiplayer.me?.id ?? 'me';
  const myTeam = teamOf(mySlot);
  const spawn = spawnOf(mySlot);

  const s = useRef({
    phase: 'countdown' as 'countdown' | 'play' | 'over',
    countdown: COUNTDOWN_MS,
    lastBeep: 4,
    timeLeft: ROUND_MS,
    score: [0, 0] as [number, number],
    myHits: 0,
    me: {
      id: myId,
      name: ctx.player.nickname,
      slot: mySlot,
      team: myTeam,
      x: spawn.x,
      y: spawn.y,
      targetX: spawn.x,
      targetY: spawn.y,
      crouch: false,
      stun: 0,
    } as Actor,
    others: new Map<string, Actor>(),
    ammo: MAX_AMMO,
    reload: 0,
    cooldown: 0,
    ballCount: 0,
    balls: [] as Ball[],
    puffs: [] as Puff[],
    sendIn: 0,
    endTimer: 0,
    over: false,
    bot: { cooldown: 1500, crouchFor: 0, aimOffset: 0 },
  }).current;

  // En solo : un robot dans l'équipe bleue pour s'entraîner.
  if (solo && !s.others.has('bot')) {
    const p = spawnOf(1);
    s.others.set('bot', {
      id: 'bot',
      name: t.robot,
      slot: 1,
      team: 1,
      x: p.x,
      y: p.y,
      targetX: p.x,
      targetY: p.y,
      crouch: false,
      stun: 0,
    });
  }

  /* ----- Lancer une boule ----- */
  function throwBall(actor: Actor, local: boolean, id?: string) {
    const dir: 1 | -1 = actor.team === 0 ? 1 : -1;
    const ball: Ball = {
      id: id ?? `${actor.id}-${s.ballCount++}`,
      owner: actor.id,
      team: actor.team,
      x: actor.x + dir * 8,
      y: actor.y - 10,
      dir,
    };
    s.balls.push(ball);
    ctx.audio.play('throw');
    if (local && actor === s.me) {
      ctx.multiplayer.send({ type: 'throw', id: ball.id, x: Math.round(ball.x), y: Math.round(ball.y), dir });
    }
  }

  useButton(ctx, 'a', {
    onPress: () => {
      const me = s.me;
      if (s.phase !== 'play' || me.crouch || me.stun > 0 || s.ammo <= 0 || s.cooldown > 0) return;
      s.ammo--;
      s.cooldown = THROW_COOLDOWN_MS;
      throwBall(me, true);
    },
  });

  /* ----- Une touche (sur moi ou le robot, ou annoncée par un autre joueur) ----- */
  function registerHit(victim: Actor, ballId: string, by: string) {
    const index = s.balls.findIndex((b) => b.id === ballId);
    if (index >= 0) s.balls.splice(index, 1);
    victim.stun = STUN_MS;
    const scoringTeam: Team = victim.team === 0 ? 1 : 0;
    s.score[scoringTeam]++;
    if (by === s.me.id) s.myHits++;
    s.puffs.push({ x: victim.x, y: victim.y - 12, life: 300 });
    ctx.audio.play('splat');
    if (victim === s.me) ctx.audio.vibrate(120);
  }

  /* ----- Réception des messages ----- */
  useMessages(ctx, (msg, from) => {
    let actor = s.others.get(from.id);
    if (!actor) {
      const p = spawnOf(from.slot);
      actor = {
        id: from.id,
        name: from.nickname,
        slot: from.slot,
        team: teamOf(from.slot),
        x: p.x,
        y: p.y,
        targetX: p.x,
        targetY: p.y,
        crouch: false,
        stun: 0,
      };
      s.others.set(from.id, actor);
    }
    if (msg.type === 'state') {
      actor.targetX = msg.x;
      actor.targetY = msg.y;
      actor.crouch = msg.c;
      if (!msg.s) actor.stun = Math.min(actor.stun, 0);
    } else if (msg.type === 'throw') {
      actor.x = msg.x - msg.dir * 8;
      actor.y = msg.y + 10;
      throwBall(actor, false, msg.id);
    } else if (msg.type === 'hit' && s.phase !== 'over') {
      registerHit(actor, msg.ballId, msg.by);
    }
  });

  /* ----- Fin de partie ----- */
  function endRound() {
    s.phase = 'over';
    const mine = s.score[myTeam];
    const theirs = s.score[myTeam === 0 ? 1 : 0];
    ctx.audio.play(mine > theirs ? 'win' : mine < theirs ? 'lose' : 'confirm');
  }

  function finishGame() {
    s.over = true;
    const mine = s.score[myTeam];
    const theirs = s.score[myTeam === 0 ? 1 : 0];
    const outcome = mine > theirs ? 'win' : mine < theirs ? 'lose' : 'draw';
    void ctx.lifecycle
      .gameOver({
        // Score personnel : le nombre de joueurs adverses que j'ai touchés
        score: s.myHits,
        display: t.hits(s.myHits),
        outcome,
      })
      .then(() => share());
  }

  /* ----- Petit robot d'entraînement (solo uniquement) ----- */
  function updateBot(bot: Actor, dt: number) {
    const b = s.bot;
    if (bot.stun > 0) return;
    // Esquive : s'accroupit si une boule arrive à sa hauteur
    const danger = s.balls.some(
      (ball) => ball.team !== bot.team && Math.abs(ball.y - (bot.y - 10)) < 9 && Math.abs(ball.x - bot.x) < 45,
    );
    if (danger && b.crouchFor <= 0 && Math.random() < 0.025 * dt) b.crouchFor = 600;
    b.crouchFor -= dt;
    bot.crouch = b.crouchFor > 0;
    if (bot.crouch) return;

    // Se place à peu près en face du joueur, avec un peu d'hésitation
    if (Math.random() < 0.002 * dt) b.aimOffset = (Math.random() - 0.5) * 50;
    const wantY = s.me.y + b.aimOffset;
    const dy = Math.sign(wantY - bot.y) * Math.min(Math.abs(wantY - bot.y), MOVE_SPEED * 0.8 * dt);
    if (!hitsWall(bot.x, bot.y + dy - 3, walls, 5)) bot.y = clamp(bot.y + dy, TOP + 16, H - 4);

    b.cooldown -= dt;
    if (b.cooldown <= 0 && Math.abs(s.me.y - bot.y) < 14) {
      throwBall(bot, true);
      b.cooldown = 900 + Math.random() * 900;
    }
  }

  /* ----- Boucle de jeu ----- */
  useGameLoop(ctx, (dt) => {
    const me = s.me;

    if (s.phase === 'countdown') {
      s.countdown -= dt;
      const n = Math.ceil(s.countdown / 1000);
      if (n < s.lastBeep) {
        s.lastBeep = n;
        ctx.audio.play(n > 0 ? 'countdown' : 'go');
      }
      if (s.countdown <= 0) s.phase = 'play';
    }

    if (s.phase === 'play') {
      s.timeLeft -= dt;

      // Mon joueur
      me.stun = Math.max(0, me.stun - dt);
      me.crouch = me.stun <= 0 && ctx.input.isDown('b');
      if (me.stun <= 0 && !me.crouch) {
        const dx = (ctx.input.isDown('right') ? 1 : 0) - (ctx.input.isDown('left') ? 1 : 0);
        const dy = (ctx.input.isDown('down') ? 1 : 0) - (ctx.input.isDown('up') ? 1 : 0);
        const minX = myTeam === 0 ? 8 : MID + 8;
        const maxX = myTeam === 0 ? MID - 8 : W - 8;
        const nx = clamp(me.x + dx * MOVE_SPEED * dt, minX, maxX);
        const ny = clamp(me.y + dy * MOVE_SPEED * dt, TOP + 16, H - 4);
        if (!hitsWall(nx, me.y - 3, walls, 5)) me.x = nx;
        if (!hitsWall(me.x, ny - 3, walls, 5)) me.y = ny;
      }

      // Munitions : on refait des boules, plus vite accroupi
      s.cooldown = Math.max(0, s.cooldown - dt);
      if (s.ammo < MAX_AMMO) {
        s.reload += dt;
        const need = me.crouch ? RELOAD_CROUCH_MS : RELOAD_MS;
        if (s.reload >= need) {
          s.reload = 0;
          s.ammo++;
        }
      } else s.reload = 0;

      const bot = s.others.get('bot');
      if (bot) {
        bot.stun = Math.max(0, bot.stun - dt);
        updateBot(bot, dt);
      }
    }

    // Les boules avancent, s'écrasent sur les murs, touchent les joueurs gérés ici
    for (const ball of [...s.balls]) {
      ball.x += ball.dir * BALL_SPEED * dt;
      if (ball.x < -4 || ball.x > W + 4) {
        s.balls.splice(s.balls.indexOf(ball), 1);
        continue;
      }
      if (hitsWall(ball.x, ball.y, walls)) {
        s.balls.splice(s.balls.indexOf(ball), 1);
        s.puffs.push({ x: ball.x, y: ball.y, life: 300 });
        continue;
      }
      if (s.phase !== 'play') continue;
      // Je décide moi-même si je suis touché (et le robot en solo)
      const victims = [s.me, s.others.get('bot')].filter(Boolean) as Actor[];
      for (const v of victims) {
        const touched =
          v.team !== ball.team &&
          !v.crouch &&
          v.stun <= 0 &&
          Math.abs(ball.x - v.x) <= 6 &&
          ball.y >= v.y - 20 &&
          ball.y <= v.y - 2;
        if (!touched) continue;
        registerHit(v, ball.id, ball.owner);
        if (v === s.me) ctx.multiplayer.send({ type: 'hit', ballId: ball.id, by: ball.owner });
        break;
      }
    }

    // Les autres joueurs glissent vers leur dernière position connue
    for (const [id, a] of s.others) {
      if (id === 'bot') continue;
      if (!playersRef.current.some((p) => p.id === id)) {
        s.others.delete(id);
        continue;
      }
      const k = Math.min(1, dt * 0.015);
      a.x += (a.targetX - a.x) * k;
      a.y += (a.targetY - a.y) * k;
      a.stun = Math.max(0, a.stun - dt);
    }

    for (const p of s.puffs) p.life -= dt;
    s.puffs = s.puffs.filter((p) => p.life > 0);

    // Fin de manche : 5 touches ou temps écoulé
    if (s.phase === 'play' && (s.score[0] >= HITS_TO_WIN || s.score[1] >= HITS_TO_WIN || s.timeLeft <= 0)) {
      endRound();
    }
    if (s.phase === 'over' && !s.over) {
      s.endTimer += dt;
      if (s.endTimer > END_SCREEN_MS) finishGame();
    }

    // Envoi de ma position
    s.sendIn -= dt;
    if (s.sendIn <= 0 && !solo) {
      s.sendIn = SEND_EVERY_MS;
      ctx.multiplayer.send({ type: 'state', x: Math.round(me.x), y: Math.round(me.y), c: me.crouch, s: me.stun > 0 });
    }

    draw();
  });

  /* ----- Dessin ----- */
  function draw() {
    const g = get2d();
    if (!g) return;

    // Terrain enneigé, chaque camp légèrement teinté
    g.fillStyle = PALETTE.snow;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255, 64, 83, 0.05)';
    g.fillRect(0, TOP, MID, H - TOP);
    g.fillStyle = 'rgba(42, 124, 240, 0.06)';
    g.fillRect(MID, TOP, MID, H - TOP);
    g.fillStyle = '#dbe6f6';
    for (let i = 0; i < 60; i++) g.fillRect((i * 53) % W, TOP + ((i * 97) % (H - TOP)), 2, 1);
    // Ligne du milieu
    g.fillStyle = '#b8cdee';
    for (let y = TOP; y < H; y += 8) g.fillRect(MID - 1, y, 2, 4);

    // Murs et joueurs triés par profondeur (du haut vers le bas)
    type Item = { depth: number; draw: () => void };
    const items: Item[] = walls.map((w) => ({ depth: w.y + w.h, draw: () => drawWall(g, w) }));
    const actors = [s.me, ...s.others.values()];
    for (const a of actors) {
      const blink = a.stun > 0 && Math.floor(a.stun / 100) % 2 === 0;
      items.push({
        depth: a.y,
        draw: () => {
          drawKid(g, a.x, a.y, TEAM_COLORS[a.team], a.team === 0 ? 1 : -1, a.crouch, blink ? 0.35 : 1);
          if (a === s.me) {
            // Repère au-dessus de moi + mes munitions
            const top = a.y - (a.crouch ? 8 : 14) - 14;
            g.fillStyle = PALETTE.gold;
            g.fillRect(Math.round(a.x) - 2, top, 5, 2);
            g.fillRect(Math.round(a.x) - 1, top + 2, 3, 1);
            for (let i = 0; i < MAX_AMMO; i++) {
              g.fillStyle = i < s.ammo ? '#ffffff' : 'rgba(27, 34, 80, 0.2)';
              g.fillRect(Math.round(a.x) - 5 + i * 4, a.y + 2, 3, 3);
            }
          }
        },
      });
    }
    items.sort((a, b) => a.depth - b.depth).forEach((i) => i.draw());

    for (const ball of s.balls) drawBall(g, ball.x, ball.y);
    for (const p of s.puffs) drawPuff(g, p);

    // Barre de score
    g.fillStyle = PALETTE.night;
    g.fillRect(0, 0, W, 13);
    drawText(g, `${t.teams[0]} ${s.score[0]}`, 3, 3, { color: TEAM_COLORS[0] });
    drawText(g, `${s.score[1]} ${t.teams[1]}`, W - 3, 3, { color: '#7fb2ff', align: 'right' });
    const secs = Math.max(0, Math.ceil(s.timeLeft / 1000));
    drawText(g, `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, MID, 3, {
      color: PALETTE.snow,
      align: 'center',
    });

    if (s.phase === 'countdown') {
      const n = Math.ceil(s.countdown / 1000);
      panel(g, 70, 46, false);
      drawText(g, n > 0 ? String(n) : t.go, MID, 80, { size: 16, color: PALETTE.red, align: 'center' });
      drawText(g, t.yourTeam(t.teams[myTeam]), MID, 100, { color: TEAM_COLORS[myTeam], align: 'center' });
      drawText(g, t.controls, MID, 112, { color: PALETTE.night, align: 'center' });
    }

    if (s.phase === 'over') {
      const [red, blue] = s.score;
      const title = red === blue ? t.draw : t.victory(t.teams[red > blue ? 0 : 1]);
      panel(g, 76, 50, true);
      drawText(g, title, MID, 86, { color: PALETTE.gold, align: 'center', shadow: PALETTE.night });
      drawText(g, `${red} - ${blue}`, MID, 102, { size: 16, color: PALETTE.snow, align: 'center' });
    }
  }

  /** Encadré centré, clair ou sombre. */
  function panel(g: CanvasRenderingContext2D, y: number, h: number, dark: boolean) {
    g.fillStyle = dark ? 'rgba(11, 30, 63, 0.9)' : 'rgba(238, 246, 255, 0.92)';
    g.fillRect(20, y, W - 40, h);
  }

  return <canvas {...canvasProps} />;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
