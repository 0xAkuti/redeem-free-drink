## Free Drink Redeem

Mobile-first Next.js microsite for redeeming one-time drink coupons.

### Stack

- Next.js 14 App Router
- Redis via Vercel Marketplace or local env vars
- Direct `REDIS_URL` connection from the Node runtime

### Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Set these env vars locally:

```bash
export REDIS_URL=redis://default:password@host:port
export REDEEM_SESSION_SECRET=replace-this-with-a-random-secret
```

Optional:

```bash
export BASE_URL=http://localhost:3000
export YEARS=3
export COUPON_TTL_SECONDS=14400
```

Notes:

- `REDIS_URL` and `REDEEM_SESSION_SECRET` are required.
- `BASE_URL` and `YEARS` are optional defaults for the generation scripts.
- `COUPON_TTL_SECONDS` is only used by generic imports or legacy seed flows. Sunday-scheduled coupons do not need a TTL because their availability is date-based.

### Coupon behavior

- Sunday-generated coupons are assigned to exactly one Sunday date.
- A Sunday coupon is only valid on its assigned Sunday.
- Before that Sunday the app reports it as `scheduled`.
- After that Sunday the app reports it as `expired`.
- Direct access to `/redeemed` is gated by a short-lived signed HttpOnly cookie set only after a successful redemption.
- Legacy codes without a scheduled date are still treated as always-available until redeemed or revoked.

### Timezone

Sunday checks currently use `UTC`.

That means:

- coupon dates are stored as `YYYY-MM-DD`
- a coupon is active only when the current UTC date matches that date
- Sunday means Sunday in UTC, not your local venue timezone

### Coupon API

- `GET /api/coupons/status?code=XXXXYYYY` returns `{ exists, redeemed, status }`
- `POST /api/coupons/redeem` with JSON `{ code }` returns:
  - `200` on success
  - `403` if the coupon is not active today
  - `404` if the code does not exist
  - `409` if the code was already redeemed

### Generate Sunday coupons

Generate one coupon for every Sunday in the next few years:

```bash
npm run gen -- --years 3 --base-url http://localhost:3000
```

Production-oriented batch:

```bash
npm run gen:prod -- --years 3 --base-url https://your-domain.vercel.app > coupons.csv
```

The scripts write CSV to stdout in this format:

```text
date,code,link
2026-03-15,CODE1234,https://your-domain.vercel.app/?c=CODE1234
```

Flags:

- `--years <n>` number of future years to generate, default `3`
- `--base-url <url>` base URL used when printing links

### Coupon admin

Inspect the current Redis-backed coupon set:

```bash
npm run coupons -- --summary
npm run coupons -- --inspect CODE1234
npm run coupons -- --revoke CODE1234
npm run coupons -- --import CODE1234,ABCD5678 --ttl 14400
```

Admin notes:

- `--summary` reports counts for `available`, `redeemed`, `scheduled`, and `expired`
- `--inspect` shows the stored schedule and redemption state for one code
- `--revoke` deletes a code and its redemption marker
- `--import` creates unrestricted codes; it does not assign Sunday dates

### Deploy on Vercel

1. Add a Redis provider from the Vercel Marketplace, or manually set `REDIS_URL`.
2. Add `REDEEM_SESSION_SECRET`.
3. Set `BASE_URL` only if you want a default for local or CI generation commands.
4. Deploy normally. No Prisma generation, migrations, or SQL database setup is required.

### Notes

- Coupon definitions and redemption markers are stored in Redis keys.
- Redemption is atomic, so duplicate redeems are rejected under concurrent requests.
- This repo intentionally avoids storing secrets in committed `.env` files. Use `.env.local`, Vercel env vars, or `vercel env pull`.
