ALTER TABLE public.property_shares
  ADD COLUMN IF NOT EXISTS share_alias text;

UPDATE public.property_shares
SET share_alias = NULL
WHERE share_alias IS NOT NULL AND btrim(share_alias) = '';

CREATE UNIQUE INDEX IF NOT EXISTS property_shares_share_alias_unique
  ON public.property_shares (LOWER(share_alias))
  WHERE share_alias IS NOT NULL;

CREATE INDEX IF NOT EXISTS property_shares_share_alias_lookup
  ON public.property_shares (LOWER(share_alias));
