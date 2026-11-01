# Asset Data Group — operations & go-live checklist

All of the following are **environment variables set on the ADG Netlify site**
(Site configuration → Environment variables), followed by a redeploy
(Deploys → Trigger deploy). Set via the UI, not the CLI — CLI-set vars do not
reliably reach the functions.

## 1. Lead email notifications (so leads do not sit unseen)

Leads are always stored; they are only **emailed** once a mailer is configured.
Use the StackMail mailbox for `contact@assetdatagrp.com`:

| Variable | Value |
|---|---|
| `SMTP_HOST` | `mail.stackmail.com` (confirm with the host) |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `contact@assetdatagrp.com` |
| `SMTP_PASS` | the mailbox password |
| `MAIL_FROM` | `Asset Data Group <contact@assetdatagrp.com>` (optional) |
| `ADG_LEAD_EMAIL` | where leads are sent (optional; defaults to `contact@assetdatagrp.com`) |

Then confirm the `contact@assetdatagrp.com` mailbox actually exists. (Gmail works as
a fallback with `GMAIL_USER` + `GMAIL_APP_PASSWORD`.)

## 2. Rate limiting (cost/abuse protection on the AI + lead endpoints)

The limiter is **inert until** an Upstash Redis is connected. Create a free database
at upstash.com (Redis), then set:

| Variable | Value |
|---|---|
| `UPSTASH_REDIS_REST_URL` | from the Upstash console (REST URL) |
| `UPSTASH_REDIS_REST_TOKEN` | from the Upstash console (REST token) |

Once set, the AI endpoints are capped at 20 requests / 10 min / IP and the lead form
at 10 / 10 min / IP. A limiter error always fails open, so it never breaks a request.

## 3. Health & uptime monitoring

`GET /.netlify/functions/health` returns a JSON readiness summary and HTTP 503 if a
critical dependency is missing. Point an uptime monitor (e.g. UptimeRobot) at it:

- **Every 5 min:** `https://assetdatagrp.com/.netlify/functions/health` — alert on non-200.
- **Every 15–30 min:** `https://assetdatagrp.com/.netlify/functions/health?deep=1` —
  makes a one-token OpenAI call so a lapsed OpenAI balance (the AI tools going dark)
  triggers an alert. Alert on non-200 or on body not containing `"ok":true`.

## Other env already in use
`OPENAI_API_KEY` (AI tools), `OPENAI_MODEL_NAME` (optional), `ADG_PASSCODE` (CRM gate).

## CRM access
Internal pipeline at `https://assetdatagrp.com/crm.html`, gated by `ADG_PASSCODE`.
