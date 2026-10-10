# Cosplay Calendar

A calendar for cosplayers. Pin your city, price the trip, and see a planning estimate of your chance to place — from your own past results, not from a promise.

Shows from October 2026 through 2027 are dated from organizer pages where those dates were public on 10 Oct 2026. Badge prices, hotels, and purses are **planning estimates** unless a note says the figure was published.

## What you can do

- Browse the month, filter by region, category, budget, travel time, and purse.
- Pin a city or use your location. Auto mode picks rail inside Europe under 900 km, drive under 700 km, otherwise a flight.
- Enter craft, stage presence, division, and old placements. The odds model is a field-size prior, not a judge.
- Ask a runway coach about packing, call time, and budget. Paste your own key from [console.x.ai](https://console.x.ai), or switch on the hosted coach.
- The **$9/month** line is the price of a hosted key on your own deploy. This app does not charge a card.
- Interface strings ship in 20 languages. Other wording can be translated with your key.

## Cloudflare

`cloudflare/` is a Worker for `POST /api/coach`.

```bash
cd cloudflare
npx wrangler secret put XAI_API_KEY
npx wrangler deploy
```

The key is the visitor’s, when they send one, or the deployer’s secret. Nothing in the worker bills $9.

## Stack

TanStack Start, React, Tailwind. Personal settings stay in the browser.
