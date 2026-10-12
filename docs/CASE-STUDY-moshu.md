# Case study: Moshu Jiuba (moshucorp.com)

**Client:** Moshu Jiuba 魔术酒吧, a Mandarin live-music bar with grill and drinks in Gading Serpong, Tangerang, Indonesia
**Engagement:** an outsourced build, delivered by one architect working with an AI coding agent
**Timeline:** 8–12 October 2026, five days from content brief to the owner running it unaided
**Running cost:** Rp 0 a month (Supabase Free, Netlify Free, Google OAuth); only the domain is paid

## The starting point

- The owner had no website, just a domain bought at a registrar.
- Promotions, the menu and the singer line-up lived in WhatsApp messages and Instagram posts.
- There was no member list. Regulars were "known by face".
- Constraints:
  - no monthly budget for software;
  - the owner is non-technical and works mostly from a phone;
  - guests are a mix of Mandarin, Indonesian and English speakers.

## Method: forward-deployed, business first

1. **Discovery before code.** I researched the area and the guest demographics, then built a marketing plan around them. The owner's business plan and financial model stayed his; I worked from what he shared and didn't guess at it.
2. **A full owner interview.** I covered business processes, the music and food concept, and the brand's look, taste and tone, so the product fits how the venue actually runs.
3. **Scope by priority.**
   - *Must have:* live site, member sign-in, owner-editable content, security.
   - *Should have:* vouchers, QR member card, backups.
   - *Nice to have:* analytics, POS sync, WhatsApp login. These went on the roadmap.
4. **The back end as well as the front end.**
   - Data model and access rights: who can change what.
   - Row-level security on member data.
   - Versioned content management, so every change can be undone.
5. **Built to grow.** Templates and per-client config from day one, with free tiers that have known upgrade points.
6. **A loop that keeps the system improving.**
   - The owner's requests become features, often within a day.
   - Each change is logged in a changelog.
   - Content history makes trying things out safe.
   - A weekly backup reminder keeps the data owned and portable.
7. **Handover.** A step-by-step Super Admin Guide, plus training until the owner runs it alone.

## What was delivered

| Day | Outcome |
|---|---|
| 1 (8–9 Oct) | Content structured: 22 menu categories, singers, weekly line-up, promotions with terms. A static site was built and published on Netlify, with AI-illustrated photos for items that had none. |
| 2 (10 Oct) | Domain pointed and HTTPS live. "Join via WhatsApp" added as the zero-cost first step. The owner chose a membership option from three costed choices. |
| 2–3 (10–11 Oct) | Supabase project in Singapore, with the member schema: members, visits, vouchers, bottles, song requests. RLS on every table. Google sign-in published. Privacy policy (EN/ID) written. |
| 3 (11 Oct) | Member dashboard with a QR card, and an admin page with scan, visit and spend logging. Linked from the live homepage. |
| 4 (11–12 Oct) | The owner asked "where are the buttons?", so a content manager followed: promotions, menu, singers, line-up, banner, bulk vouchers, image upload, 30-version Undo. |
| 5 (12 Oct) | A production sign-in bug was found and fixed. A Super Admin Guide was written for the owner. A weekly backup reminder was scheduled. |

## Decisions that mattered

1. **Three costed options, the owner picks.** These ran from WhatsApp-only, to a spreadsheet, to a real database on the free tier. The owner chose the database with a weekly Excel backup: real data ownership at zero running cost.
2. **No server.** Static hosting plus Postgres with row-level security leaves nothing to patch or pay for. Admin rights come from an `admin_emails` table checked by `is_admin()`, not from front-end logic.
3. **Content as versioned JSON.** One `site_content` row per section, with a trigger that keeps the last 30 versions. That made "Undo" a one-line feature and made owner self-service safe.
4. **Built-in content first, live content second.** The homepage never depends on the database to render.
5. **Templates from day one.** Brand, colours and contacts were kept separate from the logic, which is what became this repository.

## The bug worth telling

After launch, the owner could sign in from an incognito window but not from his normal Chrome or Edge. Sign-in looped back to the start.

- **Diagnosis:** in those browser profiles, `localStorage` and cookie writes failed silently, so the OAuth session was lost between redirects.
- **Fix:**
  - switch to the PKCE flow;
  - add a storage adapter that writes, reads the value back to verify, and falls back to `sessionStorage`;
  - show visible error messages instead of a silent reset;
  - forward any OAuth result that lands on the homepage to the page that started it.
- **Lesson:** test auth on real users' everyday browser profiles, not just clean ones.

## Outcomes

- The owner edits promotions, menu, singers and the line-up from his phone, with no developer in the loop.
- Members sign in with Google, carry a QR card and claim vouchers straight from a promotion.
- The member data belongs to the venue, with a weekly Excel backup.
- The whole platform became a reusable kit: a second venue is a config file and about an hour of setup.

## In the owner's words

> "John built us a website and a member app, starting with our customers and a full marketing plan. He interviewed me, respected my business plan, and thought through security, access and future growth. In less than a week I could run promotions, the menu and members myself from my phone, at zero monthly cost. Highly recommended."
>
> Edy, Owner, Moshu Jiuba 魔术酒吧, Gading Serpong
