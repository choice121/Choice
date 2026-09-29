// Choice Properties — centralized source classification and identity policy.
//
// Every ingestion path must pass through this policy before a pipeline record
// is written. The policy is deliberately evidence-first: it never creates an
// identity when the source did not provide one.

export type IdentityStrategy =
  | 'AGENT_POSTER'
  | 'COMPANY_SOURCE'
  | 'NO_IDENTITY'
  | 'UNKNOWN_REVIEW';

export type SourceType =
  | 'AGENT_PLATFORM'
  | 'DIRECT_PROPERTY_COMPANY'
  | 'SPECIAL_CASE'
  | 'AGGREGATOR'
  | 'UNKNOWN';

export interface SourceIdentityInput {
  source?: unknown;
  agent_name?: unknown;
  broker_name?: unknown;
  agent_image_url?: unknown;
  agent_profile_url?: unknown;
  source_profile_name?: unknown;
  source_profile_url?: unknown;
  company_logo_url?: unknown;
  poster_landlord_id?: unknown;
}

export interface SourceIdentity {
  source: string;
  source_type: SourceType;
  identity_strategy: IdentityStrategy;
  source_profile_type: 'agent' | 'company' | null;
  source_profile_name: string | null;
  source_profile_image_url: string | null;
  source_profile_url: string | null;
  identity_status: 'confirmed' | 'unavailable' | 'review';
  agent_name: string | null;
  broker_name: string | null;
  agent_image_url: string | null;
  agent_profile_url: string | null;
  poster_landlord_id: string | null;
}

interface SourcePolicy {
  source: string;
  sourceType: SourceType;
  strategy: IdentityStrategy;
  companyName?: string;
}

const POLICIES: Record<string, SourcePolicy> = {
  zillow: { source: 'zillow', sourceType: 'AGENT_PLATFORM', strategy: 'AGENT_POSTER' },
  realtor: { source: 'realtor', sourceType: 'AGENT_PLATFORM', strategy: 'AGENT_POSTER' },
  apartments: { source: 'apartments', sourceType: 'AGGREGATOR', strategy: 'UNKNOWN_REVIEW' },
  redfin: { source: 'redfin', sourceType: 'AGGREGATOR', strategy: 'UNKNOWN_REVIEW' },
  opendoor: { source: 'opendoor', sourceType: 'SPECIAL_CASE', strategy: 'NO_IDENTITY' },
  progress_residential: {
    source: 'progress_residential',
    sourceType: 'DIRECT_PROPERTY_COMPANY',
    strategy: 'COMPANY_SOURCE',
    companyName: 'Progress Residential',
  },
  invitation_homes: {
    source: 'invitation_homes',
    sourceType: 'DIRECT_PROPERTY_COMPANY',
    strategy: 'COMPANY_SOURCE',
    companyName: 'Invitation Homes',
  },
  main_street_renewal: {
    source: 'main_street_renewal',
    sourceType: 'DIRECT_PROPERTY_COMPANY',
    strategy: 'COMPANY_SOURCE',
    companyName: 'Main Street Renewal',
  },
  cj_real_estate: {
    source: 'cj_real_estate',
    sourceType: 'DIRECT_PROPERTY_COMPANY',
    strategy: 'COMPANY_SOURCE',
    companyName: 'CJ Real Estate',
  },
};

const SOURCE_ALIASES: Record<string, string> = {
  progress: 'progress_residential',
  'progress-residential': 'progress_residential',
  invitation: 'invitation_homes',
  'invitation-homes': 'invitation_homes',
  'invitation homes': 'invitation_homes',
  'main-street-renewal': 'main_street_renewal',
  'main street renewal': 'main_street_renewal',
  mainstreetrenewal: 'main_street_renewal',
  cjrealestate: 'cj_real_estate',
  cj: 'cj_real_estate',
  'cj properties': 'cj_real_estate',
  'cj realty': 'cj_real_estate',
};

function text(value: unknown): string | null {
  if (value == null) return null;
  const result = String(value).trim();
  return result || null;
}

export function normalizeIdentitySource(value: unknown): string {
  const raw = (text(value) || 'zillow').toLowerCase();
  return SOURCE_ALIASES[raw] || raw;
}

export function sourcePolicy(value: unknown): SourcePolicy {
  const source = normalizeIdentitySource(value);
  return POLICIES[source] || {
    source,
    sourceType: 'UNKNOWN',
    strategy: 'UNKNOWN_REVIEW',
  };
}

export function classifySourceIdentity(input: SourceIdentityInput): SourceIdentity {
  const policy = sourcePolicy(input.source);
  const agentName = text(input.agent_name);
  const brokerName = text(input.broker_name);
  const agentImageUrl = text(input.agent_image_url);
  const agentProfileUrl = text(input.agent_profile_url);
  const suppliedProfileName = text(input.source_profile_name);
  const suppliedProfileUrl = text(input.source_profile_url);
  const companyLogoUrl = text(input.company_logo_url);

  // Opendoor is intentionally a hard no-identity path. Do not allow any
  // incoming agent/poster fields to leak through this branch.
  if (policy.strategy === 'NO_IDENTITY') {
    return {
      source: policy.source,
      source_type: policy.sourceType,
      identity_strategy: 'NO_IDENTITY',
      source_profile_type: null,
      source_profile_name: null,
      source_profile_image_url: null,
      source_profile_url: null,
      identity_status: 'unavailable',
      agent_name: null,
      broker_name: null,
      agent_image_url: null,
      agent_profile_url: null,
      poster_landlord_id: null,
    };
  }

  // Unknown aggregator sources can still be treated as agent-oriented only
  // when actual poster evidence was supplied. Otherwise they remain review.
  const strategy: IdentityStrategy =
    policy.strategy === 'UNKNOWN_REVIEW' && (agentName || agentProfileUrl)
      ? 'AGENT_POSTER'
      : policy.strategy;

  if (strategy === 'COMPANY_SOURCE') {
    return {
      source: policy.source,
      source_type: policy.sourceType,
      identity_strategy: strategy,
      source_profile_type: 'company',
      source_profile_name: suppliedProfileName || brokerName || policy.companyName || null,
      source_profile_image_url: companyLogoUrl,
      source_profile_url: suppliedProfileUrl,
      identity_status: suppliedProfileName || brokerName || policy.companyName ? 'confirmed' : 'unavailable',
      agent_name: null,
      broker_name: brokerName || policy.companyName || null,
      agent_image_url: null,
      agent_profile_url: null,
      poster_landlord_id: null,
    };
  }

  if (strategy === 'AGENT_POSTER') {
    return {
      source: policy.source,
      source_type: policy.sourceType,
      identity_strategy: strategy,
      source_profile_type: 'agent',
      source_profile_name: agentName,
      source_profile_image_url: agentImageUrl,
      source_profile_url: agentProfileUrl,
      identity_status: agentName || agentProfileUrl ? 'confirmed' : 'unavailable',
      agent_name: agentName,
      broker_name: brokerName,
      agent_image_url: agentImageUrl,
      agent_profile_url: agentProfileUrl,
      poster_landlord_id: text(input.poster_landlord_id),
    };
  }

  return {
    source: policy.source,
    source_type: policy.sourceType,
    identity_strategy: 'UNKNOWN_REVIEW',
    source_profile_type: null,
    source_profile_name: null,
    source_profile_image_url: null,
    source_profile_url: null,
    identity_status: 'review',
    agent_name: agentName,
    broker_name: brokerName,
    agent_image_url: agentImageUrl,
    agent_profile_url: agentProfileUrl,
    poster_landlord_id: null,
  };
}

export function knownSourcePolicies(): SourcePolicy[] {
  return Object.values(POLICIES);
}