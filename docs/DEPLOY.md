# New-client runbook (about 1 hour)

## 1. Configure

1. Copy the example config: `cp -r clients/example-venue clients/<venue>`.
2. Edit `clients/<venue>/client.json`: brand names, colours, domain, WhatsApp, Instagram, address, owner email, admin email.

## 2. Database (Supabase, free tier)

1. Have the **venue owner** create the Supabase organisation, so the owner holds the data. They invite you as Administrator.
2. Create a project in the region nearest the guests.
3. Copy the project URL and publishable key into `client.json`.
4. Run `python scripts/build_client.py clients/<venue>/client.json`.
5. Paste `dist/<venue>/sql/schema.sql` into the SQL editor and run it. It is safe to re-run.
6. Load the starting content: insert `examples/content.example.json` keys into `site_content`, or start empty and use the admin page.

## 3. Google sign-in

1. In Google Cloud, create an OAuth client (type Web). Set the redirect to `https://<project>.supabase.co/auth/v1/callback`.
2. On the consent screen, set the home page to `https://<domain>` and the privacy page to `https://<domain>/privacy.html`. Publish to production.
3. In Supabase Auth, enable Google. Set the Site URL to `https://<domain>` and the redirect URLs to `https://<domain>/**`.

## 4. Site

1. Copy `dist/<venue>/site/*` next to the venue's homepage. Add `<script src="/live-content.js"></script>` to the homepage.
2. Deploy to Netlify by dragging the folder or connecting the repo, then point the domain.

## 5. Handover

1. Sign in once as the owner and as the admin, then check `/admin.html`.
2. Walk the owner through four tasks: editing a promotion, sending a voucher, scanning a member QR, and the Monday backup.
3. Leave them a one-page guide and set a weekly backup reminder.

## Definition of done

- [ ] Guest can sign in and see a QR card
- [ ] Owner can edit and undo a promotion from a phone
- [ ] A voucher is claimed from the public promotion page
- [ ] The backup downloads as Excel
- [ ] No secrets in the repo or the browser beyond the publishable key
