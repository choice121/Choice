-- Drop the insecure public SELECT policy that allowed enumeration
DROP POLICY IF EXISTS "Anyone can read client collections" ON public.client_collections;

-- Create a secure RPC for direct point-lookups by ID
CREATE OR REPLACE FUNCTION get_client_collection(collection_id UUID)
RETURNS SETOF public.client_collections
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.client_collections WHERE id = collection_id;
$$;

GRANT EXECUTE ON FUNCTION get_client_collection(UUID) TO public;
GRANT EXECUTE ON FUNCTION get_client_collection(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_client_collection(UUID) TO authenticated;
