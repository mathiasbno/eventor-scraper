# CLAUDE.md

## Database: never wipe data

- **Never run `supabase db reset` or `supabase db push`** (with or without `npx`, locally or against production). Both are denied in `.claude/settings.json`.
- Apply new migrations with `supabase migration up` so existing data is kept:
  - Local: `npx supabase migration up`
  - Production: `npx supabase migration up --db-url <production url>`
- Production is self-hosted Supabase on a VPS; the linked Supabase Cloud project ref is dead.
