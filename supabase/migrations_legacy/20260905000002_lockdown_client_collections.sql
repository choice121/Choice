-- Complete lockdown of direct access to client_collections for anon and public

-- 1. Revoke direct permissions from anon and public
REVOKE ALL ON TABLE public.client_collections FROM anon;
REVOKE ALL ON TABLE public.client_collections FROM public;

-- 2. Drop all policies on client_collections
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'client_collections'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.client_collections', pol.policyname);
    END LOOP;
END $$;

-- 3. Enable and force RLS
ALTER TABLE public.client_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_collections FORCE ROW LEVEL SECURITY;

-- 4. Re-create admin-only policy restricted strictly to authenticated users with a verified landlord account
CREATE POLICY "Admins can manage client collections"
  ON public.client_collections
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL AND auth.uid() IN (SELECT user_id FROM public.landlords WHERE verified = true))
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() IN (SELECT user_id FROM public.landlords WHERE verified = true));

-- 5. Secure lookup RPC (only way for anon/clients with link to view a specific collection)
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
