-- Strictly enforce RLS and remove any lingering public/anon read policies on client_collections
ALTER TABLE public.client_collections ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'client_collections'
          AND policyname != 'Admins can manage client collections'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.client_collections', r.policyname);
    END LOOP;
END $$;

-- Revoke direct SELECT from anon role so unauthenticated clients cannot enumerate records via REST API
REVOKE SELECT ON public.client_collections FROM anon;

-- Ensure get_client_collection is SECURITY DEFINER and executable by anon and authenticated
CREATE OR REPLACE FUNCTION public.get_client_collection(collection_id UUID)
RETURNS SETOF public.client_collections
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.client_collections WHERE id = collection_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_collection(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_client_collection(UUID) TO authenticated;
