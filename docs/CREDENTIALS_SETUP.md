# Credentials and Secret Rotation

The former shared-credentials workflow is retired. A Supabase service-role key and
a credential-write secret were committed to repository history; treat both as
compromised even though current source files no longer contain their values.
Do not use the old setup page, `credentials_config` flow, or shared write secret.

## Required operator actions

1. In Supabase, rotate/revoke the exposed service-role API key using the
   project's supported API-key rotation process. Update Cloudflare Pages,
   Supabase Edge Function secrets, and any authorized automation with the new
   key. Do not paste credentials into chat or commit them.
2. Rotate the credential-write secret and disable the obsolete
   `store-credentials` endpoint/table access if it exists in the deployed
   project.
3. Revoke any GitHub personal access token, ImageKit private key, Supabase
   access token, Cloudflare token, AI-provider key, or Google/Apps Script
   credential found in either repository's history. Replace each only in its
   provider's trusted secret store.
4. Once credentials are revoked, coordinate a repository-wide history rewrite
   with all collaborators and forks. A history rewrite does not replace key
   rotation and requires updating every clone.

## Local and deployment configuration

- Keep local values in ignored `.env.local` files or a password manager.
- Use `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, and
  `IMAGEKIT_PRIVATE_KEY` only in trusted backend or operator environments.
- The service-role key is never a browser key. Browser code uses only the
  Supabase anon/publishable key and row-level security.
- `credentials-config.mjs` reads the service-role key from the environment and
  fails if it is absent; it does not contain a credential fallback.