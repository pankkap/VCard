# How to Update and Redeploy Your Digital Business Card

This guide provides step-by-step instructions for editing your vCard details, generating updated QR codes, and redeploying to production (`https://vcard.beta-labs.in`).

---

## 1. Start the Local Editor

The editor runs locally and is **not** exposed to the public internet.

1. Open your terminal in this repository folder:
   ```bash
   cd /Users/PANKKAP/1-MyProjects/VCard
   ```
2. Start the local editor server:
   ```bash
   npm start
   ```
3. Open the editor in your browser:
   ```text
   http://localhost:4321/editor.html
   ```

> [!NOTE]
> If port `4321` is ever reported as busy or shows a stale page, find and kill the process:
> ```bash
> lsof -i :4321
> kill -9 <PID>
> npm start
> ```

---

## 2. Edit Your Information

In the web editor (`http://localhost:4321/editor.html`):

* **Personal & Work Details:** Update First/Last Name, Job Title, Company, Bio, Phone, Email, and Website.
* **Address & Socials:** Add or modify address lines and social media profiles (LinkedIn, X/Twitter, GitHub, etc.).
* **Production Card Link:** Make sure the **Card link** field in the right-hand panel points to your production URL:
  ```text
  https://vcard.beta-labs.in
  ```
* **Live Preview:** Check the phone simulator on the right to see how the card looks in real time.

---

## 3. Save Your Changes

Click **Save changes** (or press `⌘S` / `Ctrl+S`).

Saving automatically triggers the local build system:
* Updates `index.html` with your new contact details.
* Rebuilds `card.vcf` (the contact file imported by iPhones and Android devices).
* Re-generates `qr.png` and `qr.svg` pointing to your production link.
* Packages all deployment files into the `dist/` directory.

*(Optional)* Click **Download PNG** or **SVG** under the QR code panel if you need physical or digital copies of the updated QR code.

---

## 4. Redeploy to Production

Choose the deployment method you configured for your site:

### Option A: Netlify Drag & Drop
1. Log in to your [Netlify Dashboard](https://app.netlify.com).
2. Select your site.
3. Go to the **Deploys** tab.
4. Drag and drop the `dist/` folder from this repo directly into the upload dropzone.
5. Deployment will be live within seconds.

### Option B: Git Push (Automatic Deployment)
If your Netlify / hosting service is connected to your GitHub repository:
```bash
git add .
git commit -m "Update contact details and rebuild card"
git push origin main
```
Your host will automatically build and publish the latest commit.

---

## Quick Reference Summary

| Task | Command / Action |
| :--- | :--- |
| **Launch Editor** | `npm start` → `http://localhost:4321/editor.html` |
| **Preview Site Locally** | `http://localhost:4321/` |
| **Rebuild Without Browser** | `npm run build -- --url https://vcard.beta-labs.in` |
| **Publish Folder** | `dist/` |
