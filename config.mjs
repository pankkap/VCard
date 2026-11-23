/**
 * Shared file plumbing: reads/writes the card config inside index.html,
 * rebuilds card.vcf, regenerates the QR codes, and assembles dist/.
 * Used by build.mjs (CLI) and edit.mjs (the local editor server).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.dirname(fileURLToPath(import.meta.url));
export const p = (...parts) => path.join(root, ...parts);

const BLOCK_RE = /(<script id="card-config" type="application\/json">)([\s\S]*?)(<\/script>)/;
const SITE_FILES = ['index.html', 'vcard.js', 'card.vcf', '_headers', 'qr.png', 'qr.svg'];

export const QR_OPTIONS = {
  errorCorrectionLevel: 'M',
  margin: 4,
  width: 1024,
  color: { dark: '#0b1b1f', light: '#ffffff' },
};

/* ---------- card config ---------- */

export async function readCard() {
  const html = await fs.readFile(p('index.html'), 'utf8');
  const match = html.match(BLOCK_RE);
  if (!match) throw new Error('Could not find <script id="card-config"> in index.html');
  return JSON.parse(match[2]);
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function cardTitle(card) {
  const name = [card.firstName, card.lastName].filter(Boolean).join(' ') || 'Digital Business Card';
  return `${name} — Digital Business Card`;
}

export function cardDescription(card) {
  const role = [card.jobTitle, card.company].filter(Boolean).join(' at ');
  return (role ? `${role}. ` : '') + 'Save my contact details straight to your phone.';
}

export async function writeCard(card) {
  let html = await fs.readFile(p('index.html'), 'utf8');
  if (!BLOCK_RE.test(html)) throw new Error('Could not find <script id="card-config"> in index.html');

  const json = JSON.stringify(card, null, 2);
  html = html.replace(BLOCK_RE, (_m, open, _old, close) => `${open}\n${json}\n${close}`);

  // keep the <title> and social-preview tags in step with the card
  html = html
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(cardTitle(card))}</title>`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, (_m, a, b) => a + esc(cardTitle(card)) + b)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, (_m, a, b) => a + esc(cardDescription(card)) + b)
    .replace(/(<meta name="description" content=")[^"]*(")/, (_m, a, b) => a + esc(cardDescription(card)) + b);

  await fs.writeFile(p('index.html'), html, 'utf8');
}

/* ---------- vCard ---------- */

export async function writeVcf(card) {
  const src = await fs.readFile(p('vcard.js'), 'utf8');
  const { buildVCard } = new Function(src + '\nreturn { buildVCard, vCardFileName };')();
  const vcf = buildVCard(card);
  await fs.writeFile(p('card.vcf'), vcf, 'utf8');
  return vcf;
}

/* ---------- QR ---------- */

export async function readSiteUrl() {
  try {
    return (await fs.readFile(p('qr-url.txt'), 'utf8')).trim();
  } catch {
    return '';
  }
}

export async function writeQr(url) {
  const QRCode = (await import('qrcode')).default;
  await QRCode.toFile(p('qr.png'), url, QR_OPTIONS);
  await fs.writeFile(p('qr.svg'), await QRCode.toString(url, { ...QR_OPTIONS, type: 'svg' }), 'utf8');
  await fs.writeFile(p('qr-url.txt'), url + '\n', 'utf8');
}

/* ---------- publishable folder ---------- */

export async function buildDist() {
  const dist = p('dist');
  await fs.rm(dist, { recursive: true, force: true });
  await fs.mkdir(dist, { recursive: true });
  const copied = [];
  for (const file of SITE_FILES) {
    try {
      await fs.copyFile(p(file), path.join(dist, file));
      copied.push(file);
    } catch {
      /* qr files may not exist yet */
    }
  }
  return copied;
}
