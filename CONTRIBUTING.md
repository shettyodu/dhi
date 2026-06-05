# Contributing to the DHI site

This repo is the **deployable DHI website + Netlify functions**. It is connected
to Netlify: **pushing to `main` triggers a production build/deploy**. Other
branches do **not** build, so they are free to push.

- **Repo:** `github.com/shettyodu/dhi`
- **Branches:** `main` (production — auto-deploys) · `dev` (integration — free)
- **Live site:** Netlify `courageous-fairy-0b2d3c`

## Branch & PR workflow

**Never commit directly to `main` or `dev`.** Work on a feature branch and open a PR.

```bash
git checkout dev && git pull          # always start from the latest dev
git checkout -b feature/<area>-<short-desc>
# ...make changes...
git push -u origin feature/<area>-<short-desc>
# then open a Pull Request into `dev` on GitHub
```

- Branch names: `feature/autocommand-inventory`, `fix/checkout-tax`, etc.
- **PRs target `dev`**, not `main`.
- A maintainer reviews, merges into `dev`, previews locally, then merges
  `dev` → `main` to deploy. **Deploys are intentional and confirmed** (Netlify
  build credits are limited) — don't merge to `main` without sign-off.
- Rebase/merge the latest `dev` into your branch before requesting review.

## Secrets — never commit these

Secrets live **only as Netlify environment variables**, never in the repo:

- `STRIPE_SECRET_KEY` (`sk_...`) — server only. The publishable `pk_...` is fine client-side.
- `ADMIN_SECRET` — admin/leads view passphrase.
- `PASSPORT_MINTER_KEY`, `PASSPORT_CONTRACT_ADDRESS`, `BASE_SEPOLIA_RPC_URL` — blockchain.
- `NETLIFY_BLOBS_SITE_ID`, `NETLIFY_BLOBS_TOKEN` — only if set explicitly.

No `.env` files, keys, tokens, or `node_modules/` / build output in commits
(`.gitignore` already blocks these). Share the **variable names** you need; a
maintainer sets the values in Netlify.

## File ownership (avoid merge conflicts)

Coordinate before two people edit the **shared** files at the same time.

**AutoCommand-only — safe to own end-to-end:**
- `site/automotive*.html`, `site/assets/automotive-*.js`
- `backend/lib/leads.js`, `backend/lib/passport.js`
- `backend/netlify/functions/{submit-lead,create-vehicle-passport,verify-vehicle-passport,sign-up-influencer,admin-leads}.js` (+ `backend/api/*` mirrors)
- `backend/blockchain/`

**Shared — announce before editing:**
- `site/assets/components.js` — global nav, footer, `VERTICALS`
- `site/assets/service-data.js` — the `automotive.html` content entry
- `site/assets/service-page.js` — hero / header-size / `heroLogo` logic
- `site/assets/{checkout,catalog-search}.js`
- `backend/lib/{influencer,handlers,admin}.js`

## Backend conventions

- Logic lives in `backend/lib/*` and returns `{ status, json }`. Thin wrappers in
  `backend/netlify/functions/*` (and `backend/api/*` Vercel mirrors) handle
  CORS / OPTIONS / JSON.
- **Any function that uses Netlify Blobs must call `connectLambda(event)` before
  the first Blobs operation** (Lambda-compat functions don't get Blobs context
  automatically). Missing this is the #1 cause of Blobs 503s.
- The smart contract requires `evmVersion: "cancun"` (OZ v5.1 uses `mcopy`).

## Local preview

Static site — serve `site/` over HTTP (e.g. `npx serve site` or any static
server) and open the page. No build step for the front-end.
