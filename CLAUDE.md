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
