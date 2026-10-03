-- Canonical public-facing profiles with private source aliases and
-- property-specific roles. A source poster is not assumed to own or manage a
-- property; only an explicit property-party verification can establish that.

CREATE TABLE IF NOT EXISTS public.party_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_key TEXT NOT NULL UNIQUE,
  profile_kind TEXT NOT NULL CHECK (profile_kind IN ('person', 'organization')),
  category TEXT NOT NULL CHECK (category IN (
    'owner', 'property_owner', 'property_manager', 'agent', 'broker',
    'brokerage', 'company', 'unknown'
  )),
  display_name TEXT NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 200),
  public_image_url TEXT,
  public_bio TEXT,
  public_website_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  identity_status TEXT NOT NULL DEFAULT 'source_reported' CHECK (identity_status IN (
    'source_reported', 'account_claimed', 'identity_verified', 'review', 'rejected'
  )),
  claim_status TEXT NOT NULL DEFAULT 'unclaimed' CHECK (claim_status IN (
    'unclaimed', 'claimed', 'disabled'
  )),
  landlord_id UUID UNIQUE REFERENCES public.landlords(id) ON DELETE SET NULL,
  claimed_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.party_profile_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_profile_id UUID NOT NULL REFERENCES public.party_profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_profile_key TEXT NOT NULL,
  source_profile_id UUID UNIQUE REFERENCES public.source_profiles(id) ON DELETE SET NULL,
  observed_name TEXT NOT NULL,
  observed_image_url TEXT,
  observed_profile_url TEXT,
  match_method TEXT NOT NULL CHECK (match_method IN (
    'profile_url', 'source_name', 'account', 'manual'
  )),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_profile_key)
);

CREATE TABLE IF NOT EXISTS public.property_party_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  party_profile_id UUID NOT NULL REFERENCES public.party_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN (
    'source_poster', 'account_contact', 'owner', 'legal_lessor',
    'property_manager', 'listing_agent'
  )),
  relationship_status TEXT NOT NULL DEFAULT 'source_reported' CHECK (relationship_status IN (
    'source_reported', 'account_claimed', 'identity_verified',
    'authority_verified', 'needs_review', 'rejected'
  )),
  is_public_contact BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_reference TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, party_profile_id, role)
);

ALTER TABLE public.landlords
  ADD COLUMN IF NOT EXISTS party_profile_id UUID
  REFERENCES public.party_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.source_profiles
  ADD COLUMN IF NOT EXISTS party_profile_id UUID
  REFERENCES public.party_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS party_profiles_display_name_idx
  ON public.party_profiles (lower(display_name));
CREATE INDEX IF NOT EXISTS party_profile_aliases_party_idx
  ON public.party_profile_aliases (party_profile_id);
CREATE INDEX IF NOT EXISTS property_party_roles_property_idx
  ON public.property_party_roles (property_id, role);
CREATE INDEX IF NOT EXISTS property_party_roles_profile_idx
  ON public.property_party_roles (party_profile_id);

ALTER TABLE public.party_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_profile_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_party_roles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.party_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.party_profile_aliases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.property_party_roles FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.party_profiles TO service_role;
GRANT ALL ON public.party_profile_aliases TO service_role;
GRANT ALL ON public.property_party_roles TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_party_profile(
  p_source TEXT,
  p_category TEXT,
  p_name TEXT,
  p_image_url TEXT DEFAULT NULL,
  p_profile_url TEXT DEFAULT NULL,
  p_source_profile_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_source TEXT := lower(coalesce(nullif(btrim(p_source), ''), 'unknown'));
  v_category TEXT := lower(coalesce(nullif(btrim(p_category), ''), 'unknown'));
  v_name TEXT := left(nullif(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), ''), 200);
  v_url TEXT := lower(regexp_replace(regexp_replace(btrim(coalesce(p_profile_url, '')), '[?#].*$', ''), '/+$', ''));
  v_profile_key TEXT;
  v_source_key TEXT;
  v_match_method TEXT;
  v_kind TEXT;
  v_profile_id UUID;
  v_alias_profile_id UUID;
BEGIN
  IF v_name IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_category NOT IN ('owner', 'property_owner', 'property_manager', 'agent', 'broker', 'brokerage', 'company') THEN
    v_category := 'unknown';
  END IF;
  v_kind := CASE WHEN v_category IN ('brokerage', 'company') THEN 'organization' ELSE 'person' END;

  IF v_url <> '' AND v_url ~ '^https?://' THEN
    v_profile_key := 'url|' || v_category || '|' || v_url;
    v_source_key := v_url;
    v_match_method := 'profile_url';
  ELSE
    v_source_key := lower(v_name);
    v_profile_key := 'source|' || v_source || '|' || v_category || '|' || v_source_key;
    v_match_method := 'source_name';
  END IF;

  INSERT INTO public.party_profiles (
    profile_key, profile_kind, category, display_name,
    identity_status, claim_status, is_public
  ) VALUES (
    v_profile_key, v_kind, v_category, v_name,
    'source_reported', 'unclaimed', TRUE
  )
  ON CONFLICT (profile_key) DO UPDATE
    SET last_seen_at = now(), updated_at = now()
  RETURNING id INTO v_profile_id;

  INSERT INTO public.party_profile_aliases (
    party_profile_id, source, source_profile_key, source_profile_id,
    observed_name, observed_image_url, observed_profile_url, match_method
  ) VALUES (
    v_profile_id, v_source, v_source_key, p_source_profile_id,
    v_name, nullif(btrim(p_image_url), ''), nullif(btrim(p_profile_url), ''), v_match_method
  )
  ON CONFLICT (source, source_profile_key) DO UPDATE
    SET last_seen_at = now(),
        observed_image_url = coalesce(EXCLUDED.observed_image_url, public.party_profile_aliases.observed_image_url),
        observed_profile_url = coalesce(EXCLUDED.observed_profile_url, public.party_profile_aliases.observed_profile_url)
  RETURNING party_profile_id INTO v_alias_profile_id;

  RETURN coalesce(v_alias_profile_id, v_profile_id);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_party_profile(TEXT, TEXT, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_party_profile(TEXT, TEXT, TEXT, TEXT, TEXT, UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.sync_source_profile_party_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  v_profile_id := public.resolve_party_profile(
    NEW.source, NEW.profile_type, NEW.display_name, NEW.image_url, NEW.profile_url, NEW.id
  );
  UPDATE public.source_profiles
     SET party_profile_id = v_profile_id
   WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_source_profile_party_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS source_profiles_sync_party_profile ON public.source_profiles;
CREATE TRIGGER source_profiles_sync_party_profile
AFTER INSERT OR UPDATE OF source, profile_key, profile_type, display_name, image_url, profile_url
ON public.source_profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_source_profile_party_profile();

CREATE OR REPLACE FUNCTION public.sync_landlord_party_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_category TEXT;
  v_kind TEXT;
  v_name TEXT;
  v_profile_id UUID;
BEGIN
  v_category := CASE
    WHEN NEW.account_type IN ('brokerage', 'agency', 'llc', 'property_management') THEN 'company'
    WHEN NEW.account_type = 'realtor' THEN 'agent'
    WHEN NEW.account_type = 'property_owner' THEN 'property_owner'
    ELSE 'owner'
  END;
  v_kind := CASE WHEN v_category IN ('company', 'brokerage') THEN 'organization' ELSE 'person' END;
  v_name := coalesce(nullif(btrim(NEW.business_name), ''), nullif(btrim(NEW.contact_name), ''), 'Property contact');

  INSERT INTO public.party_profiles (
    profile_key, profile_kind, category, display_name, public_image_url,
    public_bio, public_website_url, identity_status, claim_status,
    landlord_id, claimed_user_id, is_public
  ) VALUES (
    'account|' || NEW.id::text, v_kind, v_category, v_name, NEW.avatar_url,
    NEW.bio, NEW.website, 'account_claimed', 'claimed', NEW.id, NEW.user_id, TRUE
  )
  ON CONFLICT (profile_key) DO UPDATE SET
    profile_kind = EXCLUDED.profile_kind,
    category = EXCLUDED.category,
    display_name = EXCLUDED.display_name,
    public_image_url = coalesce(EXCLUDED.public_image_url, public.party_profiles.public_image_url),
    public_bio = coalesce(EXCLUDED.public_bio, public.party_profiles.public_bio),
    public_website_url = coalesce(EXCLUDED.public_website_url, public.party_profiles.public_website_url),
    identity_status = 'account_claimed',
    claim_status = 'claimed',
    landlord_id = EXCLUDED.landlord_id,
    claimed_user_id = EXCLUDED.claimed_user_id,
    updated_at = now()
  RETURNING id INTO v_profile_id;

  UPDATE public.landlords SET party_profile_id = v_profile_id WHERE id = NEW.id;
  INSERT INTO public.party_profile_aliases (
    party_profile_id, source, source_profile_key, observed_name, match_method
  ) VALUES (v_profile_id, 'choice_account', NEW.id::text, v_name, 'account')
  ON CONFLICT (source, source_profile_key) DO UPDATE
    SET party_profile_id = EXCLUDED.party_profile_id, last_seen_at = now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_landlord_party_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS landlords_sync_party_profile ON public.landlords;
CREATE TRIGGER landlords_sync_party_profile
AFTER INSERT OR UPDATE OF user_id, account_type, contact_name, business_name, avatar_url, bio, website
ON public.landlords
FOR EACH ROW EXECUTE FUNCTION public.sync_landlord_party_profile();

-- Backfill existing account profiles without treating a signup as identity or
-- property-authority verification.
INSERT INTO public.party_profiles (
  profile_key, profile_kind, category, display_name, public_image_url,
  public_bio, public_website_url, identity_status, claim_status,
  landlord_id, claimed_user_id, is_public
)
SELECT
  'account|' || l.id::text,
  CASE WHEN l.account_type IN ('brokerage', 'agency', 'llc', 'property_management') THEN 'organization' ELSE 'person' END,
  CASE
    WHEN l.account_type IN ('brokerage', 'agency', 'llc', 'property_management') THEN 'company'
    WHEN l.account_type = 'realtor' THEN 'agent'
    WHEN l.account_type = 'property_owner' THEN 'property_owner'
    ELSE 'owner'
  END,
  coalesce(nullif(btrim(l.business_name), ''), nullif(btrim(l.contact_name), ''), 'Property contact'),
  l.avatar_url, l.bio, l.website, 'account_claimed', 'claimed', l.id, l.user_id, TRUE
FROM public.landlords l
ON CONFLICT (profile_key) DO NOTHING;

UPDATE public.landlords l
   SET party_profile_id = p.id
  FROM public.party_profiles p
 WHERE p.profile_key = 'account|' || l.id::text
   AND l.party_profile_id IS DISTINCT FROM p.id;

-- Existing source profiles become aliases of reusable source-reported profile
-- records. URLs are stored only in the private alias table, never the public view.
SELECT public.resolve_party_profile(source, profile_type, display_name, image_url, profile_url, id)
FROM public.source_profiles;

UPDATE public.source_profiles s
   SET party_profile_id = a.party_profile_id
  FROM public.party_profile_aliases a
 WHERE a.source_profile_id = s.id
   AND s.party_profile_id IS DISTINCT FROM a.party_profile_id;

CREATE OR REPLACE FUNCTION public.link_property_party_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  IF NEW.landlord_id IS NOT NULL THEN
    SELECT party_profile_id INTO v_profile_id
      FROM public.landlords WHERE id = NEW.landlord_id;
    IF v_profile_id IS NOT NULL THEN
      INSERT INTO public.property_party_roles (
        property_id, party_profile_id, role, relationship_status, is_public_contact
      ) VALUES (NEW.id, v_profile_id, 'account_contact', 'account_claimed', TRUE)
      ON CONFLICT (property_id, party_profile_id, role) DO NOTHING;
    END IF;
  END IF;

  IF NEW.source_profile_id IS NOT NULL THEN
    SELECT party_profile_id INTO v_profile_id
      FROM public.source_profiles WHERE id = NEW.source_profile_id;
    IF v_profile_id IS NOT NULL THEN
      INSERT INTO public.property_party_roles (
        property_id, party_profile_id, role, relationship_status, is_public_contact
      ) VALUES (NEW.id, v_profile_id, 'source_poster', 'source_reported', TRUE)
      ON CONFLICT (property_id, party_profile_id, role) DO NOTHING;
    END IF;
  ELSIF nullif(btrim(NEW.source_profile_name), '') IS NOT NULL THEN
    v_profile_id := public.resolve_party_profile(
      NEW.source, NEW.source_profile_type, NEW.source_profile_name,
      NEW.source_profile_image_url, NEW.source_profile_url, NULL
    );
    IF v_profile_id IS NOT NULL THEN
      INSERT INTO public.property_party_roles (
        property_id, party_profile_id, role, relationship_status, is_public_contact
      ) VALUES (NEW.id, v_profile_id, 'source_poster', 'source_reported', TRUE)
      ON CONFLICT (property_id, party_profile_id, role) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.link_property_party_profiles() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS properties_link_party_profiles ON public.properties;
CREATE TRIGGER properties_link_party_profiles
AFTER INSERT OR UPDATE OF landlord_id, source, source_profile_id, source_profile_type, source_profile_name, source_profile_image_url, source_profile_url
ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.link_property_party_profiles();

CREATE OR REPLACE FUNCTION public.sync_property_poster_profile_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile JSONB;
  v_profile_name TEXT;
  v_profile_category TEXT;
  v_profile_url TEXT;
  v_profile_id UUID;
BEGIN
  DELETE FROM public.property_party_roles
   WHERE property_id = NEW.id
     AND role = 'source_poster'
     AND relationship_status = 'source_reported';

  IF jsonb_typeof(NEW.poster_profiles) <> 'array' THEN
    RETURN NEW;
  END IF;

  FOR v_profile IN SELECT value FROM jsonb_array_elements(NEW.poster_profiles)
  LOOP
    v_profile_name := nullif(btrim(v_profile->>'name'), '');
    v_profile_category := coalesce(nullif(lower(btrim(v_profile->>'category')), ''), 'unknown');
    v_profile_url := nullif(btrim(v_profile->>'profile_url'), '');
    IF v_profile_name IS NULL THEN
      CONTINUE;
    END IF;

    IF v_profile_url IS NULL AND v_profile_name = NEW.source_profile_name THEN
      v_profile_url := NEW.source_profile_url;
    END IF;

    v_profile_id := public.resolve_party_profile(
      NEW.source, v_profile_category, v_profile_name,
      v_profile->>'image_url', v_profile_url, NEW.source_profile_id
    );

    IF v_profile_id IS NOT NULL THEN
      INSERT INTO public.property_party_roles (
        property_id, party_profile_id, role, relationship_status, is_public_contact
      ) VALUES (
        NEW.id, v_profile_id, 'source_poster', 'source_reported', TRUE
      )
      ON CONFLICT (property_id, party_profile_id, role) DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_property_poster_profile_roles() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS properties_sync_poster_profile_roles ON public.properties;
CREATE TRIGGER properties_sync_poster_profile_roles
AFTER INSERT OR UPDATE OF poster_profiles
ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.sync_property_poster_profile_roles();

CREATE OR REPLACE FUNCTION public.sync_pipeline_poster_profiles_to_property()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pipeline, pg_temp
AS $$
DECLARE
  v_profiles jsonb;
  v_profile jsonb;
  v_profile_id uuid;
  v_profile_name text;
  v_profile_category text;
  v_profile_url text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'published' OR NEW.choice_property_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.identity_strategy = 'NO_IDENTITY' THEN
    v_profiles := '[]'::jsonb;
  ELSE
    v_profiles := public.pipeline_poster_profiles_from_original_data(NEW.original_data);
  END IF;

  UPDATE public.properties
     SET poster_profiles = v_profiles
   WHERE id = NEW.choice_property_id;

  IF jsonb_typeof(v_profiles) = 'array' THEN
    FOR v_profile IN SELECT value FROM jsonb_array_elements(v_profiles)
    LOOP
      v_profile_name := nullif(btrim(v_profile->>'name'), '');
      v_profile_category := coalesce(nullif(lower(btrim(v_profile->>'category')), ''), 'unknown');
      v_profile_url := nullif(btrim(v_profile->>'profile_url'), '');
      IF v_profile_name IS NULL THEN
        CONTINUE;
      END IF;

      IF v_profile_url IS NULL AND v_profile_name = NEW.source_profile_name THEN
        v_profile_url := NEW.source_profile_url;
      END IF;

      v_profile_id := public.resolve_party_profile(
        NEW.source, v_profile_category, v_profile_name,
        v_profile->>'image_url', v_profile_url, NULL
      );

      IF v_profile_id IS NOT NULL THEN
        INSERT INTO public.property_party_roles (
          property_id, party_profile_id, role, relationship_status, is_public_contact
        ) VALUES (
          NEW.choice_property_id, v_profile_id, 'source_poster', 'source_reported', TRUE
        )
        ON CONFLICT (property_id, party_profile_id, role) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_pipeline_poster_profiles_to_property()
  FROM PUBLIC, anon, authenticated;

INSERT INTO public.property_party_roles (
  property_id, party_profile_id, role, relationship_status, is_public_contact
)
SELECT p.id, l.party_profile_id, 'account_contact', 'account_claimed', TRUE
FROM public.properties p
JOIN public.landlords l ON l.id = p.landlord_id
WHERE l.party_profile_id IS NOT NULL
ON CONFLICT (property_id, party_profile_id, role) DO NOTHING;

INSERT INTO public.property_party_roles (
  property_id, party_profile_id, role, relationship_status, is_public_contact
)
SELECT p.id, s.party_profile_id, 'source_poster', 'source_reported', TRUE
FROM public.properties p
JOIN public.source_profiles s ON s.id = p.source_profile_id
WHERE s.party_profile_id IS NOT NULL
ON CONFLICT (property_id, party_profile_id, role) DO NOTHING;

-- Existing published rows often carry poster_profiles without a legacy
-- source_profile_id. Link those observed profiles without assigning ownership.
WITH observed_profiles AS MATERIALIZED (
  SELECT p.id AS property_id,
         p.source,
         p.source_profile_name,
         p.source_profile_url,
         profile.value AS profile
    FROM public.properties p
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(p.poster_profiles) = 'array'
           THEN p.poster_profiles ELSE '[]'::jsonb END
    ) AS profile(value)
), resolved_profiles AS MATERIALIZED (
  SELECT property_id,
         public.resolve_party_profile(
           source,
           profile->>'category',
           profile->>'name',
           profile->>'image_url',
           CASE WHEN profile->>'name' = source_profile_name
                THEN source_profile_url ELSE profile->>'profile_url' END,
           NULL
         ) AS party_profile_id
    FROM observed_profiles
)
INSERT INTO public.property_party_roles (
  property_id, party_profile_id, role, relationship_status, is_public_contact
)
SELECT property_id, party_profile_id, 'source_poster', 'source_reported', TRUE
  FROM resolved_profiles
 WHERE party_profile_id IS NOT NULL
ON CONFLICT (property_id, party_profile_id, role) DO NOTHING;

CREATE OR REPLACE VIEW public.party_profiles_public AS
SELECT id, profile_kind, category, display_name, public_image_url AS image_url,
       public_bio AS bio, public_website_url AS website_url,
       identity_status, claim_status, created_at
FROM public.party_profiles
WHERE is_public AND identity_status <> 'rejected';

ALTER VIEW public.party_profiles_public OWNER TO postgres;
GRANT SELECT ON public.party_profiles_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_property_parties(p_property_id text)
RETURNS TABLE (
  profile_id uuid,
  display_name text,
  profile_kind text,
  category text,
  image_url text,
  role text,
  relationship_status text,
  claim_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT profile.id, profile.display_name, profile.profile_kind, profile.category,
         profile.image_url, relation.role, relation.relationship_status, profile.claim_status
    FROM public.property_party_roles relation
    JOIN public.party_profiles_public profile ON profile.id = relation.party_profile_id
    JOIN public.properties property ON property.id = relation.property_id
   WHERE relation.property_id = p_property_id
     AND relation.is_public_contact
     AND property.status = 'active'
   ORDER BY CASE relation.role
     WHEN 'legal_lessor' THEN 1
     WHEN 'property_owner' THEN 2
     WHEN 'property_manager' THEN 3
     WHEN 'listing_agent' THEN 4
     WHEN 'source_poster' THEN 5
     ELSE 6
   END, profile.display_name;
$$;

REVOKE ALL ON FUNCTION public.get_public_property_parties(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_property_parties(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_party_property_ids(p_profile_id uuid)
RETURNS TABLE (property_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT property.id
    FROM public.property_party_roles relation
    JOIN public.properties property ON property.id = relation.property_id
   WHERE relation.party_profile_id = p_profile_id
     AND relation.is_public_contact
     AND property.status = 'active'
   ORDER BY property.id;
$$;

REVOKE ALL ON FUNCTION public.get_public_party_property_ids(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_party_property_ids(uuid) TO anon, authenticated;

COMMENT ON TABLE public.party_profiles IS
  'Reusable property-party identities. Source-reported profiles do not imply identity verification or authority over a property.';
COMMENT ON TABLE public.party_profile_aliases IS
  'Private source-specific aliases and observed URLs/images used for deduplication and audit; never a public profile source.';
COMMENT ON TABLE public.property_party_roles IS
  'Property-specific role and authority relationship. A source poster is not implicitly the owner or legal lessor.';