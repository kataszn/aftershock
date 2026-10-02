#!/usr/bin/env node
// Custom pino log formatter for local development.
//
// pino-colada only renders a fixed set of fields (method/status/url/err), so
// structured fields like `port`, `path`, `status`, `durationMs`, and
// `requestId` were silently dropped from the dev console. This formatter
// renders the message plus every structured field, so nothing is lost.
//
// Usage: `tsx watch src/index.ts | aftershock-pretty`
// Non-JSON lines (e.g. dotenv's "injected env" banner, tsx restart notices)
// pass through untouched.

import readline from 'node:readline';

const useColor = process.stdout.isTTY;

const wrap = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const gray = wrap(90);
const red = wrap(31);
const green = wrap(32);
const yellow = wrap(33);
const magenta = wrap(35);
const cyan = wrap(36);
const white = wrap(37);
const fatal = (s) => (useColor ? `\x1b[41m\x1b[37m${s}\x1b[0m` : String(s));

// BMP-safe symbols only — non-BMP emoji (e.g. 🚨, 🐛) render as mojibake in
// the default Windows console codepage.
const LEVEL_EMOJI = {
  trace: '»',
  debug: '·',
  info: '✨',
  warn: '⚠',
  error: '✖',
  fatal: '☠',
};

const LEVEL_COLOR = {
  trace: white,
  debug: yellow,
  info: green,
  warn: magenta,
  error: red,
  fatal,
};

const LEVEL_NAME = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

// Fields rendered specially (or suppressed) so they don't repeat in the
// generic key=value tail.
const HANDLED = new Set([
  'time',
  'level',
  'msg',
  'message',
  'service',
  'pid',
  'hostname',
  'method',
  'path',
  'url',
  'status',
  'statusCode',
  'durationMs',
  'responseTime',
  'err',
  'stack',
]);

function formatValue(value) {
  if (value === null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatTime(time) {
  const d = time ? new Date(time) : new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

function formatError(err) {
  if (!err) return '';
  if (typeof err === 'string') return '\n' + red(err);
  const { stack, ...rest } = err;
  const extra = Object.keys(rest).length ? '\n' + gray(JSON.stringify(rest, null, 2)) : '';
  return '\n' + red(stack || JSON.stringify(err)) + extra;
}

function formatLine(line) {
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    return line; // non-JSON passthrough
  }
  if (!obj || typeof obj !== 'object' || obj.level == null) return line;

  const level = typeof obj.level === 'number' ? LEVEL_NAME[obj.level] ?? 'info' : obj.level;
  const message = obj.message ?? obj.msg ?? '';
  const colorize = LEVEL_COLOR[level] ?? white;

  const parts = [gray(formatTime(obj.time)), LEVEL_EMOJI[level] ?? '•', colorize(message)];

  // Request-style fields, rendered readably.
  if (obj.method != null) parts.push(white(obj.method));
  const target = obj.path ?? obj.url;
  if (target != null) parts.push(white(target));
  const status = obj.status ?? obj.statusCode;
  if (status != null) parts.push(white(String(status)));
  const duration = obj.durationMs ?? obj.responseTime;
  if (duration != null) parts.push(gray(`${duration}ms`));

  // Everything else as key=value so no structured field is lost.
  for (const [key, value] of Object.entries(obj)) {
    if (HANDLED.has(key)) continue;
    parts.push(cyan(`${key}=`) + formatValue(value));
  }

  let out = parts.join(' ');
  if (obj.err) out += formatError(obj.err);
  else if (obj.stack) out += '\n' + red(obj.stack);
  return out;
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  process.stdout.write(formatLine(line) + '\n');
});
