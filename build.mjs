#!/usr/bin/env node
/**
 * Build helper for the digital business card.
 *
 *   node build.mjs --url https://vcard.beta-labs.in
 *
 * What it does:
 *   1. Reads the card details from the <script id="card-config"> block in index.html
 *   2. Writes card.vcf          (the file both iPhone and Android import)
 *   3. Writes qr.png / qr.svg   (a QR code pointing at your hosted card)
 *   4. Writes qr-url.txt        (reminder of the URL baked into the QR)
 *   5. Refreshes dist/          (drag that folder onto Netlify Drop)
 *
 * Add --vcard to also emit qr-direct.png, a QR that carries the whole
 * contact inside it (no website needed — good offline fallback).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const root = path.dirname(fileURLToPath(import.meta.url));
const p = (...f) => path.join(root, ...f);

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}

const hasFlag = (name) => process.argv.includes(`--${name}`);

/* ---- 1. read config out of index.html ---- */
const html = await fs.readFile(p('index.html'), 'utf8');
const match = html.match(/<script id="card-config" type="application\/json">([\s\S]*?)<\/script>/);
if (!match) {
  console.error('✖ Could not find <script id="card-config"> in index.html');
  process.exit(1);
}
const card = JSON.parse(match[1]);

/* ---- 2. shared vCard builder (same code the page runs) ---- */
const vcardSrc = await fs.readFile(p('vcard.js'), 'utf8');
const { buildVCard } = new Function(vcardSrc + '\nreturn { buildVCard };')();

const vcf = buildVCard(card);
await fs.writeFile(p('card.vcf'), vcf, 'utf8');

/* ---- 3. QR code ---- */
const url = arg('url') || 'https://vcard.beta-labs.in';
try {
  new URL(url);
} catch {
  console.error(`✖ "${url}" is not a valid URL.`);
  process.exit(1);
}

const qrOptions = {
  errorCorrectionLevel: 'M',
  margin: 4,
  width: 1024,
  color: { dark: '#0b1b1f', light: '#ffffff' },
};

await QRCode.toFile(p('qr.png'), url, qrOptions);
await fs.writeFile(p('qr.svg'), await QRCode.toString(url, { ...qrOptions, type: 'svg' }), 'utf8');
await fs.writeFile(p('qr-url.txt'), url + '\n', 'utf8');

/* ---- 4. optional: contact data straight inside the QR ---- */
if (hasFlag('vcard')) {
  await QRCode.toFile(p('qr-direct.png'), vcf.replace(/\r\n/g, '\n'), {
    errorCorrectionLevel: 'L',
    margin: 4,
    width: 1024,
    color: { dark: '#0b1b1f', light: '#ffffff' },
  });
  console.log('✓ qr-direct.png (contact data inside the QR — no hosting needed)');
}

/* ---- report ---- */
const name = [card.firstName, card.lastName].filter(Boolean).join(' ');
console.log(`✓ card.vcf  (${Buffer.byteLength(vcf)} bytes) for ${name}`);
console.log(`✓ qr.png + qr.svg → ${url}`);

const dist = p('dist');
await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });

const deployFiles = ['index.html', 'vcard.js', 'card.vcf', '_headers', 'qr.png', 'qr.svg'];
for (const file of deployFiles) {
  try { await fs.copyFile(p(file), path.join(dist, file)); } catch {}
}
console.log(`✓ dist/  ← drag this folder onto https://app.netlify.com/drop`);