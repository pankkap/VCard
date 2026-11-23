#!/usr/bin/env node
/**
 * Local editor server.
 *   npm start        → http://localhost:4321/editor.html
 *
 * Serves the project files, plus a tiny JSON API so the editor page can
 * actually write your card details to disk:
 *   GET  /api/card      current details + saved card link
 *   POST /api/card      save details, rebuild card.vcf, QR codes and dist/
 *   GET  /api/qr.png    QR of ?url= (falls back to the saved link)
 *   GET  /api/qr.svg    same, vector
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import QRCode from 'qrcode';
import {
  root,
  readCard,
  writeCard,
  writeVcf,
  writeQr,
  readSiteUrl,
  buildDist,
  QR_OPTIONS,
} from './config.mjs';

const PORT = Number(process.env.PORT || 4321);
const HOST = '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.vcf': 'text/vcard; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

/* ---------- helpers ---------- */

const sendJson = (res, status, data) => {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
};

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const TEXT_FIELDS = [
  'firstName', 'lastName', 'jobTitle', 'company',
  'phone', 'email', 'website',
  'street', 'city', 'state', 'zip', 'country',
  'summary', 'photo',
];

/* keep only known fields, all strings, and drop empty social rows */
function sanitizeCard(input) {
  const card = {};
  for (const key of TEXT_FIELDS) {
    const value = input && typeof input[key] === 'string' ? input[key] : '';
    card[key] = value.trim();
  }
  const socials = Array.isArray(input?.socials) ? input.socials : [];
  card.socials = socials
    .filter((s) => s && typeof s.url === 'string' && s.url.trim())
    .map((s) => ({
      type: String(s.type || 'website').replace(/[^a-zA-Z0-9-]/g, '') || 'website',
      url: s.url.trim(),
    }));
  return card;
}

function validUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/* ---------- routes ---------- */

async function handleApi(req, res, url) {
  const route = url.pathname;

  if (route === '/api/health') {
    return sendJson(res, 200, { ok: true, pid: process.pid, uptime: Math.round(process.uptime()) });
  }

  if (route === '/api/card' && req.method === 'GET') {
    return sendJson(res, 200, { card: await readCard(), siteUrl: await readSiteUrl() });
  }

  if (route === '/api/card' && req.method === 'POST') {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Could not read that request.' });
    }

    const card = sanitizeCard(payload.card);
    if (!card.firstName && !card.lastName) {
      return sendJson(res, 400, { error: 'A first or last name is required.' });
    }

    const site = String(payload.siteUrl || '').trim();
    if (site && !validUrl(site)) {
      return sendJson(res, 400, { error: 'The card link must start with http:// or https://' });
    }

    await writeCard(card);
    const vcf = await writeVcf(card);
    if (site) await writeQr(site);
    const files = await buildDist();

    console.log(`→ saved ${card.firstName} ${card.lastName}`.trim() + (site ? ` · QR → ${site}` : ' · no QR'));
    return sendJson(res, 200, { ok: true, bytes: Buffer.byteLength(vcf), siteUrl: site, files });
  }

  if (route === '/api/qr.png' || route === '/api/qr.svg') {
    const target = (url.searchParams.get('url') || (await readSiteUrl()) || '').trim();
    if (!target) return sendJson(res, 400, { error: 'Add your card link first.' });
    if (!validUrl(target)) return sendJson(res, 400, { error: 'That link is not a valid URL.' });

    const name = route.endsWith('.svg') ? 'card-qr.svg' : 'card-qr.png';
    const headers = { 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' };

    if (route.endsWith('.svg')) {
      const svg = await QRCode.toString(target, { ...QR_OPTIONS, type: 'svg' });
      res.writeHead(200, { ...headers, 'Content-Type': 'image/svg+xml; charset=utf-8' });
      return res.end(svg);
    }
    const png = await QRCode.toBuffer(target, QR_OPTIONS);
    res.writeHead(200, { ...headers, 'Content-Type': 'image/png', 'Content-Length': png.length });
    return res.end(png);
  }

  return sendJson(res, 404, { error: 'Unknown endpoint.' });
}

async function handleStatic(req, res, url) {
  const wanted = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.normalize(path.join(root, wanted));

  if (!file.startsWith(root + path.sep) || file.includes(`${path.sep}node_modules${path.sep}`)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const data = await fs.readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const started = Date.now();
  const quiet = url.pathname === '/api/health';

  if (!quiet) {
    res.on('finish', () => {
      console.log(`  ${req.method} ${url.pathname} → ${res.statusCode} (${Date.now() - started}ms)`);
    });
  }

  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return await handleStatic(req, res, url);
  } catch (err) {
    console.error('✖', err.message);
    if (!res.writableEnded) sendJson(res, 500, { error: err.message || 'Something went wrong.' });
  }
});

/* Chrome happily reuses an idle socket; Node closes idle sockets after 5s by
   default, which makes the next request fail with an empty response. Keep
   sockets open well past the time someone needs to fill in a form. */
server.keepAliveTimeout = 65_000;
server.headersTimeout = 70_000;
server.requestTimeout = 0;

server.on('error', async (err) => {
  if (err.code === 'EADDRINUSE') {
    // Probably this same editor from an earlier run — point at it instead.
    try {
      const res = await fetch(`http://${HOST}:${PORT}/api/health`);
      if (res.ok) {
        console.log(`The editor is already running → http://localhost:${PORT}/editor.html`);
        console.log('Use that window, or stop it with Ctrl+C before starting a new one.');
        openBrowser(`http://localhost:${PORT}/editor.html`);
        process.exit(0);
      }
    } catch {
      /* fall through */
    }
    console.error(`✖ Port ${PORT} is already in use by something else. Try: PORT=4322 npm start`);
  } else {
    console.error('✖', err.message);
  }
  process.exit(1);
});

/* Stay alive: one bad request should never take the editor down. */
process.on('uncaughtException', (err) => console.error('✖ uncaught:', err.message));
process.on('unhandledRejection', (err) => console.error('✖ unhandled:', err && err.message));

function openBrowser(link) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', link] : [link];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* headless is fine */
  }
}

server.listen(PORT, HOST, async () => {
  const link = `http://localhost:${PORT}/editor.html`;
  console.log(`\n  Card editor → ${link}`);
  console.log(`  Card page   → http://localhost:${PORT}/`);
  console.log('  Keep this terminal open while editing. Ctrl+C to stop.\n');

  if (!process.argv.includes('--no-open')) openBrowser(link);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close();
    process.exit(0);
  });
}
