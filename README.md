# Digital business card + QR code

A one-page, phone-sized business card. Scanning the QR opens the page; tapping
**Save to Contacts** adds the details to iPhone or Android as a real vCard
contact (phone, email, company, address, website, notes, social links).

```
index.html     the card page (all styling inline, no frameworks)
editor.html    form-driven editor with live preview + QR download
edit.mjs       tiny local server the editor writes through
config.mjs     shared file logic (config, vCard, QR, dist)
vcard.js       builds the .vcf — shared by the page and the scripts
card.vcf       the contact file people actually download
build.mjs      CLI build (no browser needed)
qr.png/.svg    QR pointing at the hosted page (1024px + vector)
dist/          the exact folder you publish
```

## Edit your card

```bash
npm install      # once
npm start        # opens http://localhost:4321/editor.html
```

Fill in the form, then **Save changes** (or ⌘S / Ctrl+S):

- writes your details into `index.html`
- rebuilds `card.vcf`
- regenerates `qr.png` + `qr.svg` and refreshes `dist/`
- refreshes the phone preview on the right

The editor runs on your machine only — it needs the small local server to write
files, so it is not part of the published site.

### The QR panel

- **Card link** is the address the QR points at — your published page.
- **Download PNG** (1024px, for chat/email/print) or **SVG** (vector, best for
  printing at any size). Both download with sensible file names.
- The QR updates as you type a link, so you can check it before saving.
- A warning shows while the placeholder `your-card.netlify.app` is still in
  place — replace it with your real address.

## Publish, then point the QR at it

1. Fill everything in the editor and set nothing in *Card link* yet.
2. Drag the `dist/` folder onto <https://app.netlify.com/drop>. You get a public
   `https://….netlify.app` link in seconds (free, no account needed to try;
   claim the site to keep the URL).
3. Paste that link into **Card link** and hit **Save changes**.
4. Drag `dist/` onto Netlify again (or drop just the new `qr.png`/`qr.svg`).

Prefer the command line? `node build.mjs --url https://your-site.netlify.app`
does the same thing and refreshes `dist/`.

## Why saving works on both phones

- **iPhone / iPad:** the button links to `card.vcf`, served as `text/vcard`
  (see `_headers`). Safari recognises it and opens the native contact preview
  with *Add All Contacts* — no "download to Files, then hunt for it" detour.
  That is also why the link deliberately has no `download` attribute on iOS.
- **Android:** the page builds the vCard in the browser and downloads
  `<name>.vcf`; tapping the notification opens the Contacts import screen.
- The vCard is **version 3.0**, the format both iOS and Android Contacts import
  most reliably, with correct escaping and 75-octet line folding.
- With JavaScript off, the plain `card.vcf` link still works.

## Optional extras

**Photo** — put a square image next to `index.html` (e.g. `photo.jpg`) and set
*Photo URL* to `photo.jpg` in the editor. To also embed it inside the contact,
add `"photoBase64"` (base64 JPEG, no `data:` prefix) and `"photoType": "JPEG"`
to the config block — keep it under ~100 KB or some Android builds crawl.

**Offline QR (no hosting)** — `node build.mjs --vcard` also writes
`qr-direct.png`, a QR carrying the whole contact inside it. Scanning that saves
the contact without opening any page, but the code is denser, uneditable, and
cannot include a photo.

**Social icons** — supported: `linkedin`, `x`, `instagram`, `facebook`,
`youtube`, `tiktok`, `github`, `telegram`, `website`. Anything else shows a
globe; links are also stored as `X-SOCIALPROFILE` entries in the contact.

## Handy commands

```bash
npm start                    # editor at http://localhost:4321/editor.html
npm run build -- --url URL   # rebuild vCard, QR, dist/ from index.html
npm run serve                # plain static preview on :8080 (no editor API)
```
