/**
 * Choice Properties — Comprehensive Database & Domain Types
 * Matches production Supabase schemas (public.properties, pipeline.pipeline_properties,
 * property_units, property_floor_plans, property_buildings, property_floors).
 */

export type PropertyStatus =
  | 'active'
  | 'private_placement'
  | 'rented'
  | 'inactive'
  | 'archived'
  | 'draft'
  | 'paused'
  | 'maintenance';

export type PropertyClassification =
  | 'single_family'
  | 'apartment'
  | 'duplex'
  | 'townhouse'
  | 'multi_family'
  | 'condo';

export interface PropertyUnitOption {
  id?: string;
  unit_number: string;
  price?: number;
  monthly_rent?: number;
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number | null;
  building_name?: string;
  floor_number?: number | string;
  floor_plan_name?: string;
  rent_basis?: string;
  unit_photos?: string[];
  photo_urls?: string[];
}

export interface PropertyBuilding {
  id: string;
  property_id: string;
  building_name: string;
  building_number?: string | null;
  total_floors?: number | null;
  created_at?: string;
}

export interface PropertyFloor {
  id: string;
  property_id: string;
  building_id: string;
  floor_number: number;
  floor_label?: string | null;
  created_at?: string;
}

export interface PropertyFloorPlan {
  id: string;
  property_id: string;
  plan_name: string;
  bedrooms: number;
  bathrooms: number;
  min_square_feet?: number | null;
  max_square_feet?: number | null;
  starting_rent?: number | null;
  deposit_amount?: number | null;
  created_at?: string;
}

export interface PropertyUnit {
  id: string;
  property_id: string;
  building_id?: string | null;
  floor_id?: string | null;
  floor_plan_id?: string | null;
  unit_number: string;
  monthly_rent: number;
  security_deposit: number;
  bedrooms: number;
  bathrooms: number;
  square_feet?: number | null;
  unit_photos?: string[];
  created_at?: string;
}

/**
 * Core Property interface for live website, pipeline, and administrative portals.
 */
export interface Property {
  // Primary Identifiers
  id: string;
  property_id?: string;
  title: string;
  description?: string;

  // Address & Geo
  address: string;
  formatted_address?: string;
  street?: string;
  city: string;
  state: string;
  zip?: string;
  zip_code?: string;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;

  // Specifications
  bedrooms: number;
  bathrooms: number;
  half_bathrooms?: number;
  beds?: number;
  baths?: number;
  full_baths?: number;
  half_baths?: number;
  square_footage?: number | null;
  sqft?: number | null;
  lot_sqft?: number | null;
  year_built?: number | null;

  // Financials & Strict Invariants
  monthly_rent: number;
  list_price?: number;
  price_per_sqft?: number | null;
  security_deposit: number;
  application_fee: number; // Invariant: exactly 50
  last_months_rent?: number | null;
  holding_deposit?: number | null;

  // Property Type & Community Inventory
  property_type: PropertyClassification;
  property_style?: string;
  status: PropertyStatus;
  is_multi_unit?: boolean;
  total_units?: number | null;
  community_starting_rent?: number | null;
  community_max_rent?: number | null;
  price_range?: string | null;
  unit_options?: PropertyUnitOption[] | null;

  // Media
  photo_urls: string[];
  primary_photo?: string | null;
  photos?: string[];
  virtual_tour_url?: string | null;

  // Amenities & Features
  amenities?: string[];
  utilities_included?: string[];
  parking?: string | null;
  garage_spaces?: string | number | null;
  laundry_type?: string | null;
  heating_type?: string | null;
  cooling_type?: string | null;
  hoa_fee?: number | null;

  // Pipeline Metadata (Staging / Publisher)
  in_pipeline?: boolean;
  pipeline_stage?: 'in_pipeline' | 'under_review' | 'approved' | 'published';
  pipeline_status_label?: string;
  published?: boolean;
  pipeline_added_at?: string;
  notes?: string;
  tags?: string[];
  source_platform?: string;
  source_url?: string;
  source_listing_id?: string;
  created_at?: string;
  updated_at?: string;

  // Legacy MLS compat (optional)
  mls_id?: string;
  mls_status?: string;
  days_on_mls?: number | null;
  agent_name?: string;
  agent_email?: string | null;
  agent_phones?: any;
  broker_name?: string;
}
