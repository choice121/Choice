export type ApplicantRole = 'primary' | 'co_applicant' | 'guarantor' | 'co_signer';
export type SubmissionMethod = 'primary_completed' | 'invited';

export interface HouseholdMemberInput {
  id?: string | null;
  applicant_index?: number;
  is_primary?: boolean;
  applicant_type?: string | null;
  role?: string | null;
  submission_method?: string | null;
  info_completed?: boolean | null;
  screening_consent?: boolean | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  monthly_income?: unknown;
  other_income?: unknown;
}

export interface FeeLineItem {
  applicant_index: number;
  name: string;
  applicant_type: ApplicantRole;
  role_label: string;
  submission_method: SubmissionMethod;
  is_occupant: boolean;
  standard_fee: number;
  fee: number;
  included_free: boolean;
  note: string;
}

export interface HouseholdFeeSummary {
  perPersonFee: number;
  standardFee: number;
  totalFee: number;
  creditApplied: boolean;
  occupyingAdultCount: number;
  coApplicantCount: number;
  guarantorCount: number;
  coSignerCount: number;
  additionalCount: number;
  screenedAdultCount: number;
  feeBreakdown: FeeLineItem[];
  jurisdictionFeeNote: string | null;
}

export interface HouseholdFinancialSummary {
  primaryMonthlyIncome: number;
  coApplicantMonthlyIncome: number;
  householdMonthlyIncome: number;
  guarantorMonthlyIncome: number;
  coSignerMonthlyIncome: number;
  totalFinancialSupport: number;
  occupyingAdultCount: number;
  coApplicantCount: number;
  guarantorCount: number;
  coSignerCount: number;
  listedRent: number | null;
  householdRentRatio: number | null;
  combinedSupportRentRatio: number | null;
}

export function normalizeApplicantType(input: unknown, isPrimary = false): ApplicantRole {
  if (isPrimary) return 'primary';
  const raw = String(input || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (raw === 'primary' || raw === 'primary_applicant') return 'primary';
  if (raw.includes('guarantor')) return 'guarantor';
  if (raw.includes('co_signer') || raw.includes('cosigner') || raw === 'signer') return 'co_signer';
  return 'co_applicant';
}

export function normalizeSubmissionMethod(input: unknown): SubmissionMethod {
  const raw = String(input || '').trim().toLowerCase();
  if (raw === 'invited' || raw === 'invite' || raw === 'method_b' || raw === 'private_link' || raw === 'self_complete') {
    return 'invited';
  }
  return 'primary_completed';
}

export function isOccupyingRole(applicantType: ApplicantRole): boolean {
  return applicantType === 'primary' || applicantType === 'co_applicant';
}

export function getRoleDisplayLabel(applicantType: ApplicantRole, locale: 'en' | 'es' = 'en'): string {
  if (locale === 'es') {
    switch (applicantType) {
      case 'primary':      return 'Solicitante Principal';
      case 'guarantor':    return 'Garante (No Ocupante)';
      case 'co_signer':    return 'Co-Firmante (Apoyo Financiero)';
      default:             return 'Co-Solicitante (Ocupante)';
    }
  }
  switch (applicantType) {
    case 'primary':      return 'Primary Applicant';
    case 'guarantor':    return 'Guarantor (Non-Occupying)';
    case 'co_signer':    return 'Co-Signer (Financial Support)';
    default:             return 'Co-Applicant (Occupying Adult)';
  }
}

export function getShortRoleLabel(applicantType: ApplicantRole, locale: 'en' | 'es' = 'en'): string {
  if (locale === 'es') {
    switch (applicantType) {
      case 'primary':      return 'Principal';
      case 'guarantor':    return 'Garante';
      case 'co_signer':    return 'Co-Firmante';
      default:             return 'Co-Solicitante';
    }
  }
  switch (applicantType) {
    case 'primary':      return 'Primary';
    case 'guarantor':    return 'Guarantor';
    case 'co_signer':    return 'Co-Signer';
    default:             return 'Co-Applicant';
  }
}

export function parseMoneyAmount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0;
  const cleaned = String(value ?? '').replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const JURISDICTION_FEE_NOTES: Record<string, string> = {
  NY: 'New York notice: Statutory tenant screening fee cap ($20 per applicant under NY Real Property Law § 238-a) may apply based on property location; coordinator verifies final compliant amount prior to collection.',
  VT: 'Vermont notice: Vermont prohibits charging tenants application screening fees (9 V.S.A. § 4456a); coordinator waives or adjusts fee prior to screening.',
  MA: 'Massachusetts notice: Direct landlord-collected application fees are restricted under M.G.L. c. 186 § 15B unless collected by a licensed broker; coordinator confirms eligibility before billing.',
  CA: 'California notice: Screening fees are capped at actual out-of-pocket screening/processing costs up to the statutory CPI-adjusted maximum (Cal. Civ. Code § 1950.6), with itemized receipt provided upon confirmation.',
  WA: 'Washington notice: Tenant screening disclosures include the consumer reporting agency details and itemized screening fee receipt prior to billing (RCW 59.18.257).',
  MN: 'Minnesota notice: Screening fees cover actual credit/background verification costs and are refundable if screening is not run (Minn. Stat. § 504B.173).',
  CO: 'Colorado notice: Portable screening report rights apply under C.R.S. § 38-12-904; fees are only billed if no qualifying portable report is provided.',
  OR: 'Oregon notice: Screening charges cover actual third-party report/processing costs and carry itemized receipt protections (ORS 90.295).',
  IL: 'Illinois notice: Cook County / Chicago Just Housing & reusable screening rules may adjust fee collection prior to screening.',
  MD: 'Maryland notice: Screening fee portions exceeding $25 actual verification costs are subject to statutory return requirements (Md. Code, Real Prop. § 8-213).',
};

export function getJurisdictionFeeNote(stateCode: unknown): string | null {
  const code = String(stateCode || '').trim().toUpperCase().slice(0, 2);
  return JURISDICTION_FEE_NOTES[code] || null;
}

export function calculateHouseholdApplicationFee(
  members: HouseholdMemberInput[],
  options: {
    perPersonFee?: number | null;
    creditApplied?: boolean;
    stateCode?: string | null;
    locale?: 'en' | 'es';
  } = {},
): HouseholdFeeSummary {
  const locale = options.locale === 'es' ? 'es' : 'en';
  const rawBase = options.perPersonFee;
  const perPersonFee = rawBase === 0 ? 0 : (Number.isFinite(Number(rawBase)) && Number(rawBase) > 0 ? Number(rawBase) : 50);
  const creditApplied = Boolean(options.creditApplied);

  const normalized = members.map((m, idx) => {
    const isPrim = Boolean(m.is_primary) || idx === 0 || normalizeApplicantType(m.applicant_type || m.role, false) === 'primary';
    const type = normalizeApplicantType(m.applicant_type || m.role, isPrim);
    const method = isPrim ? 'primary_completed' : normalizeSubmissionMethod(m.submission_method);
    const fullName = [m.first_name, m.last_name].map(s => String(s || '').trim()).filter(Boolean).join(' ')
      || getShortRoleLabel(type, locale);
    return {
      index: m.applicant_index ?? idx,
      type,
      method,
      name: fullName,
    };
  });

  // Ensure primary is present even if caller passed only non-primary array
  if (!normalized.some(m => m.type === 'primary')) {
    normalized.unshift({
      index: 0,
      type: 'primary',
      method: 'primary_completed',
      name: getShortRoleLabel('primary', locale),
    });
  }

  let coApplicantCount = 0;
  let guarantorCount = 0;
  let coSignerCount = 0;
  let occupyingAdultCount = 0;
  let standardFee = 0;

  const feeBreakdown: FeeLineItem[] = normalized.map((m) => {
    let itemStandardFee = perPersonFee;
    let includedFree = false;
    let note = '';

    if (m.type === 'primary') {
      occupyingAdultCount += 1;
      note = locale === 'es' ? 'Evaluación del solicitante principal ($50)' : 'Primary applicant screening ($50)';
    } else if (m.type === 'co_applicant') {
      coApplicantCount += 1;
      occupyingAdultCount += 1;
      note = locale === 'es'
        ? 'Evaluación de co-solicitante ocupante ($50)'
        : 'Occupying co-applicant screening ($50)';
    } else if (m.type === 'guarantor') {
      guarantorCount += 1;
      note = locale === 'es' ? 'Evaluación financiera de garante ($50)' : 'Guarantor financial screening ($50)';
    } else {
      coSignerCount += 1;
      note = locale === 'es' ? 'Evaluación financiera de co-firmante ($50)' : 'Co-signer financial screening ($50)';
    }

    standardFee += itemStandardFee;
    const fee = creditApplied ? 0 : itemStandardFee;
    if (creditApplied && itemStandardFee > 0) {
      note = locale === 'es' ? `${note} (Cubierto por crédito)` : `${note} (Waived via credit)`;
    }

    return {
      applicant_index: m.index,
      name: m.name,
      applicant_type: m.type,
      role_label: getRoleDisplayLabel(m.type, locale),
      submission_method: m.method,
      is_occupant: isOccupyingRole(m.type),
      standard_fee: itemStandardFee,
      fee,
      included_free: includedFree,
      note,
    };
  });

  const additionalCount = coApplicantCount + guarantorCount + coSignerCount;
  const screenedAdultCount = 1 + additionalCount;
  const totalFee = creditApplied ? 0 : standardFee;

  return {
    perPersonFee,
    standardFee,
    totalFee,
    creditApplied,
    occupyingAdultCount,
    coApplicantCount,
    guarantorCount,
    coSignerCount,
    additionalCount,
    screenedAdultCount,
    feeBreakdown,
    jurisdictionFeeNote: getJurisdictionFeeNote(options.stateCode),
  };
}

export function calculateHouseholdFinancials(
  members: HouseholdMemberInput[],
  listedRent?: unknown,
): HouseholdFinancialSummary {
  let primaryMonthlyIncome = 0;
  let coApplicantMonthlyIncome = 0;
  let guarantorMonthlyIncome = 0;
  let coSignerMonthlyIncome = 0;
  let occupyingAdultCount = 0;
  let coApplicantCount = 0;
  let guarantorCount = 0;
  let coSignerCount = 0;

  members.forEach((m, idx) => {
    const isPrim = Boolean(m.is_primary) || idx === 0;
    const type = normalizeApplicantType(m.applicant_type || m.role, isPrim);
    const total = parseMoneyAmount(m.monthly_income) + parseMoneyAmount(m.other_income);
    if (type === 'primary') {
      occupyingAdultCount += 1;
      primaryMonthlyIncome += total;
    } else if (type === 'co_applicant') {
      occupyingAdultCount += 1;
      coApplicantCount += 1;
      coApplicantMonthlyIncome += total;
    } else if (type === 'guarantor') {
      guarantorCount += 1;
      guarantorMonthlyIncome += total;
    } else {
      coSignerCount += 1;
      coSignerMonthlyIncome += total;
    }
  });

  const householdMonthlyIncome = primaryMonthlyIncome + coApplicantMonthlyIncome;
  const totalFinancialSupport = householdMonthlyIncome + guarantorMonthlyIncome + coSignerMonthlyIncome;
  const rentNum = parseMoneyAmount(listedRent);
  const rentVal = rentNum > 0 ? rentNum : null;

  return {
    primaryMonthlyIncome,
    coApplicantMonthlyIncome,
    householdMonthlyIncome,
    guarantorMonthlyIncome,
    coSignerMonthlyIncome,
    totalFinancialSupport,
    occupyingAdultCount: Math.max(1, occupyingAdultCount),
    coApplicantCount,
    guarantorCount,
    coSignerCount,
    listedRent: rentVal,
    householdRentRatio: rentVal ? householdMonthlyIncome / rentVal : null,
    combinedSupportRentRatio: rentVal ? totalFinancialSupport / rentVal : null,
  };
}
