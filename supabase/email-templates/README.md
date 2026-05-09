# Auth email templates

Templates that get sent to users by Supabase Auth — magic-link sign-in,
account confirmation, password reset, etc. Source of truth lives here so
changes are version-controlled. After editing a file in this folder, paste
its contents into the matching template in the Supabase dashboard:

> Authentication → Emails → Templates → _\<template name\>_

The dashboard is the only place these actually run from; this directory is
a backup + diff tool, not a build input.

## Files

| File                  | Dashboard template | Subject (set in dashboard) |
| --------------------- | ------------------ | -------------------------- |
| `magic-link.html`     | Magic link         | `Sign in to Libretto`      |

(More to come: `confirm-signup.html`, `reset-password.html`, `change-email.html`,
`invite.html`, `reauthentication.html` — all the same pattern.)

## How sending works end-to-end

```
user submits email
        ↓
Supabase Auth (rate-limited, generates one-time token)
        ↓
SMTP → smtp.resend.com (port 465)
        ↓     (auth: username "resend", password = Resend API key)
        ↓
Resend (verifies domain, signs DKIM, hands to SES)
        ↓
recipient's inbox  ← from: noreply@libretto.akinshonibare.com
                         display: "Libretto"
```

## Wiring it up (one-time setup)

These steps were run on 2026-05-09 — recorded here so a future operator can
re-do them without piecing it together from scratch.

### 1 · Resend

1.  Account: `akinkunmishonibare@gmail.com`.
2.  **Domains → Add domain:** `libretto.akinshonibare.com`.
    Region: us-east-1.
3.  Add the four DNS records Resend gives you to the `akinshonibare.com`
    zone — `libretto` is treated as a sub-zone. The exact records change
    per domain so always pull them from the Resend dashboard, but the
    shape is:

    | Type | Host (relative to akinshonibare.com)   | Value (excerpt)                           | TTL  | Prio |
    | ---- | -------------------------------------- | ----------------------------------------- | ---- | ---- |
    | TXT  | `resend._domainkey.libretto`           | `p=MIGfMA…wIDAQAB` (DKIM public key)      | Auto | —    |
    | MX   | `send.libretto`                        | `feedback-smtp.us-east-1.amazonses.com`   | Auto | 10   |
    | TXT  | `send.libretto`                        | `v=spf1 include:amazonses.com ~all`       | Auto | —    |
    | TXT  | `_dmarc.libretto`                      | `v=DMARC1; p=none;`                       | Auto | —    |

    DNS host fields are **relative to the parent zone** (`akinshonibare.com`).
    If your registrar wants the FQDN, append `.akinshonibare.com` to each
    Host above.
4.  Wait for Resend to mark the domain Verified (usually <5 min).
5.  **API keys → Create API key:** name `supabase-auth-smtp`, permission
    `Sending access`. Copy the `re_…` token. You see this exactly once.

### 2 · Supabase

Project: `libretto` (`agmkjyxujmcpskijoitm`).

1.  **Authentication → Emails → SMTP Settings → Enable custom SMTP**
    - Sender email: `noreply@libretto.akinshonibare.com`
    - Sender name: `Libretto`
    - Host: `smtp.resend.com`
    - Port: `465`
    - Username: `resend`
    - Password: the Resend API key from step 1.5
    - Min interval per user: `60` (seconds)
2.  **Authentication → URL Configuration**
    - Site URL: `https://libretto.akinshonibare.com`
    - Redirect URL allowlist must include `…/auth/callback` for every
      origin you sign in from (prod, preview wildcard, localhost).
3.  **Authentication → Emails → Templates → Magic link**
    - Subject: `Sign in to Libretto`
    - Body: paste contents of [`magic-link.html`](./magic-link.html).

## When updating a template

1.  Edit the `.html` file here, commit, push, open a PR.
2.  Once merged, copy the new contents into the matching dashboard
    template and click **Save changes**. Supabase doesn't pull from this
    directory — the dashboard is canonical at runtime.
3.  Send a test from **Auth → Users → invite a test email** (or use
    `signInWithOtp` on a staging account) to confirm rendering.

## Changing the sender domain later

If we move from `libretto.akinshonibare.com` to a real apex domain
(e.g. `libretto.app`):

1.  Add the new domain in Resend, install its DNS records, wait for
    verification.
2.  Mint a new `supabase-auth-smtp` API key scoped to the new domain
    (Resend forces re-issue when you scope to a verified domain).
3.  Update Supabase **SMTP Settings**: change Sender email to the new
    address; rotate the Password to the new key.
4.  Once deliverability looks healthy on the new domain, delete the old
    domain in Resend and revoke the old API key.
5.  Update Supabase **URL Configuration** Site URL + redirect allowlist
    to the new origin.

## Why custom SMTP (over Supabase's default)

The default Supabase email service is fine for development but:

- Sends from a shared Supabase domain → DMARC/SPF mediocre, frequently
  lands in Promotions or worse.
- Hard cap of 4 emails / hour project-wide → unusable for any real
  signup volume.
- No control over sender name, subject, or retries.

Custom SMTP via Resend gets us:

- `noreply@libretto.akinshonibare.com` as the sender, signed by our
  DKIM key, traceable to a domain we own.
- No per-project rate cap (Resend free tier is 3K emails/month, 100/day).
- Send/bounce/open analytics in the Resend dashboard.
- A clean migration path to React Email + Send Email Hook later if we
  want richer, per-user content.
