CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'landlord',
  user_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS landlords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE SET NULL UNIQUE,
  account_type TEXT NOT NULL DEFAULT 'landlord',
  contact_name TEXT NOT NULL DEFAULT '',
  business_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  avatar_url TEXT,
  tagline TEXT,
  bio TEXT,
  website TEXT,
  license_number TEXT,
  license_state TEXT,
  years_experience INT,
  specialties TEXT[],
  social_facebook TEXT,
  social_instagram TEXT,
  social_linkedin TEXT,
  verified BOOLEAN DEFAULT false,
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  landlord_id UUID REFERENCES landlords(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft',
  title TEXT NOT NULL,
  description TEXT,
  showing_instructions TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  county TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  property_type TEXT,
  year_built INT,
  floors INT,
  unit_number TEXT,
  total_units INT,
  bedrooms INT,
  bathrooms DOUBLE PRECISION,
  half_bathrooms INT,
  square_footage INT,
  lot_size_sqft INT,
  garage_spaces INT,
  monthly_rent INT NOT NULL DEFAULT 1,
  security_deposit INT,
  last_months_rent INT,
  application_fee INT DEFAULT 0,
  pet_deposit INT,
  admin_fee INT,
  move_in_special TEXT,
  available_date DATE,
  lease_terms TEXT[],
  minimum_lease_months INT,
  pets_allowed BOOLEAN DEFAULT false,
  pet_types_allowed TEXT[],
  pet_weight_limit INT,
  pet_details TEXT,
  smoking_allowed BOOLEAN DEFAULT false,
  utilities_included TEXT[],
  parking TEXT,
  parking_fee INT,
  amenities TEXT[],
  appliances TEXT[],
  flooring TEXT[],
  heating_type TEXT,
  cooling_type TEXT,
  laundry_type TEXT,
  photo_urls TEXT[],
  photo_file_ids TEXT[],
  virtual_tour_url TEXT,
  views_count INT DEFAULT 0,
  applications_count INT DEFAULT 0,
  saves_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
  tenant_name TEXT NOT NULL,
  tenant_email TEXT NOT NULL,
  tenant_phone TEXT,
  tenant_language TEXT DEFAULT 'en',
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_status TEXT DEFAULT 'unpaid',
  property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
  landlord_id UUID REFERENCES landlords(id) ON DELETE SET NULL,
  property_address TEXT,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  preferred_language TEXT DEFAULT 'en',
  admin_notes TEXT,
  application_fee INT DEFAULT 0,
  lease_status TEXT DEFAULT 'none',
  lease_sent_date TIMESTAMPTZ,
  lease_signed_date TIMESTAMPTZ,
  lease_start_date DATE,
  lease_end_date DATE,
  monthly_rent NUMERIC(10,2),
  security_deposit NUMERIC(10,2),
  move_in_costs NUMERIC(10,2),
  move_in_status TEXT,
  move_in_date_actual DATE,
  move_in_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT REFERENCES applications(app_id) ON DELETE CASCADE,
  sender TEXT NOT NULL DEFAULT 'admin',
  sender_name TEXT,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT,
  recipient TEXT,
  status TEXT DEFAULT 'sent',
  app_id TEXT,
  error_msg TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saved_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, property_id)
);

CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT,
  action TEXT,
  target_table TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE VIEW public_landlord_profiles AS
SELECT l.*, COUNT(p.id)::int AS properties_count
FROM landlords l
LEFT JOIN properties p ON p.landlord_id = l.id AND p.status = 'active'
GROUP BY l.id;

CREATE INDEX IF NOT EXISTS idx_properties_status_created ON properties(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_landlord ON properties(landlord_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_property ON inquiries(property_id);
CREATE INDEX IF NOT EXISTS idx_applications_app_id ON applications(app_id);
CREATE INDEX IF NOT EXISTS idx_messages_app_id ON messages(app_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_endpoint_ip_created ON rate_limit_log(endpoint, ip, created_at DESC);
