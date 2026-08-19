# Supabase Setup

## Local development

1. Create the local environment configuration at the project root in `.env.local`.
2. Add public Supabase placeholders:

```env
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

3. Start the application with `pnpm dev`. Restart the development server after changing environment configuration.

## Deployment

Configure the same variables in your deployment platform's environment settings, then redeploy the application. Environment changes are not applied to an already running deployment.

## Security

Only the project URL and anon key belong in `NEXT_PUBLIC_*` variables. Service-role keys and other secret keys must never use the `NEXT_PUBLIC_*` prefix and must never be committed.
