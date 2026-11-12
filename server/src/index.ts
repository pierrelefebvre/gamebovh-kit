import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  MAX_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  isValidGameId,
  isValidRoomCode,
  normalizeRoomCode,
  sanitizeNickname,
  type ClientMessage,
  type ServerMessage,
} from '@gamebovh/protocol';
import { generateConnectionId } from './codes.ts';
import { readConfig, TokenBucket } from './limits.ts';
import { RoomManager, type Peer } from './rooms.ts';
import { createStaticHandler } from './static.ts';

const config = readConfig();
const rooms = new RoomManager({ maxRooms: config.maxRooms });

interface Connection extends Peer {
  socket: WebSocket;
  alive: boolean;
  bucket: TokenBucket;
  dropped: number;
}

const connections = new Set<Connection>();

const serveStatic = process.env.STATIC_DIR ? createStaticHandler(process.env.STATIC_DIR) : null;

const http = createServer(async (req, res) => {
  if (req.url === '/health' || req.url === '/ws/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        connections: connections.size,
        rooms: rooms.roomCount,
        players: rooms.playerCount,
      }),
    );
    return;
  }
  if (serveStatic && (await serveStatic(req, res))) return;
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Serveur WebSocket GameBOVH.\n');
});

const wss = new WebSocketServer({
  server: http,
  maxPayload: MAX_MESSAGE_BYTES,
  verifyClient: ({ origin }, done) => {
    if (connections.size >= config.maxConnections) return done(false, 503, 'Server full');
    if (config.allowedOrigins === '*') return done(true);
    const ok = !!origin && config.allowedOrigins.includes(origin.replace(/\/$/, ''));
    done(ok, ok ? undefined : 403, ok ? undefined : 'Origin not allowed');
  },
});

wss.on('connection', (socket) => {
  const conn: Connection = {
    id: generateConnectionId(),
    nickname: null,
    roomCode: null,
    socket,
    alive: true,
    bucket: new TokenBucket(config.messagesPerSecond, config.messagesPerSecond * 2),
    dropped: 0,
    send(message: ServerMessage) {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
    },
  };
  connections.add(conn);

  socket.on('pong', () => {
    conn.alive = true;
  });

  socket.on('message', (raw, isBinary) => {
    if (isBinary) return;
    if (!conn.bucket.take()) {
      conn.dropped++;
      if (conn.dropped === 1 || conn.dropped % 100 === 0) {
        conn.send({ t: 'error', code: 'rate_limited', message: 'Too many messages.' });
      }
      if (conn.dropped > 2000) socket.close(1008, 'Rate limit');
      return;
    }
    let message: ClientMessage;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      conn.send({ t: 'error', code: 'bad_request', message: 'Invalid JSON.' });
      return;
    }
    handle(conn, message);
  });

  socket.on('close', () => {
    rooms.leave(conn, true);
    connections.delete(conn);
  });
  socket.on('error', () => socket.terminate());
});

function handle(conn: Connection, message: ClientMessage): void {
  if (!message || typeof message !== 'object' || typeof message.t !== 'string') {
    conn.send({ t: 'error', code: 'bad_request', message: 'Missing message type.' });
    return;
  }

  if (message.t === 'hello') {
    const nickname = sanitizeNickname(String(message.nickname ?? ''));
    conn.nickname = nickname || 'Player';
    conn.send({ t: 'welcome', id: conn.id, v: PROTOCOL_VERSION });
    return;
  }

  if (!conn.nickname) {
    conn.send({ t: 'error', code: 'not_ready', message: 'Send hello first.' });
    return;
  }

  switch (message.t) {
    case 'create':
      if (!isValidGameId(message.gameId)) return badRequest(conn, 'Invalid gameId.');
      rooms.create(conn, message.gameId);
      return;
    case 'join': {
      const code = normalizeRoomCode(String(message.code ?? ''));
      if (!isValidRoomCode(code)) return badRequest(conn, 'Invalid room code.');
      if (!isValidGameId(message.gameId)) return badRequest(conn, 'Invalid gameId.');
      rooms.join(conn, code, message.gameId);
      return;
    }
    case 'leave':
      rooms.leave(conn);
      return;
    case 'relay':
      rooms.relay(conn, message.data, typeof message.to === 'string' ? message.to : undefined);
      return;
    default:
      badRequest(conn, 'Unknown message type.');
  }
}

function badRequest(conn: Connection, text: string): void {
  conn.send({ t: 'error', code: 'bad_request', message: text });
}

/* Battement de cœur : coupe les connexions mortes (téléphone en veille, réseau perdu). */
const heartbeat = setInterval(() => {
  for (const conn of connections) {
    if (!conn.alive) {
      conn.socket.terminate();
      continue;
    }
    conn.alive = false;
    conn.socket.ping();
  }
}, config.heartbeatMs);

http.listen(config.port, () => {
  const origins = config.allowedOrigins === '*' ? '*' : config.allowedOrigins.join(', ');
  console.log(`[gamebovh] WebSocket server on :${config.port} (origins: ${origins})`);
  if (process.env.STATIC_DIR) console.log(`[gamebovh] Serving console from ${process.env.STATIC_DIR}`);
});

function shutdown(): void {
  clearInterval(heartbeat);
  for (const conn of connections) conn.socket.close(1001, 'Server restarting');
  wss.close();
  http.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
