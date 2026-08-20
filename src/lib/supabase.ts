import { createClient } from '@supabase/supabase-js';
import type { Property, PropertyPhoto, RentalApplication, PipelineFolder } from '../types';

export const SUPABASE_URL = 'https://tlfmwetmhthpyrytrcfo.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';
export const EDGE_BASE_URL = 'https://tlfmwetmhthpyrytrcfo.supabase.co/functions/v1';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Helper to optimize image URL with ImageKit or fallbacks
export function formatImageUrl(url?: string, width = 800, quality = 80): string {
  if (!url) return '/assets/placeholder-property.jpg';
  if (url.includes('ik.imagekit.io')) {
    // Apply ImageKit transformation query
    const hasQuery = url.includes('?');
    const transform = `tr=w-${width},q-${quality},f-auto`;
    return hasQuery ? `${url}&${transform}` : `${url}?${transform}`;
  }
  return url;
}

// Fetch published properties
export async function getProperties(params?: {
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  beds?: number | string;
  baths?: number | string;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'beds';
}): Promise<{ data: Property[]; count: number; error: any }> {
  try {
    let query = supabase
      .from('properties')
      .select('*, property_photos(*)', { count: 'exact' })
      .in('status', ['active', 'published', 'available']);

    if (params?.city && params.city !== 'all') {
      query = query.ilike('city', `%${params.city}%`);
    }

    if (params?.minPrice) {
      query = query.gte('rent', params.minPrice);
    }

    if (params?.maxPrice) {
      query = query.lte('rent', params.maxPrice);
    }

    if (params?.beds && params.beds !== 'all') {
      const bedsNum = Number(params.beds);
      if (!isNaN(bedsNum)) {
        query = query.gte('beds', bedsNum);
      }
    }

    if (params?.baths && params.baths !== 'all') {
      const bathsNum = Number(params.baths);
      if (!isNaN(bathsNum)) {
        query = query.gte('baths', bathsNum);
      }
    }

    if (params?.search) {
      const s = params.search.trim();
      query = query.or(`title.ilike.%${s}%,address.ilike.%${s}%,city.ilike.%${s}%,zip.ilike.%${s}%`);
    }

    // Sort order
    if (params?.sortBy === 'price_asc') {
      query = query.order('rent', { ascending: true });
    } else if (params?.sortBy === 'price_desc') {
      query = query.order('rent', { ascending: false });
    } else if (params?.sortBy === 'beds') {
      query = query.order('beds', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const limit = params?.limit || 24;
    const offset = params?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    // Normalize property items
    const normalized: Property[] = (data || []).map((p: any) => {
      const photos: PropertyPhoto[] = Array.isArray(p.property_photos) ? p.property_photos : [];
      photos.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      
      const hero = photos.find((ph) => ph.is_hero)?.url || photos[0]?.url || p.hero_photo_url || '/assets/placeholder-property.jpg';

      return {
        ...p,
        photos,
        hero_photo_url: hero,
        application_fee: 50,
        deposit: p.deposit || p.rent,
        pets_allowed: p.pets_allowed ?? true,
      };
    });

    return { data: normalized, count: count || 0, error: null };
  } catch (err: any) {
    console.error('Error in getProperties:', err);
    return { data: [], count: 0, error: err };
  }
}

// Fetch single property by ID
export async function getPropertyById(id: string): Promise<{ data: Property | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*, property_photos(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { data: null, error: 'Property not found' };

    const photos: PropertyPhoto[] = Array.isArray(data.property_photos) ? data.property_photos : [];
    photos.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    
    // Filter out banners/flyers in UI if any
    const cleanPhotos = photos.filter((ph) => !ph.caption?.toLowerCase().includes('banner'));

    const hero = cleanPhotos.find((ph) => ph.is_hero)?.url || cleanPhotos[0]?.url || data.hero_photo_url || '/assets/placeholder-property.jpg';

    const normalized: Property = {
      ...data,
      photos: cleanPhotos.length > 0 ? cleanPhotos : photos,
      hero_photo_url: hero,
      application_fee: 50,
      deposit: data.deposit || data.rent,
      pets_allowed: data.pets_allowed ?? true,
    };

    return { data: normalized, error: null };
  } catch (err: any) {
    console.error('Error fetching property:', err);
    return { data: null, error: err };
  }
}

// Submit a rental application
export async function submitRentalApplication(app: RentalApplication): Promise<{ ok: boolean; appId?: string; error?: string }> {
  try {
    const appId = `CP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const payload = {
      app_id: appId,
      property_id: app.property_id || null,
      property_address: app.property_address || '',
      monthly_rent: app.monthly_rent || 0,
      status: 'pending',
      applicant_name: app.applicant_name,
      email: app.email,
      phone: app.phone,
      dob: app.dob || null,
      ssn_last4: app.ssn ? app.ssn.replace(/\D/g, '').slice(-4) : null,
      id_type: app.id_type || 'Driver License',
      id_number: app.id_number || '',
      id_state: app.id_state || '',
      current_address: app.current_address || '',
      current_city: app.current_city || '',
      current_state: app.current_state || '',
      current_zip: app.current_zip || '',
      current_rent: app.current_rent || 0,
      residence_duration_years: app.residence_duration_years || 1,
      landlord_name: app.landlord_name || '',
      landlord_phone: app.landlord_phone || '',
      reason_for_moving: app.reason_for_moving || '',
      employment_status: app.employment_status || 'Employed Full-Time',
      employer_name: app.employer_name || '',
      job_title: app.job_title || '',
      monthly_income: app.monthly_income || 0,
      supervisor_name: app.supervisor_name || '',
      supervisor_phone: app.supervisor_phone || '',
      additional_income: app.additional_income || 0,
      additional_income_source: app.additional_income_source || '',
      emergency_contact_name: app.emergency_contact_name || '',
      emergency_contact_phone: app.emergency_contact_phone || '',
      emergency_contact_relationship: app.emergency_contact_relationship || '',
      pets_data: app.pets || [],
      vehicles_data: app.vehicles || [],
      co_applicants_data: app.co_applicants || [],
      payment_preference: app.payment_preference || 'Standard',
      signature_data: app.signature_data || '',
      application_fee: 50,
      metadata: {
        submitted_via: 'Choice Properties React App v5',
        source_url: window.location.href,
        user_agent: navigator.userAgent,
      },
    };

    const { error } = await supabase.from('rental_applications').insert([payload]);

    if (error) {
      console.warn('Database insert failed, trying Edge Function proxy:', error.message);
      // Fallback via Edge Function
      const res = await fetch(`${EDGE_BASE_URL}/receive-application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Edge function submission failed');
    }

    return { ok: true, appId };
  } catch (err: any) {
    console.error('Application submission error:', err);
    return { ok: false, error: err.message || 'Failed to submit application' };
  }
}

// Submit property inquiry
export async function submitInquiry(inquiry: {
  property_id: string;
  property_address: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  preferred_move_in?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('inquiries').insert([
      {
        property_id: inquiry.property_id,
        property_address: inquiry.property_address,
        name: inquiry.name,
        email: inquiry.email,
        phone: inquiry.phone,
        message: inquiry.message,
        preferred_move_in: inquiry.preferred_move_in || null,
        status: 'new',
      },
    ]);

    if (error) {
      // Try edge function fallback
      await fetch(`${EDGE_BASE_URL}/send-inquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inquiry),
      });
    }

    return { ok: true };
  } catch (err: any) {
    console.error('Inquiry error:', err);
    return { ok: false, error: err.message || 'Failed to send inquiry' };
  }
}

// Track application status
export async function trackApplication(appIdOrEmail: string): Promise<{ data: any | null; error: any }> {
  try {
    const clean = appIdOrEmail.trim();
    let query = supabase.from('rental_applications').select('*');

    if (clean.toUpperCase().startsWith('CP-')) {
      query = query.eq('app_id', clean);
    } else {
      query = query.ilike('email', clean).order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw error;

    return { data: data && data.length > 0 ? data[0] : null, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}
