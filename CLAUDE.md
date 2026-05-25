# wyld

Expo Router web app: gym owner dashboard plus public per-gym websites,
backed by Supabase.

## Database migrations

SQL migrations live in `supabase/migrations/`. They are **not** applied by
the Netlify build — they must be run against the Supabase database
separately.

The repo owner has authorized applying migrations directly via the Supabase
Management API. Credentials are in `.env.local` (gitignored — never commit
the token):

- `SUPABASE_ACCESS_TOKEN` — Supabase Management API access token
- `SUPABASE_PROJECT_REF` — the `wyld` project ref

When a change needs a new migration: write the `.sql` file in
`supabase/migrations/`, then apply it without asking — POST the SQL to the
Management API:

```bash
source .env.local
curl -s -X POST \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"<SQL here>"}' \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query"
```

A `[]` response means success (DDL returns no rows).

## Dates: always use a picker

Anywhere a user enters a date or date+time — on the owner dashboard,
admin pages, member portal, public gym site, schedule, time clock,
expenses, milestones, anything — render a picker, never a plain text
input. The picker must work on desktop browsers, mobile browsers, AND
native (iOS/Android). The shared `components/DateTimeField` covers
this; use `mode='date'` for date-only fields and the default
`mode='datetime'` for date+time. If you find a `<TextInput>` taking
free-text date strings somewhere, replace it.
