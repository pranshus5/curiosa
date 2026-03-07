# Curiosa — Deployment Guide
## From zero to live in ~30 minutes

---

## What you'll have when done

- Live URL (e.g. `curiosa.vercel.app` or your own domain)
- 7 fresh AI-curated articles appear every morning at 6 AM UTC
- Read state, streaks, and annotations persist per-browser
- Fully free on Vercel Hobby + Supabase Free tier

---

## Step 1 — Supabase (your database) ~5 min

1. Go to **https://supabase.com** → Sign up (free)
2. Click **New Project** → name it `curiosa` → choose a region close to you → set a database password (save it) → **Create Project**
3. Wait ~2 minutes for it to spin up
4. In the left sidebar → **SQL Editor** → paste the entire contents of `supabase-schema.sql` → click **Run**
5. Go to **Settings → API** and copy these three values — you'll need them shortly:
   - `Project URL` → this is your `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` key → this is your `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2 — GitHub (host your code) ~5 min

1. Go to **https://github.com** → New repository → name it `curiosa` → Public or Private → **Create**
2. On your computer, open Terminal in the `curiosa/` project folder and run:

```bash
git init
git add .
git commit -m "Initial Curiosa app"
git remote add origin https://github.com/YOUR_USERNAME/curiosa.git
git push -u origin main
```

---

## Step 3 — Vercel (hosting + daily cron) ~10 min

1. Go to **https://vercel.com** → Sign up with GitHub (free)
2. Click **Add New → Project** → Import your `curiosa` repo → **Deploy**
3. Before deploying, click **Environment Variables** and add ALL of these:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` (your key from console.anthropic.com) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` |
| `CRON_SECRET` | Any random string, e.g. `curiosa-cron-2026` |

4. Click **Deploy** → wait ~2 minutes → your app is live! 🎉

---

## Step 4 — Seed today's articles (first run) ~2 min

The cron runs at 6 AM UTC daily, but you need articles right now.
Trigger it manually by visiting this URL in your browser:

```
https://YOUR-APP.vercel.app/api/cron/generate-articles?secret=YOUR_CRON_SECRET
```

Wait 30–60 seconds → refresh your app → articles appear! ✦

> Alternatively add `Authorization: Bearer YOUR_CRON_SECRET` as a header if using curl:
> ```bash
> curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
>      https://YOUR-APP.vercel.app/api/cron/generate-articles
> ```

---

## Step 5 — Custom domain (optional) ~5 min

1. In Vercel → your project → **Settings → Domains**
2. Add your domain (e.g. `curiosa.app`) → follow DNS instructions
3. That's it — Vercel handles HTTPS automatically

---

## How the daily cron works

Every morning at **6:00 AM UTC**, Vercel automatically calls:
```
GET /api/cron/generate-articles
```

This function:
1. Checks if articles already exist for today (prevents duplicates)
2. Picks 7 diverse categories
3. Calls Claude to generate one rich article per category
4. Saves all 7 articles to your Supabase database
5. Users see fresh articles when they open the app

**Cost estimate:**
- 7 articles × ~800 tokens each = ~5,600 output tokens/day
- At Claude Opus pricing: ~$0.08/day = ~$2.50/month
- Vercel Hobby: Free
- Supabase Free tier: Free (up to 500MB, 2GB bandwidth)
- **Total: ~$2–5/month** (just the Claude API)

---

## Troubleshooting

**No articles showing?**
→ Manually trigger the cron (Step 4 above)
→ Check Vercel → your project → **Functions** tab for error logs

**Cron not running?**
→ Verify `vercel.json` is at the root of your project
→ Cron jobs require Vercel (they don't run on Netlify)
→ Check **Settings → Cron Jobs** in your Vercel project

**Database errors?**
→ Make sure you ran the full `supabase-schema.sql` in Supabase SQL Editor
→ Verify your `SUPABASE_SERVICE_ROLE_KEY` is correct (it's different from the anon key)

**Build errors?**
→ Make sure `node_modules` isn't committed (add to `.gitignore`)
→ Run `npm install` locally and fix any TypeScript errors first

---

## File structure reference

```
curiosa/
├── app/
│   ├── api/
│   │   ├── articles/
│   │   │   ├── route.ts          ← fetch articles by date
│   │   │   └── insight/route.ts  ← AI intellectual companion
│   │   ├── cron/
│   │   │   └── generate-articles/route.ts  ← daily cron job ★
│   │   └── user/route.ts         ← read state + annotations
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                  ← server-renders today's articles
├── components/
│   └── CuriosaClient.tsx         ← full UI (reader, feed, notebook)
├── lib/
│   ├── generate-articles.ts      ← Claude article generation logic
│   └── supabase.ts               ← DB client helpers
├── types/
│   └── index.ts                  ← shared TypeScript types
├── supabase-schema.sql           ← run this once in Supabase
├── vercel.json                   ← cron schedule config
├── next.config.js
└── package.json
```

---

## Future enhancements (when you're ready)

- **Add Supabase Auth** → real user accounts, sync across devices
- **PWA / installable app** → add `manifest.json` + service worker
- **RSS mode** → swap `generate-articles.ts` to pull real RSS feeds → Claude summarises
- **Email digest** → weekly email of your reading history
- **Sharing** → share article links with `/article/[id]` dynamic routes
