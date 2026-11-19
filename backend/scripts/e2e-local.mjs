#!/usr/bin/env node
/**
 * End-to-end check of the real local-bot flow against a RUNNING backend
 * (real database + LM Studio):
 *
 *   1. register / log in a user                (POST /api/auth/login, GET /api/auth/me)
 *   2. save a bot preset with provider lmstudio (POST /api/bot/presets) and load it back
 *   3. create a game and add that bot to it     (socket: createGame, addBotToGame)
 *   4. start the game, pick words, and wait for one model-driven bot turn to complete
 *
 * Usage: node scripts/e2e-local.mjs [baseUrl] [modelName]
 *   baseUrl   default http://localhost:3000
 *   modelName default: first non-embedding model LM Studio reports
 * Exits 0 on success, 1 on failure.
 */
import { io } from 'socket.io-client';

const BASE = process.argv[2] || process.env.E2E_BASE_URL || 'http://localhost:3000';
let MODEL = process.argv[3] || process.env.E2E_MODEL || '';
const TURN_WAIT_MS = parseInt(process.env.E2E_TURN_WAIT_MS || '240000', 10);

const log = (...a) => console.log('[e2e]', ...a);
const die = (msg) => { console.error('[e2e] FAIL:', msg); process.exit(1); };

async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

const stamp = Date.now().toString(36);
const username = `e2e_${stamp}`;

// ---- 1. register + log in ---------------------------------------------------
let r = await api('POST', '/api/auth/login', { username, displayName: 'E2E Host' });
if (r.status !== 200 || !r.json.token) die(`register failed: ${r.status} ${JSON.stringify(r.json)}`);
const userId = r.json.user.id;
log(`registered ${username} (${userId})`);

r = await api('POST', '/api/auth/login', { username, displayName: 'E2E Host' });
if (r.status !== 200 || r.json.user?.id !== userId) die(`second login did not return the same user: ${JSON.stringify(r.json)}`);
const token = r.json.token;
r = await api('GET', '/api/auth/me', null, token);
if (r.status !== 200 || !JSON.stringify(r.json).includes(userId)) die(`/api/auth/me failed: ${r.status} ${JSON.stringify(r.json)}`);
log('logged in again as the same user; /api/auth/me OK');

// ---- model ------------------------------------------------------------------
if (!MODEL) {
  r = await api('GET', '/api/bot/ollama/models?provider=lmstudio');
  const m = (r.json.models || []).map((x) => x.name || x.id || x.model).filter((n) => n && !/embed/i.test(n));
  if (!m.length) die(`no LM Studio models listed by backend: ${JSON.stringify(r.json).slice(0, 300)}`);
  MODEL = m[0];
}
log(`model: ${MODEL}`);

// ---- 2. save preset, load it back -------------------------------------------
const presetName = `E2E preset ${stamp}`;
r = await api('POST', '/api/bot/presets', {
  presetName, displayName: 'E2E Bot', modelName: MODEL, difficulty: 'easy', provider: 'lmstudio',
});
if (r.status !== 201 || !r.json.id) die(`save preset failed: ${r.status} ${JSON.stringify(r.json)}`);
const presetId = r.json.id;
r = await api('GET', `/api/bot/presets/${presetId}`);
if (r.status !== 200) die(`load preset failed: ${r.status} ${JSON.stringify(r.json)}`);
const preset = r.json;
if (preset.provider !== 'lmstudio' || preset.modelName !== MODEL || preset.presetName !== presetName) {
  die(`loaded preset does not match what was saved: ${JSON.stringify(preset)}`);
}
r = await api('GET', '/api/bot/presets');
if (!(r.json.presets || []).some((p) => p.id === presetId)) die('preset missing from preset list');
log(`preset saved and loaded back: ${presetId} provider=${preset.provider} model=${preset.modelName}`);

// ---- 3 + 4. game over the socket ---------------------------------------------
const socket = io(BASE, { auth: { token }, transports: ['websocket'], reconnection: false });
const once = (ev, ms = 30000) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`timed out waiting for "${ev}"`)), ms);
  socket.once(ev, (d) => { clearTimeout(t); resolve(d); });
});
socket.on('error', (e) => log('server error event:', e?.message || e));
socket.on('connect_error', (e) => die(`socket connect error: ${e.message}`));

let exitCode = 1;
try {
  await once('connected');
  socket.emit('createGame');
  const game = await once('gameCreated');
  const roomCode = game.roomCode;
  log(`game created: ${roomCode}`);

  // Add the bot from the preset we loaded back from the database
  socket.emit('addBotToGame', {
    roomCode,
    botConfig: {
      displayName: preset.displayName,
      modelName: preset.modelName,
      difficulty: preset.difficulty,
      provider: preset.provider,
    },
  });
  const joined = await once('botJoined');
  const botId = joined.botId;
  const botRow = (joined.game.players || []).find((p) => p.botId === botId || p.userId === botId || p.id === botId);
  if (!botId || !botRow) die(`bot not present in game after addBotToGame: ${JSON.stringify(joined).slice(0, 400)}`);
  log(`bot added to game: ${joined.displayName} (${botId}), players=${joined.game.players.length}`);

  // Confirm through REST (database) that the game now has 2 players
  r = await api('GET', `/api/game/${roomCode}`, null, token);
  if (r.status !== 200) die(`GET /api/game/${roomCode} failed: ${r.status}`);

  // Watch the bot's turn
  const botTurn = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`no completed bot turn within ${TURN_WAIT_MS}ms`)), TURN_WAIT_MS);
    const done = (kind, d) => { clearTimeout(t); resolve({ kind, d }); };
    const isBot = (d) => [d?.guessingPlayerId, d?.guesserId, d?.playerId, d?.previousPlayerId].includes(botId);
    // letterGuessed carries no guesser id: the bot announces its guess via
    // botThinking(status=guessing) right before the result is broadcast.
    let botGuessing = false;
    socket.on('botThinking', (d) => { if (d.botId === botId && d.status === 'guessing') botGuessing = true; });
    socket.on('letterGuessed', (d) => { if (botGuessing || isBot(d) || d?.targetPlayerId === userId) done('letterGuess', d); });
    socket.on('wordGuessResult', (d) => { if (isBot(d)) done('wordGuess', d); });
    socket.on('duplicateSelectionRequired', (d) => { if (isBot(d)) done('letterGuess(duplicate)', d); });
    socket.on('blankSelectionRequired', (d) => { if (isBot(d)) done('letterGuess(blank)', d); });
    socket.on('gameOver', (d) => done('gameOver', d));
  });
  botTurn.catch(() => {});
  socket.on('botThinking', (d) => { if (d.message) log(`bot: ${d.message}`); });

  // Keep the game moving when the human is asked for something
  const firstHidden = (revealed) => {
    const i = (revealed || []).findIndex((v) => v === null || v === false);
    return i >= 0 ? i : 0;
  };
  socket.on('exposeCardRequired', (d) => {
    if (d.affectedPlayerId === userId) socket.emit('selectExposePosition', { roomCode, position: firstHidden(d.revealedPositions) });
  });
  socket.on('duplicateSelectionRequired', (d) => {
    if (d.targetPlayerId === userId) socket.emit('selectDuplicatePosition', { roomCode, position: d.positions[0] });
  });
  socket.on('blankSelectionRequired', (d) => {
    if (d.targetPlayerId === userId) socket.emit('selectBlankPosition', { roomCode, position: d.positions[0] });
  });
  // The human deliberately guesses unlikely letters so the turn passes to the bot
  // (a correct guess keeps the turn).
  const unlikely = ['Q', 'Z', 'X', 'J', 'V', 'K', 'W', 'Y', 'F', 'B'];
  const humanGuess = (currentId) => {
    if (currentId !== userId || !unlikely.length) return;
    const letter = unlikely.shift();
    log(`human turn: guessing "${letter}" at the bot`);
    socket.emit('guessLetter', { roomCode, targetPlayerId: botId, letter });
  };
  socket.on('turnChanged', (d) => humanGuess(d.currentPlayerId));
  socket.on('letterGuessed', (d) => humanGuess(d.currentTurnPlayerId));

  socket.emit('startGame', { roomCode });
  await once('wordSelectionPhase');
  log('word selection phase; human picks a word, bot picks via the model');
  const started = once('gameStarted', 180000);
  socket.emit('selectWord', { roomCode, word: 'PLANET' });
  const active = await started;
  log(`game started; first turn: ${active.currentTurnPlayerId === botId ? 'bot' : 'human'}`);
  humanGuess(active.currentTurnPlayerId);

  const turn = await botTurn;
  if (turn.kind === 'gameOver') die('game ended before a bot turn was observed');
  const d = turn.d;
  log(`bot turn completed: ${turn.kind}` +
      (d.letter ? ` letter=${d.letter}` : '') +
      (d.guessedWord ? ` word=${d.guessedWord}` : '') +
      (typeof d.isCorrect === 'boolean' ? ` correct=${d.isCorrect}` : ''));

  // Clean up: end the game and delete the preset
  socket.emit('endGame', { roomCode, force: true });
  await new Promise((res) => setTimeout(res, 1000));
  await api('DELETE', `/api/bot/presets/${presetId}`);
  log('PASS');
  exitCode = 0;
} catch (e) {
  console.error('[e2e] FAIL:', e.message);
} finally {
  socket.close();
  process.exit(exitCode);
}
