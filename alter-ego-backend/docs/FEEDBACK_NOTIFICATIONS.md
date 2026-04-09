# Feedback → team email / automation

Feedback from **Settings → Contact** is always stored in Supabase (`feedback_submissions`).

To also notify your team by email (or Formspree → Gmail, Slack, etc.), configure **one or both** of the following on the backend (Render / `.env`):

## 1. Webhook (Formspree or any HTTPS endpoint)

- **`FORMSPREE_WEBHOOK_URL`** — preferred env name for Formspree.
- **`FEEDBACK_WEBHOOK_URL`** — same behaviour; use if you prefer a clearer name.
- **`FORMSPREE_FEEDBACK_URL`** — optional alias; same as the above.

**Formspree:** put your `https://formspree.io/f/xxxx` URL in any of the env vars above. The server detects Formspree and sends **`application/x-www-form-urlencoded`** fields (`message`, `feedback_type`, `user_id`, etc.) so submissions show up in your inbox. Other URLs still receive **JSON** as below.

**Generic webhook:** the backend POSTs JSON:

```json
{
  "user_id": "...",
  "type": "bug|concern|suggestion|other",
  "content": "...",
  "app_version": "...",
  "submitted_at": "2026-03-20T12:00:00Z"
}
```

If the webhook returns HTTP ≥ 400 or the request fails, a **warning** is logged (check Render logs).

## 2. Resend (direct email)

Set:

- **`RESEND_API_KEY`** — API key from [Resend](https://resend.com).
- **`FEEDBACK_NOTIFY_EMAIL`** — your team inbox (e.g. `team@yourdomain.com`).
- **`RESEND_FROM_EMAIL`** (optional) — verified sender; default `onboarding@resend.dev` for testing.

If Resend returns an error, a **warning** is logged.

## Nothing configured?

You will see an **info** log line on each submission explaining that only the database was written. Submissions are not lost; they are in `feedback_submissions`.
