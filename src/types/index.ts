export interface Property {
  id: string;
  title: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  rent: number;
  beds: number;
  baths: number;
  sqft?: number | null;
  property_type?: string;
  status: string;
  description?: string;
  amenities?: string[] | string;
  photos?: string[] | PropertyPhoto[];
  hero_photo_url?: string;
  imagekit_hero_url?: string;
  application_fee?: number;
  deposit?: number;
  pets_allowed?: boolean;
  pet_policy?: string;
  available_date?: string;
  created_at?: string;
  updated_at?: string;
  is_verified?: boolean;
  move_in_special?: string;
  source_platform?: string;
  source_url?: string;
  latitude?: number;
  longitude?: number;
}

export interface PropertyPhoto {
  id?: string;
  property_id?: string;
  url: string;
  imagekit_url?: string;
  caption?: string;
  display_order?: number;
  is_hero?: boolean;
  watermark_status?: string;
}

export interface RentalApplication {
  id?: string;
  app_id?: string;
  property_id?: string;
  property_address?: string;
  monthly_rent?: number;
  status?: string;
  applicant_name: string;
  email: string;
  phone: string;
  dob?: string;
  ssn?: string;
  id_type?: string;
  id_number?: string;
  id_state?: string;
  current_address?: string;
  current_city?: string;
  current_state?: string;
  current_zip?: string;
  current_rent?: number;
  residence_duration_years?: number;
  landlord_name?: string;
  landlord_phone?: string;
  reason_for_moving?: string;
  employment_status?: string;
  employer_name?: string;
  job_title?: string;
  monthly_income?: number;
  supervisor_name?: string;
  supervisor_phone?: string;
  additional_income?: number;
  additional_income_source?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  pets?: Array<{ type: string; breed: string; weight: string }>;
  vehicles?: Array<{ make: string; model: string; plate: string; year: string }>;
  co_applicants?: Array<{ name: string; email: string; phone: string; relationship: string }>;
  payment_preference?: string;
  signature_data?: string;
  agreed_to_terms?: boolean;
  created_at?: string;
}

export interface PipelineFolder {
  id: string;
  name: string;
  folder_name?: string;
  color?: string;
  icon?: string;
  property_count?: number;
  description?: string;
}

export interface InquiryForm {
  property_id: string;
  property_address: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  preferred_move_in?: string;
  has_pets?: boolean;
}
