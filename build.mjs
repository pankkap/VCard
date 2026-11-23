#!/usr/bin/env node
/**
 * Build helper for the digital business card.
 *
 *   node build.mjs --url https://your-card.netlify.app
 *
 * What it does:
 *   1. Reads your details from the card-config block in index.html
 *   2. Writes card.vcf          (the file both iPhone and Android import)
 *   3. Writes qr.png / qr.svg   (a QR code pointing at your hosted card)
 *   4. Writes qr-url.txt        (reminder of the URL baked into the QR)
 *   5. Refreshes dist/          (drag that folder onto Netlify Drop)
 *
 * Add --vcard to also emit qr-direct.png, a QR that carries the whole
 * contact inside it (no website needed — good offline fallback).
 *
 * Prefer the browser editor for day-to-day edits:  npm start
 */

import QRCode from 'qrcode';
import { readCard, writeVcf, writeQr, readSiteUrl, buildDist, p } from './config.mjs';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}

const hasFlag = (name) => process.argv.includes(`--${name}`);

const card = await readCard();
const name = [card.firstName, card.lastName].filter(Boolean).join(' ');

const vcf = await writeVcf(card);
console.log(`✓ card.vcf  (${Buffer.byteLength(vcf)} bytes) for ${name}`);

/* ---- QR code ---- */
const url = arg('url') || (await readSiteUrl());
if (!url) {
  console.warn('⚠ No card link yet, so no QR was generated.');
  console.warn('  Run: node build.mjs --url https://your-card.netlify.app\n');
} else {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error();
  } catch {
    console.error(`✖ "${url}" is not a valid http(s) URL.`);
    process.exit(1);
  }
  await writeQr(url);
  console.log(`✓ qr.png + qr.svg → ${url}`);
}

/* ---- optional: contact data straight inside the QR ---- */
if (hasFlag('vcard')) {
  await QRCode.toFile(p('qr-direct.png'), vcf, {
    errorCorrectionLevel: 'L', // vCards are big; low EC keeps the QR scannable
    margin: 4,
    width: 1024,
    color: { dark: '#0b1b1f', light: '#ffffff' },
  });
  console.log('✓ qr-direct.png (contact data inside the QR — no hosting needed)');
}

const files = await buildDist();
console.log(`✓ dist/ (${files.length} files) ← drag onto https://app.netlify.com/drop`);
