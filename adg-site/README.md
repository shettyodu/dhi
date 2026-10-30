# Asset Data Group — standalone site

A self-contained Netlify site for **Asset Data Group** (`assetdatagrp.com`), fully
independent of the DHI site: its own branding (no DHI header/nav/footer), its own
copy of the AI assessment tools, and its own lead capture.

```
adg-site/
  public/
    index.html            # the ADG page (served at the domain root)
    assets/tailwind.css    # compiled styles
  netlify/functions/
    data-assess.js         # POST /.netlify/functions/data-assess  (AI commercialization assessment)
    domain-assess.js       # POST /.netlify/functions/domain-assess (website pre-qualifier)
    submit-lead.js         # POST /.netlify/functions/submit-lead   (lead capture)
  lib/                     # the logic behind the functions
  netlify.toml             # build + headers (publish=public, functions=netlify/functions)
  package.json             # @netlify/blobs + nodemailer
```

## Deploy as its own Netlify site

1. In Netlify, **Add new site → Import from Git**, pick this repo.
2. Set **Base directory** = `adg-site`. Netlify then reads `adg-site/netlify.toml`
   (publish `public`, functions `netlify/functions`). Build command `npm install`.
3. Deploy. The ADG page is served at the site root `/`.

(Alternatively, deploy the `adg-site/` folder as a standalone repo — the layout is
self-contained.)

## Environment variables (set on the ADG Netlify site)

| Variable | Needed for | Notes |
|---|---|---|
| `OPENAI_API_KEY` | the two AI tools | Without it, both assess endpoints return 503 and the page falls back to lead capture. |
| `OPENAI_MODEL_NAME` | optional | Defaults to `gpt-4o-mini`. |
| `OPENAI_BASE_URL` | optional | Defaults to OpenAI; set for an OpenAI-compatible provider. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | lead email | ADG's own mailbox (e.g. StackMail: `mail.stackmail.com`, 587, `contact@assetdatagrp.com`). |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | lead email (fallback) | Used only if `SMTP_*` is unset. |
| `MAIL_FROM` | optional | From header; defaults to `Asset Data Group <user>`. |
| `ADG_LEAD_EMAIL` | optional | Where leads are emailed; defaults to `contact@assetdatagrp.com`. |

Leads are **stored in Netlify Blobs automatically** (no env needed) even when email
is off, so nothing is lost before the mailbox is wired up.

## Point the domain here

Add `assetdatagrp.com` as the custom domain **on this Netlify site** (not the DHI
site). Netlify will show the exact DNS records — apex `A` to Netlify's IP and `www`
`CNAME` to *this* site's `*.netlify.app` subdomain. Leave the StackMail `MX`/`SPF`
records unchanged so email keeps working. The page is the site root, so no redirect
is needed.
