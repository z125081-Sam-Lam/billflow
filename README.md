# Billflow

Simple invoicing for freelancers and small studios. Create, send, and track invoices in seconds.

**Live app:** https://z125081-sam-lam.github.io/billflow/

## What it does
- Dashboard with paid / outstanding / overdue totals
- Create invoices with line items, tax, and discounts
- Client list with per-client billing history
- Professional invoice view with **Print / Save as PDF**
- Auto "overdue" detection, mark-as-paid, status filters
- Works offline — all data saved in the browser (localStorage)
- Light / dark mode, works on mobile

## Run locally
Just open `index.html` in a browser. No build, no server.

## The path to revenue (how this becomes a paid product)
This is a complete, working front end. To charge money for it you add three things:

1. **Accounts + cloud sync** — so a user's invoices follow them across devices.
   Fastest route: [Supabase](https://supabase.com) (free tier) for auth + database. ~a day of work.
2. **Payments** — [Stripe](https://stripe.com) subscriptions. Two plans, e.g. Free (3 invoices)
   and Pro ($12/mo unlimited + PDF branding). Stripe Checkout is a few hours to wire in.
3. **A landing page + a way to get users** — post in freelancer communities (r/freelance,
   Indie Hackers, designer Discords), offer a free tier, charge for the Pro features.

Realistic: a niche invoicing tool that finds 200 paying users at $12/mo is ~$28k/year.
Getting those users is the real work — the software is the easy part, and it's done.

## Tech
Single HTML file. Vanilla JS, no dependencies, no tracking. ~30 KB.
