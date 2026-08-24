CREATE TABLE IF NOT EXISTS public.client_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  property_ids UUID[] NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.client_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read client collections"
  ON public.client_collections FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage client collections"
  ON public.client_collections FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM landlords WHERE verified = true));
