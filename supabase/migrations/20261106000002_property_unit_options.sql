ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS unit_options jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'properties_unit_options_is_array'
      AND conrelid = 'public.properties'::regclass
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_unit_options_is_array
      CHECK (jsonb_typeof(unit_options) = 'array');
  END IF;
END;
$$;

COMMENT ON COLUMN public.properties.unit_options IS
  'Sanitized apartment/community floor-plan or unit inventory, returned only through the property access policy.';
