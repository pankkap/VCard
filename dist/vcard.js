/* ------------------------------------------------------------------
   vCard 3.0 builder — single source of truth.
   Used by index.html (browser) and build.mjs (writes card.vcf).
   vCard 3.0 is the format that both iOS Contacts and Android Contacts
   import most reliably.
------------------------------------------------------------------- */

function vEsc(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/* RFC 2426 line folding: max 75 octets per line, continuation = CRLF + space */
function vFold(line, limit = 74) {
  const enc = new TextEncoder();
  const bytes = (s) => enc.encode(s).length;
  const out = [];
  let rest = line;

  while (bytes(rest) > limit) {
    let cut = 0;
    let used = 0;
    let lastSpace = -1;
    for (const ch of rest) {
      const b = enc.encode(ch).length;
      if (used + b > limit) break;
      used += b;
      cut += ch.length;
      if (ch === ' ') lastSpace = cut;
    }
    const at = lastSpace > limit * 0.5 ? lastSpace : cut;
    out.push(rest.slice(0, at));
    rest = rest.slice(at);
  }
  if (rest) out.push(rest);
  return out.join('\r\n ');
}

function buildVCard(card) {
  const first = (card.firstName || '').trim();
  const last = (card.lastName || '').trim();
  const full = [first, last].filter(Boolean).join(' ') || card.company || 'Contact';

  const lines = ['BEGIN:VCARD', 'VERSION:3.0', 'PRODID:-//Digital Business Card//EN'];
  lines.push(`N:${vEsc(last)};${vEsc(first)};;;`);
  lines.push(`FN:${vEsc(full)}`);

  if (card.company) lines.push(`ORG:${vEsc(card.company)}`);
  if (card.jobTitle) lines.push(`TITLE:${vEsc(card.jobTitle)}`);

  if (card.phone) lines.push(`TEL;TYPE=CELL,VOICE:${vEsc(card.phone.replace(/[^\d+*#]/g, ''))}`);
  if (card.email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${vEsc(card.email)}`);
  if (card.website) lines.push(`URL:${vEsc(card.website)}`);

  const adr = [card.street, card.city, card.state, card.zip, card.country];
  if (adr.some(Boolean)) {
    lines.push(`ADR;TYPE=WORK:;;${adr.slice(0, 4).map(vEsc).join(';')};${vEsc(card.country)}`);
  }

  if (card.summary) lines.push(`NOTE:${vEsc(card.summary)}`);

  for (const s of card.socials || []) {
    if (!s || !s.url) continue;
    const type = String(s.type || 'other').replace(/[^a-zA-Z0-9-]/g, '') || 'other';
    lines.push(`X-SOCIALPROFILE;TYPE=${type}:${vEsc(s.url)}`);
  }

  if (card.photoBase64) {
    const type = card.photoType || 'JPEG';
    lines.push(`PHOTO;ENCODING=b;TYPE=${type}:${card.photoBase64}`);
  }

  lines.push(`REV:${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}`);
  lines.push('END:VCARD');

  return lines.map((line) => vFold(line)).join('\r\n') + '\r\n';
}

function vCardFileName(card) {
  const base = [card.firstName, card.lastName].filter(Boolean).join('-') || 'contact';
  return base.replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildVCard, vCardFileName };
}
if (typeof globalThis !== 'undefined') {
  globalThis.buildVCard = buildVCard;
  globalThis.vCardFileName = vCardFileName;
}