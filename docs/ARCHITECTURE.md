# Architecture

## Components

| Layer | Choice | Why |
|---|---|---|
| Hosting | Netlify (static) | Free, global CDN, HTTPS, drag-and-drop deploys an owner could do |
| Data and auth | Supabase (Postgres, Auth, Storage) | Real SQL, row-level security, Google OAuth, free tier |
| Front end | Plain HTML/JS, supabase-js, qrcodejs, SheetJS | No build step; any developer can read it |
| Identity | Google OAuth (PKCE) | One tap for guests; no passwords to store |

## Data model (sql/schema.sql)

- `admin_emails`: the allowlist that decides who is an admin. `is_admin()` reads it.
- `members`: created automatically on first sign-in by the `handle_new_user` trigger. `protect_member_fields` stops members editing tier, points or spend.
- `visits`: spend logged by staff. Totals roll up through `bump_member_totals`.
- `vouchers`, `bottles`, `song_requests`: member-facing records.
- `site_content` (key → JSON): menu, singers, week, promos, banner. Anyone can read it; only admins can write it.
- `site_content_history`: the last 30 versions per key, kept by a trigger. This powers Undo.
- RPCs:
  - `claim_promo_voucher(slug)`: one voucher per member per promotion, enforced on the server.
  - `issue_voucher_bulk(target, …)`: sends vouchers to all members, VIPs, birthday-month members or one email.
- Storage bucket `site-images`: images uploaded from the admin page.

## Security model

- RLS is enabled on every table. Members see only their own rows, and admins see everything through `is_admin()`.
- The publishable key is public by design. Everything it can do is limited by RLS.
- No service-role key ever reaches the browser or this repository.
- Consent is stored per member (`privacy_accepted_at`, `marketing_opt_in`).

## Live content contract

`live-content.js` expects the host homepage to define:

- the arrays `MENU`, `SINGERS`, `WEEK`, `PROMOS` and `PHOTOS`;
- the render helpers `renderMenu()`, `singerCard()`, `pimg()`, `gate()`, `applyPhotos()` and `esc()`;
- the containers `.promostrip`, `.promogrid`, `.weekgrid`, `.lulist`, `.singer2` and `.singer4`.

It fetches `site_content` and swaps each array in place. It then re-renders the page using the page's own functions, so live content inherits the page's design and language switching. If the fetch fails, nothing changes on the page.

## Auth resilience

```js
const SafeStore = { /* localStorage, verified by read-back; falls back to sessionStorage */ };
createClient(URL, KEY, { auth: { storage: SafeStore, flowType: 'pkce', detectSessionInUrl: true } });
```

See the case study for the production incident that led to this.
