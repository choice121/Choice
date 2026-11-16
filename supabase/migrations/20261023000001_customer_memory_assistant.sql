-- ==============================================================================
-- Choice Properties — Customer Memory & AI Inquiry Assistant Migration
-- Migration: 20261023000001_customer_memory_assistant.sql
-- ==============================================================================

-- 1. CUSTOMER PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_last4 varchar(4),
  alias text,
  full_name text,
  contact_info text,
  
  -- Rental Preferences
  target_city text,
  target_neighborhoods text,
  target_beds integer,
  target_baths numeric(3,1),
  max_budget numeric(10,2),
  property_type text DEFAULT 'single_family',
  move_in_date text,
  has_pets boolean DEFAULT false,
  pet_details text,
  requested_features jsonb DEFAULT '[]'::jsonb,
  
  -- Application & Rental Context
  interested_property_ids jsonb DEFAULT '[]'::jsonb,
  recommended_property_ids jsonb DEFAULT '[]'::jsonb,
  application_status text DEFAULT 'not_started',
  application_fee_status text DEFAULT 'not_confirmed',
  payment_status text DEFAULT 'not_confirmed',
  application_submitted_at timestamptz,
  viewing_status text DEFAULT 'not_scheduled',
  holding_status text DEFAULT 'none',
  outstanding_questions text,
  next_action text,
  
  -- Rental History & Qualification Context
  credit_concerns text,
  eviction_history text,
  income_notes text,
  additional_notes text,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast customer lookup by phone suffix, alias, and activity
CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone_last4 ON public.customer_profiles (phone_last4);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_alias ON public.customer_profiles (alias);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_last_activity ON public.customer_profiles (last_activity_at DESC);

-- 2. CUSTOMER CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS public.customer_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  channel text DEFAULT 'sms', -- 'sms', 'tiktok', 'web_chat', 'email'
  sender text NOT NULL,       -- 'customer', 'staff', 'assistant'
  message_text text NOT NULL,
  status text DEFAULT 'sent',  -- 'received', 'draft', 'sent'
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_conversations_cust_id ON public.customer_conversations (customer_id, created_at ASC);

-- 3. CUSTOMER INTERNAL NOTES TABLE
CREATE TABLE IF NOT EXISTS public.customer_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  author text DEFAULT 'Staff',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_internal_notes_cust_id ON public.customer_internal_notes (customer_id, created_at DESC);

-- 4. ROW LEVEL SECURITY
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_internal_notes ENABLE ROW LEVEL SECURITY;

-- Deny public / anon access, grant full access to service_role and authenticated staff
REVOKE ALL ON public.customer_profiles FROM PUBLIC, anon;
REVOKE ALL ON public.customer_conversations FROM PUBLIC, anon;
REVOKE ALL ON public.customer_internal_notes FROM PUBLIC, anon;

GRANT ALL ON public.customer_profiles TO service_role, authenticated;
GRANT ALL ON public.customer_conversations TO service_role, authenticated;
GRANT ALL ON public.customer_internal_notes TO service_role, authenticated;

-- Comments
COMMENT ON TABLE public.customer_profiles IS 'Persistent customer profiles and rental criteria for Choice Properties Inquiry Assistant.';
COMMENT ON TABLE public.customer_conversations IS 'Chronological messages and draft responses for customer memory tracking.';
COMMENT ON TABLE public.customer_internal_notes IS 'Private operator and leasing coordinator notes (never customer visible).';
