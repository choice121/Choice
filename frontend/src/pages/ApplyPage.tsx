import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'

interface FormState {
  // Property Info
  propertyId: string
  propertyAddress: string
  propertyRent: string
  propertyCity: string
  propertyState: string
  propertyZip: string
  requestedMoveInDate: string
  desiredLeaseTerm: string

  // Step 1: Applicant Identity
  hasCoApplicant: 'yes' | 'no'
  additionalPersonRole: 'Co-applicant' | 'Guarantor'
  coApplicantFirstName: string
  coApplicantLastName: string
  coApplicantEmail: string
  coApplicantPhone: string
  coApplicantDob: string
  coApplicantSsn: string
  coApplicantEmployer: string
  coApplicantJobTitle: string
  coApplicantMonthlyIncome: string
  coApplicantEmploymentDuration: string
  coApplicantConsent: boolean
  firstName: string
  lastName: string
  email: string
  phone: string
  dob: string
  ssnLast4: string

  // Step 2: Residency & Occupancy
  hasVehicles: 'yes' | 'no'
  vehicleMake: string
  vehicleModel: string
  vehicleYear: string
  vehicleLicensePlate: string
  documents: any[]
  currentAddress: string
  residencyDuration: string
  currentRent: string
  reasonForLeaving: string
  currentLandlordName: string
  currentLandlordPhone: string
  totalOccupants: string
  additionalOccupants: string
  hasPets: 'yes' | 'no'
  petDetails: string
  everEvicted: 'yes' | 'no'
  smoker: 'yes' | 'no'

  // Step 3: Employment & Income
  employmentStatus: string
  employerName: string
  employerAddress: string
  jobTitle: string
  employmentStartDate: string
  employmentDuration: string
  supervisorName: string
  supervisorPhone: string
  monthlyIncome: string
  incomeSource: string

  // Step 4: References & Emergency
  referenceName: string
  referencePhone: string
  referenceRelationship: string
  reference2Name: string
  reference2Phone: string
  reference2Relationship: string
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelationship: string

  // Step 5: Payment & Contact Preferences
  primaryPaymentMethod: string
  primaryPaymentMethodOther: string
  alternativePaymentMethod: string
  alternativePaymentMethodOther: string
  thirdChoicePaymentMethod: string
  thirdChoicePaymentMethodOther: string
  preferredContactMethod: string[]
  preferredTime: string[]
  preferredTimeSpecific: string

  // Step 6: Disclosures & Consents
  certifyAccurate: boolean
  authorizeScreening: boolean
  acknowledgeFee: boolean
  agreeTermsPrivacy: boolean
  smsConsent: boolean
}

type StepKey = 'identity' | 'residency' | 'employment' | 'references' | 'preferences' | 'review'

const STEP_ORDER: StepKey[] = ['identity', 'residency', 'employment', 'references', 'preferences', 'review']

const STEP_TITLES: Record<StepKey, string> = {
  identity: '1. Applicant Info',
  residency: '2. Residency & Pets',
  employment: '3. Employment & Income',
  references: '4. References',
  preferences: '5. Payment & Contact',
  review: '6. Review & Submit',
}

const PAYMENT_METHODS = ['Venmo', 'PayPal', 'Cash App', 'Apple Pay', 'Zelle', 'Chime', 'Credit / Debit Card', 'Other']
const PREFERRED_TIMES = ['Morning (8am-11am)', 'Midday (11am-2pm)', 'Afternoon (2pm-5pm)', 'Early Evening (5pm-8pm)', 'Late Evening (8pm-10pm)', 'Weekend', 'Anytime']

export function ApplyPage() {
  const [searchParams] = useSearchParams()

  const initialPropertyId = searchParams.get('id') || ''
  const initialAddress = searchParams.get('addr') || searchParams.get('pn') || ''
  const initialRent = searchParams.get('rent') || ''
  const initialCity = searchParams.get('city') || ''
  const initialStateVal = searchParams.get('state') || ''
  const initialZip = searchParams.get('zip') || ''

  const [stepIndex, setStepIndex] = useState(0)
  const [submittedAppId, setSubmittedAppId] = useState<string | null>(null)
  const [portalLoginUrl, setPortalLoginUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const submissionUuidRef = useRef<string | null>(null)
  const submittingRef = useRef(false)

  const [form, setForm] = useState<FormState>({
    propertyId: initialPropertyId,
    propertyAddress: initialAddress,
    propertyRent: initialRent,
    propertyCity: initialCity,
    propertyState: initialStateVal,
    propertyZip: initialZip,
    requestedMoveInDate: '',
    desiredLeaseTerm: '',

    hasCoApplicant: 'no',
    additionalPersonRole: 'Co-applicant',
    coApplicantFirstName: '',
    coApplicantLastName: '',
    coApplicantEmail: '',
    coApplicantPhone: '',
    coApplicantDob: '',
    coApplicantSsn: '',
    coApplicantEmployer: '',
    coApplicantJobTitle: '',
    coApplicantMonthlyIncome: '',
    coApplicantEmploymentDuration: '',
    coApplicantConsent: false,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dob: '',
    ssnLast4: '',

    hasVehicles: 'no',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleLicensePlate: '',
    documents: [],
    currentAddress: '',
    residencyDuration: '',
    currentRent: '',
    reasonForLeaving: '',
    currentLandlordName: '',
    currentLandlordPhone: '',
    totalOccupants: '1',
    additionalOccupants: '',
    hasPets: 'no',
    petDetails: '',
    everEvicted: 'no',
    smoker: 'no',

    employmentStatus: 'Full-time',
    employerName: '',
    employerAddress: '',
    jobTitle: '',
    employmentStartDate: '',
    employmentDuration: '',
    supervisorName: '',
    supervisorPhone: '',
    monthlyIncome: '',
    incomeSource: 'Employment',

    referenceName: '',
    referencePhone: '',
    referenceRelationship: '',
    reference2Name: '',
    reference2Phone: '',
    reference2Relationship: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',

    primaryPaymentMethod: '',
    primaryPaymentMethodOther: '',
    alternativePaymentMethod: '',
    alternativePaymentMethodOther: '',
    thirdChoicePaymentMethod: '',
    thirdChoicePaymentMethodOther: '',
    preferredContactMethod: [],
    preferredTime: [],
    preferredTimeSpecific: '',

    certifyAccurate: false,
    authorizeScreening: false,
    acknowledgeFee: false,
    agreeTermsPrivacy: false,
    smsConsent: true,
  })

  // Update form if URL params change
  useEffect(() => {
    if (initialAddress && !form.propertyAddress) {
      setForm((prev) => ({
        ...prev,
        propertyId: initialPropertyId,
        propertyAddress: initialAddress,
        propertyRent: initialRent,
        propertyCity: initialCity,
        propertyState: initialStateVal,
        propertyZip: initialZip,
      }))
    }
  }, [initialPropertyId, initialAddress, initialRent, initialCity, initialStateVal, initialZip, form.propertyAddress])

  const currentStep = STEP_ORDER[stepIndex]
  const progressPercent = useMemo(() => ((stepIndex + 1) / STEP_ORDER.length) * 100, [stepIndex])

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const toggleArrayField = (key: 'preferredContactMethod' | 'preferredTime', value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((item) => item !== value) : [...prev[key], value],
    }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const validateStep = (step: StepKey): boolean => {
    const nextErrors: Record<string, string> = {}

    if (step === 'identity') {
      if (!form.propertyAddress.trim()) nextErrors.propertyAddress = 'Property address is required'
      if (!form.firstName.trim()) nextErrors.firstName = 'First name is required'
      if (!form.lastName.trim()) nextErrors.lastName = 'Last name is required'
      if (!form.email.trim() || !form.email.includes('@')) nextErrors.email = 'Valid email is required'
      if (!form.phone.trim()) nextErrors.phone = 'Phone number is required'
      if (!form.dob.trim()) nextErrors.dob = 'Date of birth is required'
      if (!form.ssnLast4.trim() || form.ssnLast4.length !== 4) nextErrors.ssnLast4 = 'Last 4 digits of SSN required'
      if (form.hasCoApplicant === 'yes') {
        if (!form.coApplicantFirstName.trim()) nextErrors.coApplicantFirstName = 'Co-applicant first name is required'
        if (!form.coApplicantLastName.trim()) nextErrors.coApplicantLastName = 'Co-applicant last name is required'
        if (!form.coApplicantConsent) nextErrors.coApplicantConsent = 'Co-applicant consent is required'
      }
    } else if (step === 'residency') {
      if (!form.currentAddress.trim()) nextErrors.currentAddress = 'Current address is required'
      if (!form.residencyDuration.trim()) nextErrors.residencyDuration = 'Duration at current address required'
      if (!form.currentRent.trim()) nextErrors.currentRent = 'Current rent/mortgage required'
      if (!form.reasonForLeaving.trim()) nextErrors.reasonForLeaving = 'Reason for leaving is required'
      if (!form.currentLandlordName.trim()) nextErrors.currentLandlordName = 'Current landlord name required'
      if (!form.currentLandlordPhone.trim()) nextErrors.currentLandlordPhone = 'Landlord phone required'
    } else if (step === 'employment') {
      if (!form.employerName.trim()) nextErrors.employerName = 'Employer name is required'
      if (!form.jobTitle.trim()) nextErrors.jobTitle = 'Position / job title required'
      if (!form.monthlyIncome.trim()) nextErrors.monthlyIncome = 'Gross monthly income is required'
    } else if (step === 'references') {
      if (!form.referenceName.trim()) nextErrors.referenceName = 'Reference name is required'
      if (!form.referencePhone.trim()) nextErrors.referencePhone = 'Reference phone is required'
      if (!form.referenceRelationship.trim()) nextErrors.referenceRelationship = 'Reference relationship is required'
      if (!form.emergencyContactName.trim()) nextErrors.emergencyContactName = 'Emergency contact required'
      if (!form.emergencyContactPhone.trim()) nextErrors.emergencyContactPhone = 'Emergency phone required'
    } else if (step === 'preferences') {
      if (!form.requestedMoveInDate) nextErrors.requestedMoveInDate = 'Requested move-in date is required'
      if (!form.desiredLeaseTerm) nextErrors.desiredLeaseTerm = 'Desired lease term is required'
      if (!form.primaryPaymentMethod) nextErrors.primaryPaymentMethod = 'Primary payment method is required'
      if (form.preferredContactMethod.length === 0) nextErrors.preferredContactMethod = 'Select at least one contact method'
      if (form.preferredTime.length === 0) nextErrors.preferredTime = 'Select at least one preferred time'
    } else if (step === 'review') {
      if (!form.certifyAccurate) nextErrors.certifyAccurate = 'You must certify accuracy'
      if (!form.authorizeScreening) nextErrors.authorizeScreening = 'You must authorize screening'
      if (!form.acknowledgeFee) nextErrors.acknowledgeFee = 'You must acknowledge the $50 application fee policy'
      if (!form.agreeTermsPrivacy) nextErrors.agreeTermsPrivacy = 'You must agree to Terms and Privacy Policy'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleNext = () => {
    if (!validateStep(currentStep)) return
    if (stepIndex < STEP_ORDER.length - 1) {
      setStepIndex((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleSubmit = async () => {
    if (submittingRef.current || submittedAppId) return
    if (!validateStep('review')) return
    submittingRef.current = true
    setIsSubmitting(true)
    setSubmissionError(null)

    try {
      const supabaseUrl = window.CONFIG?.SUPABASE_URL?.replace(/\/$/, '')
      const anonKey = window.CONFIG?.SUPABASE_ANON_KEY
      if (!supabaseUrl || !anonKey) {
        throw new Error('The application system is temporarily unavailable. Please try again later or use the classic application.')
      }

      const formData = new FormData()
      formData.append('Property ID', form.propertyId)
      formData.append('Property Address', form.propertyAddress)
      formData.append('Property City', form.propertyCity)
      formData.append('Property State', form.propertyState)
      formData.append('Property Zip', form.propertyZip)
      formData.append('Listed Rent', form.propertyRent)
      formData.append('Application Fee', '50')
      formData.append('Security Deposit', form.propertyRent)
      formData.append('Requested Move-in Date', form.requestedMoveInDate)
      formData.append('Desired Lease Term', form.desiredLeaseTerm)
      formData.append('First Name', form.firstName)
      formData.append('Last Name', form.lastName)
      formData.append('Email', form.email)
      formData.append('Phone', form.phone)
      formData.append('DOB', form.dob)
      formData.append('SSN', form.ssnLast4)
      formData.append('Has Co-Applicant', form.hasCoApplicant)
      if (form.hasCoApplicant === 'yes') {
        formData.append('Additional Person Role', form.additionalPersonRole)
        formData.append('Co-Applicant First Name', form.coApplicantFirstName)
        formData.append('Co-Applicant Last Name', form.coApplicantLastName)
        formData.append('Co-Applicant Email', form.coApplicantEmail)
        formData.append('Co-Applicant Phone', form.coApplicantPhone)
        formData.append('Co-Applicant DOB', form.coApplicantDob)
        formData.append('Co-Applicant SSN', form.coApplicantSsn)
        formData.append('Co-Applicant Employer', form.coApplicantEmployer)
        formData.append('Co-Applicant Job Title', form.coApplicantJobTitle)
        formData.append('Co-Applicant Monthly Income', form.coApplicantMonthlyIncome)
        formData.append('Co-Applicant Employment Duration', form.coApplicantEmploymentDuration)
        formData.append('Co-Applicant Consent', form.coApplicantConsent ? 'yes' : 'no')
      }
      formData.append('Current Address', form.currentAddress)
      formData.append('Residency Duration', form.residencyDuration)
      formData.append('Current Rent Amount', form.currentRent)
      formData.append('Reason for leaving', form.reasonForLeaving)
      formData.append('Current Landlord Name', form.currentLandlordName)
      formData.append('Landlord Phone', form.currentLandlordPhone)
      formData.append('Total Occupants', form.totalOccupants)
      formData.append('Additional Occupants', form.additionalOccupants)
      formData.append('Has Pets', form.hasPets)
      if (form.hasPets === 'yes') formData.append('Pet Details', form.petDetails)
      formData.append('Has Vehicle', form.hasVehicles)
      if (form.hasVehicles === 'yes') {
        formData.append('Vehicle Make', form.vehicleMake)
        formData.append('Vehicle Model', form.vehicleModel)
        formData.append('Vehicle Year', form.vehicleYear)
        formData.append('Vehicle License Plate', form.vehicleLicensePlate)
      }
      formData.append('Ever Evicted', form.everEvicted)
      formData.append('Smoker', form.smoker)
      formData.append('Employment Status', form.employmentStatus)
      formData.append('Employer', form.employerName)
      formData.append('Employer Address', form.employerAddress)
      formData.append('Job Title', form.jobTitle)
      formData.append('Employment Start Date', form.employmentStartDate)
      formData.append('Employment Duration', form.employmentDuration)
      formData.append('Supervisor Name', form.supervisorName)
      formData.append('Supervisor Phone', form.supervisorPhone)
      formData.append('Monthly Income', form.monthlyIncome)
      formData.append('Other Income', form.incomeSource)
      formData.append('Reference 1 Name', form.referenceName)
      formData.append('Reference 1 Phone', form.referencePhone)
      formData.append('Reference 1 Relationship', form.referenceRelationship)
      formData.append('Reference 2 Name', form.reference2Name)
      formData.append('Reference 2 Phone', form.reference2Phone)
      formData.append('Reference 2 Relationship', form.reference2Relationship)
      formData.append('Emergency Contact Name', form.emergencyContactName)
      formData.append('Emergency Contact Phone', form.emergencyContactPhone)
      formData.append('Emergency Contact Relationship', form.emergencyContactRelationship)
      formData.append('Primary Payment Method', form.primaryPaymentMethod)
      formData.append('Primary Payment Method Other', form.primaryPaymentMethodOther)
      formData.append('Alternative Payment Method', form.alternativePaymentMethod)
      formData.append('Alternative Payment Method Other', form.alternativePaymentMethodOther)
      formData.append('Third Choice Payment Method', form.thirdChoicePaymentMethod)
      formData.append('Third Choice Payment Method Other', form.thirdChoicePaymentMethodOther)
      form.preferredContactMethod.forEach((method) => formData.append('Preferred Contact Method', method))
      form.preferredTime.forEach((time) => formData.append('Preferred Time', time))
      formData.append('Preferred Time Specific', form.preferredTimeSpecific)
      formData.append('Terms Consent', 'yes')
      formData.append('SMS Consent', form.smsConsent ? 'yes' : 'no')
      formData.append('Consent Version', '2.0')

      // Keep one idempotency key for this logical submission so a retry can
      // safely retrieve the original server-created application.
      if (!submissionUuidRef.current) {
        submissionUuidRef.current = window.crypto?.randomUUID?.() ||
          'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
            const random = Math.random() * 16 | 0
            const value = character === 'x' ? random : (random & 0x3) | 0x8
            return value.toString(16)
          })
      }
      formData.set('submission_uuid', submissionUuidRef.current)
      formData.set('_cp_csrf', sessionStorage.getItem('_cp_csrf') || submissionUuidRef.current)

      const encodeFile = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result
          if (typeof result !== 'string' || !result.includes(',')) {
            reject(new Error('A document could not be prepared for upload.'))
            return
          }
          resolve(result.split(',')[1])
        }
        reader.onerror = () => reject(new Error('A document could not be read.'))
        reader.readAsDataURL(file)
      })

      if (form.documents.length > 0) {
        const encoded = await Promise.all((form.documents as File[]).map(encodeFile))
        encoded.forEach((base64, index) => {
          formData.append(`_docFile_${index}_name`, form.documents[index].name)
          formData.append(`_docFile_${index}_type`, form.documents[index].type || 'application/octet-stream')
          formData.append(`_docFile_${index}_data`, base64)
        })
      }

      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 120000)
      let response: Response
      try {
        response = await fetch(`${supabaseUrl}/functions/v1/receive-application`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new Error('The application system took too long to respond. Please retry; your application was not confirmed.')
        }
        throw new Error('We could not reach the application system. Please check your connection and retry.')
      } finally {
        window.clearTimeout(timeout)
      }

      let payload: { success?: boolean; appId?: unknown; portal_login_url?: unknown; error?: unknown } = {}
      try {
        payload = await response.json()
      } catch {
        throw new Error('The application system returned an unexpected response. Please retry.')
      }

      if (!response.ok) {
        const serverMessage = typeof payload.error === 'string' ? payload.error : ''
        throw new Error(serverMessage || `The application could not be submitted (HTTP ${response.status}). Please retry.`)
      }

      if (payload.success !== true || typeof payload.appId !== 'string' || !payload.appId.trim()) {
        const serverMessage = typeof payload.error === 'string' ? payload.error : ''
        throw new Error(serverMessage || 'The application was not confirmed by the server. Please retry.')
      }

      setSubmittedAppId(payload.appId)
      setPortalLoginUrl(typeof payload.portal_login_url === 'string' ? payload.portal_login_url : null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'The application could not be submitted. Please retry.')
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  // Classic intake link with all query params
  const classicParams = new URLSearchParams()
  if (form.propertyId) classicParams.set('id', form.propertyId)
  if (form.propertyAddress) classicParams.set('addr', form.propertyAddress)
  if (form.propertyRent) classicParams.set('rent', form.propertyRent)
  if (form.propertyCity) classicParams.set('city', form.propertyCity)
  if (form.propertyState) classicParams.set('state', form.propertyState)
  if (form.propertyZip) classicParams.set('zip', form.propertyZip)
  classicParams.set('fee', '50')
  const classicUrl = `/apply/index.html?${classicParams.toString()}`

  return (
    <div id="apply-page-container" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <Navbar />

      <main className="flex-1">
        {/* If submitted successfully, show Confirmation Screen */}
        {submittedAppId ? (
          <section id="application-confirmation-screen" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-[#00AD71]/40 bg-gradient-to-b from-slate-100 to-slate-950 p-8 sm:p-12 shadow-2xl space-y-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00AD71]/20 border border-[#00AD71]/40 text-[#00AD71] text-3xl">
                ✓
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#00AD71]">
                  Submission Received
                </span>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900">
                  Application Submitted Successfully
                </h1>
                <p className="text-sm sm:text-base text-slate-600 max-w-lg mx-auto">
                  Thank you, <strong className="text-slate-900">{form.firstName}</strong>. Your rental intake has been logged securely in our leasing system.
                </p>
              </div>

              {/* Tracking ID Badge */}
              <div className="mx-auto max-w-md rounded-2xl border border-slate-300 bg-white/90 p-5 space-y-2">
                <span className="block text-xs uppercase tracking-wider text-slate-500">Your Application Tracking ID</span>
                <span className="block font-mono text-xl sm:text-2xl font-bold text-[#006AFF] select-all">
                  {submittedAppId}
                </span>
                <p className="text-xs text-slate-500">Save this ID to check your live review status.</p>
              </div>

              {/* What Happens Next Checklist */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 text-left space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">What Happens Next:</h3>
                <ol className="space-y-3 text-xs sm:text-sm text-slate-600">
                  <li className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#006AFF]/20 text-[#006AFF] font-bold text-xs">1</span>
                    <span><strong>Screening Fee Coordination:</strong> Our leasing team will contact you within 24 hours at <strong>{form.phone}</strong> or <strong>{form.email}</strong> to securely complete the standard $50 screening fee. Nothing has been charged yet.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#006AFF]/20 text-[#006AFF] font-bold text-xs">2</span>
                    <span><strong>Active Review (24–72h):</strong> Your background, credit, and employment records are verified.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#006AFF]/20 text-[#006AFF] font-bold text-xs">3</span>
                    <span><strong>Digital Lease Delivery:</strong> Approved applicants receive digital e-sign lease documents and move-in schedule details.</span>
                  </li>
                </ol>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
                <a
                  href={portalLoginUrl || '/tenant/portal.html'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-xl bg-[#006AFF] px-6 py-3.5 text-sm font-bold text-white shadow-lg  transition hover:bg-[#0058D6] min-h-[44px]"
                >
                  Open Application Tracker →
                </a>
                <Link
                  to="/listings"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-slate-850 px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-700 min-h-[44px]"
                >
                  Return to Listings
                </Link>
              </div>
            </div>
          </section>
        ) : (
          /* Main Application Form Wizard */
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#006AFF]/30 bg-[#006AFF]/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-[#006AFF]">
                  Verified Online Intake
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                  Rental Application
                </h1>
                <p className="text-xs sm:text-sm text-slate-600">
                  Standard $50 screening fee • Fixed 1× rent deposit • 100% pet friendly
                </p>
              </div>

              {/* Switch to Classic Form Link */}
              <a
                href={classicUrl}
                className="text-xs text-slate-500 hover:text-[#006AFF] transition underline underline-offset-4"
              >
                Prefer classic document portal? Open here ↗
              </a>
            </div>

            {/* Property Context Banner */}
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Applying For Property</span>
                <p className="text-base font-bold text-slate-900">
                  {form.propertyAddress || 'Choice Properties Marketplace Home'}
                </p>
                {form.propertyCity && (
                  <p className="text-xs text-slate-500">
                    {form.propertyCity}, {form.propertyState} {form.propertyZip}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {form.propertyRent && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-center">
                    <span className="block text-[10px] uppercase text-slate-500">Rent</span>
                    <span className="font-bold text-slate-900">${Number(form.propertyRent).toLocaleString()}/mo</span>
                  </div>
                )}
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-center">
                  <span className="block text-[10px] uppercase text-slate-500">App Fee</span>
                  <span className="font-bold text-[#006AFF]">$50.00</span>
                </div>
              </div>
            </div>

            {submissionError && (
              <div id="application-submission-error" className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 text-rose-100" role="alert">
                <p className="font-semibold">We could not confirm your application.</p>
                <p className="mt-1 text-sm text-rose-200/90">{submissionError}</p>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting}
                  className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-rose-400/50 bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Retry Submission
                </button>
              </div>
            )}

            {/* Step Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span aria-live="polite">Step {stepIndex + 1} of {STEP_ORDER.length}: {STEP_TITLES[currentStep]}</span>
                <span aria-live="polite">{Math.round(progressPercent)}% Complete</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-850">
                <div
                  className="h-full rounded-full bg-[#006AFF] transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Step Content Container */}
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 sm:p-8 space-y-6" aria-labelledby="application-step-title">
              {/* STEP 1: IDENTITY */}
              {currentStep === 'identity' && (
                <div className="space-y-5">
                  <h2 id="application-step-title" tabIndex={-1} className="text-lg sm:text-xl font-bold text-slate-900 border-b border-slate-200 pb-3">
                    Applicant Identity &amp; Contact
                  </h2>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
                    <span className="text-xs uppercase font-bold text-[#006AFF]">Rental Details</span>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                          Requested Move-in Date <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="date"
                          value={form.requestedMoveInDate}
                          onChange={(e) => updateField('requestedMoveInDate', e.target.value)}
                          className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#006AFF] ${
                            errors.requestedMoveInDate ? 'border-rose-500' : 'border-slate-300'
                          }`}
                        />
                        {errors.requestedMoveInDate && <p className="text-xs text-rose-400 mt-1">{errors.requestedMoveInDate}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                          Desired Lease Term <span className="text-rose-400">*</span>
                        </label>
                        <select
                          value={form.desiredLeaseTerm}
                          onChange={(e) => updateField('desiredLeaseTerm', e.target.value)}
                          className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#006AFF] ${
                            errors.desiredLeaseTerm ? 'border-rose-500' : 'border-slate-300'
                          }`}
                        >
                          <option value="">Select term...</option>
                          <option value="6 months">6 Months</option>
                          <option value="12 months">12 Months</option>
                          <option value="18 months">18 Months</option>
                          <option value="24 months">24 Months</option>
                          <option value="Month-to-month">Month-to-month</option>
                        </select>
                        {errors.desiredLeaseTerm && <p className="text-xs text-rose-400 mt-1">{errors.desiredLeaseTerm}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        First Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.firstName}
                        onChange={(e) => updateField('firstName', e.target.value)}
                        placeholder="John"
                        className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-[#006AFF] ${
                          errors.firstName ? 'border-rose-500' : 'border-slate-300'
                        }`}
                      />
                      {errors.firstName && <p className="text-xs text-rose-400 mt-1">{errors.firstName}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        Last Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.lastName}
                        onChange={(e) => updateField('lastName', e.target.value)}
                        placeholder="Doe"
                        className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-[#006AFF] ${
                          errors.lastName ? 'border-rose-500' : 'border-slate-300'
                        }`}
                      />
                      {errors.lastName && <p className="text-xs text-rose-400 mt-1">{errors.lastName}</p>}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        Email Address <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        placeholder="john.doe@example.com"
                        className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-[#006AFF] ${
                          errors.email ? 'border-rose-500' : 'border-slate-300'
                        }`}
                      />
                      {errors.email && <p className="text-xs text-rose-400 mt-1">{errors.email}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        Phone Number <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => updateField('phone', e.target.value)}
                        placeholder="(555) 000-0000"
                        className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-[#006AFF] ${
                          errors.phone ? 'border-rose-500' : 'border-slate-300'
                        }`}
                      />
                      {errors.phone && <p className="text-xs text-rose-400 mt-1">{errors.phone}</p>}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        Date of Birth <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={form.dob}
                        onChange={(e) => updateField('dob', e.target.value)}
                        className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-[#006AFF] ${
                          errors.dob ? 'border-rose-500' : 'border-slate-300'
                        }`}
                      />
                      {errors.dob && <p className="text-xs text-rose-400 mt-1">{errors.dob}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        SSN Last 4 Digits <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        value={form.ssnLast4}
                        onChange={(e) => updateField('ssnLast4', e.target.value.replace(/\D/g, ''))}
                        placeholder="1234"
                        className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-[#006AFF] ${
                          errors.ssnLast4 ? 'border-rose-500' : 'border-slate-300'
                        }`}
                      />
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        Full SSN is never stored. Used for FCRA screening match.
                      </span>
                      {errors.ssnLast4 && <p className="text-xs text-rose-400 mt-1">{errors.ssnLast4}</p>}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <label className="block text-xs font-semibold uppercase text-slate-600 mb-2">
                      Will you have a Co-Applicant?
                    </label>
                    <div className="flex gap-4 mb-4">
                      <label className="flex items-center gap-2 text-sm text-slate-900">
                        <input type="radio" name="hasCoApplicant" value="yes" checked={form.hasCoApplicant === 'yes'} onChange={() => updateField('hasCoApplicant', 'yes')} /> Yes
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-900">
                        <input type="radio" name="hasCoApplicant" value="no" checked={form.hasCoApplicant === 'no'} onChange={() => updateField('hasCoApplicant', 'no')} /> No
                      </label>
                    </div>
                    {form.hasCoApplicant === 'yes' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Role</label>
                          <select
                            value={form.additionalPersonRole}
                            onChange={(e) => updateField('additionalPersonRole', e.target.value as FormState['additionalPersonRole'])}
                            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none"
                          >
                            <option value="Co-applicant">Co-applicant (will live in the unit)</option>
                            <option value="Guarantor">Guarantor (financial backup only)</option>
                          </select>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">First Name <span className="text-rose-400">*</span></label>
                            <input type="text" value={form.coApplicantFirstName} onChange={(e) => updateField('coApplicantFirstName', e.target.value)} className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none ${errors.coApplicantFirstName ? 'border-rose-500' : 'border-slate-300'}`} />
                            {errors.coApplicantFirstName && <p className="text-xs text-rose-400 mt-1">{errors.coApplicantFirstName}</p>}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Last Name <span className="text-rose-400">*</span></label>
                            <input type="text" value={form.coApplicantLastName} onChange={(e) => updateField('coApplicantLastName', e.target.value)} className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none ${errors.coApplicantLastName ? 'border-rose-500' : 'border-slate-300'}`} />
                            {errors.coApplicantLastName && <p className="text-xs text-rose-400 mt-1">{errors.coApplicantLastName}</p>}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Email</label>
                            <input type="email" value={form.coApplicantEmail} onChange={(e) => updateField('coApplicantEmail', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Phone</label>
                            <input type="tel" value={form.coApplicantPhone} onChange={(e) => updateField('coApplicantPhone', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Date of Birth</label>
                            <input type="date" value={form.coApplicantDob} onChange={(e) => updateField('coApplicantDob', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">SSN Last 4</label>
                            <input type="text" maxLength={4} value={form.coApplicantSsn} onChange={(e) => updateField('coApplicantSsn', e.target.value.replace(/\D/g, ''))} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Employer</label>
                            <input type="text" value={form.coApplicantEmployer} onChange={(e) => updateField('coApplicantEmployer', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Job Title</label>
                            <input type="text" value={form.coApplicantJobTitle} onChange={(e) => updateField('coApplicantJobTitle', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Gross Monthly Income</label>
                            <input type="text" value={form.coApplicantMonthlyIncome} onChange={(e) => updateField('coApplicantMonthlyIncome', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Employment Duration</label>
                            <input type="text" value={form.coApplicantEmploymentDuration} onChange={(e) => updateField('coApplicantEmploymentDuration', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none" />
                          </div>
                        </div>
                        <label className="flex items-start gap-3 text-xs sm:text-sm text-slate-600 cursor-pointer">
                          <input type="checkbox" checked={form.coApplicantConsent} onChange={(e) => updateField('coApplicantConsent', e.target.checked)} className="mt-1 h-4 w-4 rounded accent-[#006AFF]" />
                          <span>I authorize verification of the information provided for this additional person, including credit and background checks. <span className="text-rose-400">*</span></span>
                        </label>
                        {errors.coApplicantConsent && <p className="text-xs text-rose-400">{errors.coApplicantConsent}</p>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: RESIDENCY */}
              {currentStep === 'residency' && (
                <div className="space-y-5">
                  <h2 id="application-step-title" tabIndex={-1} className="text-lg sm:text-xl font-bold text-slate-900 border-b border-slate-200 pb-3">
                    Current Residence &amp; Occupants
                  </h2>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                      Current Street Address, City, State, ZIP <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.currentAddress}
                      onChange={(e) => updateField('currentAddress', e.target.value)}
                      placeholder="123 Main St, Apt 4B, City, State 12345"
                      className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-[#006AFF] ${
                        errors.currentAddress ? 'border-rose-500' : 'border-slate-300'
                      }`}
                    />
                    {errors.currentAddress && <p className="text-xs text-rose-400 mt-1">{errors.currentAddress}</p>}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        How long at this address? <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.residencyDuration}
                        onChange={(e) => updateField('residencyDuration', e.target.value)}
                        placeholder="e.g. 2 years"
                        className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-[#006AFF] ${
                          errors.residencyDuration ? 'border-rose-500' : 'border-slate-300'
                        }`}
                      />
                      {errors.residencyDuration && <p className="text-xs text-rose-400 mt-1">{errors.residencyDuration}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        Current Monthly Rent / Mortgage <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.currentRent}
                        onChange={(e) => updateField('currentRent', e.target.value)}
                        placeholder="$1,200"
                        className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-[#006AFF] ${
                          errors.currentRent ? 'border-rose-500' : 'border-slate-300'
                        }`}
                      />
                      {errors.currentRent && <p className="text-xs text-rose-400 mt-1">{errors.currentRent}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                      Reason for Leaving <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      value={form.reasonForLeaving}
                      onChange={(e) => updateField('reasonForLeaving', e.target.value)}
                      rows={2}
                      placeholder="Why are you moving?"
                      className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-[#006AFF] ${
                        errors.reasonForLeaving ? 'border-rose-500' : 'border-slate-300'
                      }`}
                    />
                    {errors.reasonForLeaving && <p className="text-xs text-rose-400 mt-1">{errors.reasonForLeaving}</p>}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        Current Landlord / Manager Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.currentLandlordName}
                        onChange={(e) => updateField('currentLandlordName', e.target.value)}
                        placeholder="Property Manager Name"
                        className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-[#006AFF] ${
                          errors.currentLandlordName ? 'border-rose-500' : 'border-slate-300'
                        }`}
                      />
                      {errors.currentLandlordName && <p className="text-xs text-rose-400 mt-1">{errors.currentLandlordName}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        Current Landlord Phone <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="tel"
                        value={form.currentLandlordPhone}
                        onChange={(e) => updateField('currentLandlordPhone', e.target.value)}
                        placeholder="(555) 000-0000"
                        className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-[#006AFF] ${
                          errors.currentLandlordPhone ? 'border-rose-500' : 'border-slate-300'
                        }`}
                      />
                      {errors.currentLandlordPhone && <p className="text-xs text-rose-400 mt-1">{errors.currentLandlordPhone}</p>}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Total Occupants</label>
                      <input
                        type="number"
                        min={1}
                        value={form.totalOccupants}
                        onChange={(e) => updateField('totalOccupants', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#006AFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Other Occupants</label>
                      <input
                        type="text"
                        value={form.additionalOccupants}
                        onChange={(e) => updateField('additionalOccupants', e.target.value)}
                        placeholder="Names, ages, relationship"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-[#006AFF]"
                      />
                    </div>
                  </div>

                  {/* Pets */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-slate-900">Do you have pets?</span>
                        <p className="text-xs text-[#00AD71]">All Choice Properties listings are 100% pet-friendly!</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateField('hasPets', 'no')}
                          className={`rounded-xl px-4 py-1.5 text-xs font-semibold transition ${
                            form.hasPets === 'no'
                              ? 'bg-slate-700 text-slate-900'
                              : 'bg-white border border-slate-200 text-slate-500'
                          }`}
                        >
                          No
                        </button>
                        <button
                          type="button"
                          onClick={() => updateField('hasPets', 'yes')}
                          className={`rounded-xl px-4 py-1.5 text-xs font-semibold transition ${
                            form.hasPets === 'yes'
                              ? 'bg-[#006AFF] text-white font-bold'
                              : 'bg-white border border-slate-200 text-slate-500'
                          }`}
                        >
                          Yes
                        </button>
                      </div>
                    </div>

  
                  <div className="pt-5 border-t border-slate-200">
                    <label className="block text-xs font-semibold uppercase text-slate-600 mb-2">
                      Do you have any vehicles?
                    </label>
                    <div className="flex gap-4 mb-4">
                      <label className="flex items-center gap-2 text-sm text-slate-900">
                        <input type="radio" name="hasVehicles" value="yes" checked={form.hasVehicles === 'yes'} onChange={() => updateField('hasVehicles', 'yes')} /> Yes
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-900">
                        <input type="radio" name="hasVehicles" value="no" checked={form.hasVehicles === 'no'} onChange={() => updateField('hasVehicles', 'no')} /> No
                      </label>
                    </div>
                    {form.hasVehicles === 'yes' && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Make</label>
                          <input type="text" value={form.vehicleMake} onChange={(e) => updateField('vehicleMake', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Model</label>
                          <input type="text" value={form.vehicleModel} onChange={(e) => updateField('vehicleModel', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Year</label>
                          <input type="text" value={form.vehicleYear} onChange={(e) => updateField('vehicleYear', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">License Plate</label>
                          <input type="text" value={form.vehicleLicensePlate} onChange={(e) => updateField('vehicleLicensePlate', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none" />
                        </div>
                      </div>
                    )}
                  </div>

                  {form.hasPets === 'yes' && (
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                          Pet Details (Breed, weight, count)
                        </label>
                        <input
                          type="text"
                          value={form.petDetails}
                          onChange={(e) => updateField('petDetails', e.target.value)}
                          placeholder="e.g. 1 Golden Retriever (45 lbs), 1 domestic cat"
                          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-[#006AFF]"
                        />
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2 border-t border-slate-200 pt-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-600 mb-2">Have you ever been evicted?</label>
                        <div className="flex gap-4 text-sm text-slate-900">
                          <label className="flex items-center gap-2"><input type="radio" checked={form.everEvicted === 'yes'} onChange={() => updateField('everEvicted', 'yes')} /> Yes</label>
                          <label className="flex items-center gap-2"><input type="radio" checked={form.everEvicted === 'no'} onChange={() => updateField('everEvicted', 'no')} /> No</label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-600 mb-2">Do you smoke?</label>
                        <div className="flex gap-4 text-sm text-slate-900">
                          <label className="flex items-center gap-2"><input type="radio" checked={form.smoker === 'yes'} onChange={() => updateField('smoker', 'yes')} /> Yes</label>
                          <label className="flex items-center gap-2"><input type="radio" checked={form.smoker === 'no'} onChange={() => updateField('smoker', 'no')} /> No</label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: EMPLOYMENT */}
              {currentStep === 'employment' && (
                <div className="space-y-5">
                  <h2 id="application-step-title" tabIndex={-1} className="text-lg sm:text-xl font-bold text-slate-900 border-b border-slate-200 pb-3">
                    Employment &amp; Income Verification
                  </h2>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        Employment Status
                      </label>
                      <select
                        value={form.employmentStatus}
                        onChange={(e) => updateField('employmentStatus', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#006AFF]"
                      >
                        <option value="Full-time">Full-time Employed</option>
                        <option value="Part-time">Part-time Employed</option>
                        <option value="Self-employed">Self-Employed / Freelance</option>
                        <option value="Retired">Retired</option>
                        <option value="Student">Student</option>
                        <option value="Other">Other / Benefits</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        Gross Monthly Income <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.monthlyIncome}
                        onChange={(e) => updateField('monthlyIncome', e.target.value)}
                        placeholder="e.g. $4,500"
                        className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-[#006AFF] ${
                          errors.monthlyIncome ? 'border-rose-500' : 'border-slate-300'
                        }`}
                      />
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        Standard recommendation is ~3× monthly rent.
                      </span>
                      {errors.monthlyIncome && <p className="text-xs text-rose-400 mt-1">{errors.monthlyIncome}</p>}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        Employer / Company Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.employerName}
                        onChange={(e) => updateField('employerName', e.target.value)}
                        placeholder="Acme Corporation"
                        className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-[#006AFF] ${
                          errors.employerName ? 'border-rose-500' : 'border-slate-300'
                        }`}
                      />
                      {errors.employerName && <p className="text-xs text-rose-400 mt-1">{errors.employerName}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        Job Title / Position <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.jobTitle}
                        onChange={(e) => updateField('jobTitle', e.target.value)}
                        placeholder="Software Engineer, Nurse, Manager..."
                        className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-[#006AFF] ${
                          errors.jobTitle ? 'border-rose-500' : 'border-slate-300'
                        }`}
                      />
                      {errors.jobTitle && <p className="text-xs text-rose-400 mt-1">{errors.jobTitle}</p>}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Employer Address</label>
                      <input
                        type="text"
                        value={form.employerAddress}
                        onChange={(e) => updateField('employerAddress', e.target.value)}
                        placeholder="Employer street address"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-[#006AFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Employment Start Date</label>
                      <input
                        type="date"
                        value={form.employmentStartDate}
                        onChange={(e) => updateField('employmentStartDate', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#006AFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Employment Duration</label>
                      <input
                        type="text"
                        value={form.employmentDuration}
                        onChange={(e) => updateField('employmentDuration', e.target.value)}
                        placeholder="e.g. 3 years"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-[#006AFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Supervisor Name</label>
                      <input
                        type="text"
                        value={form.supervisorName}
                        onChange={(e) => updateField('supervisorName', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#006AFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Supervisor Phone</label>
                      <input
                        type="tel"
                        value={form.supervisorPhone}
                        onChange={(e) => updateField('supervisorPhone', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#006AFF]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: REFERENCES */}
              {currentStep === 'references' && (
                <div className="space-y-5">
                  <h2 id="application-step-title" tabIndex={-1} className="text-lg sm:text-xl font-bold text-slate-900 border-b border-slate-200 pb-3">
                    References &amp; Emergency Contact
                  </h2>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
                    <span className="text-xs uppercase font-bold text-[#006AFF]">Personal or Professional Reference</span>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                          Full Name <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.referenceName}
                          onChange={(e) => updateField('referenceName', e.target.value)}
                          placeholder="Jane Smith"
                          className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-[#006AFF] ${
                            errors.referenceName ? 'border-rose-500' : 'border-slate-300'
                          }`}
                        />
                        {errors.referenceName && <p className="text-xs text-rose-400 mt-1">{errors.referenceName}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                          Phone Number <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="tel"
                          value={form.referencePhone}
                          onChange={(e) => updateField('referencePhone', e.target.value)}
                          placeholder="(555) 000-0000"
                          className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-[#006AFF] ${
                            errors.referencePhone ? 'border-rose-500' : 'border-slate-300'
                          }`}
                        />
                        {errors.referencePhone && <p className="text-xs text-rose-400 mt-1">{errors.referencePhone}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
                    <span className="text-xs uppercase font-bold text-slate-500">Reference 2 (Optional)</span>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <input type="text" value={form.reference2Name} onChange={(e) => updateField('reference2Name', e.target.value)} placeholder="Full name" className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-[#006AFF]" />
                      <input type="tel" value={form.reference2Phone} onChange={(e) => updateField('reference2Phone', e.target.value)} placeholder="Phone number" className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-[#006AFF]" />
                    </div>
                    <input type="text" value={form.reference2Relationship} onChange={(e) => updateField('reference2Relationship', e.target.value)} placeholder="Relationship (former landlord, employer, coworker, friend)" className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-[#006AFF]" />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
                    <span className="text-xs uppercase font-bold text-[#00AD71]">Emergency Contact</span>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                          Contact Name <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.emergencyContactName}
                          onChange={(e) => updateField('emergencyContactName', e.target.value)}
                          placeholder="Contact Full Name"
                          className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-[#006AFF] ${
                            errors.emergencyContactName ? 'border-rose-500' : 'border-slate-300'
                          }`}
                        />
                        {errors.emergencyContactName && <p className="text-xs text-rose-400 mt-1">{errors.emergencyContactName}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                          Emergency Phone <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="tel"
                          value={form.emergencyContactPhone}
                          onChange={(e) => updateField('emergencyContactPhone', e.target.value)}
                          placeholder="(555) 000-0000"
                          className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-[#006AFF] ${
                            errors.emergencyContactPhone ? 'border-rose-500' : 'border-slate-300'
                          }`}
                        />
                        {errors.emergencyContactPhone && <p className="text-xs text-rose-400 mt-1">{errors.emergencyContactPhone}</p>}
                      </div>
                    </div>
                    <input
                      type="text"
                      value={form.emergencyContactRelationship}
                      onChange={(e) => updateField('emergencyContactRelationship', e.target.value)}
                      placeholder="Relationship to you (spouse, parent, friend)"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-[#006AFF]"
                    />
                  </div>

                  <div className="pt-5 border-t border-slate-200">
                    <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                      Upload Documents (ID, Pay Stubs, etc.)
                    </label>
                    <p className="text-xs text-slate-500 mb-3">Please upload PDF, JPG, or PNG files. Up to 4 files, max 3MB total.</p>
                    <input 
                      type="file" 
                      multiple 
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => {
                        if (e.target.files) {
                          updateField('documents', Array.from(e.target.files) as any);
                        }
                      }} 
                      className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#006AFF]/20 file:text-[#006AFF] hover:file:bg-[#006AFF]/30"
                    />
                    {form.documents && form.documents.length > 0 && (
                      <ul className="mt-3 text-xs text-slate-600 list-disc pl-5">
                        {form.documents.map((f: any, i: number) => (
                          <li key={i}>{f.name} ({(f.size / 1024).toFixed(1)} KB)</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 5: PAYMENT & CONTACT PREFERENCES */}
              {currentStep === 'preferences' && (
                <div className="space-y-6">
                  <h2 id="application-step-title" tabIndex={-1} className="text-lg sm:text-xl font-bold text-slate-900 border-b border-slate-200 pb-3">
                    Payment &amp; Contact Preferences
                  </h2>
                  <div className="rounded-2xl border border-[#00AD71]/30 bg-[#00AD71]/10 p-4 text-sm text-[#00AD71]">
                    No payment is collected through this form. A representative will contact you after submission to coordinate the application fee.
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        Requested Move-in Date <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={form.requestedMoveInDate}
                        onChange={(e) => updateField('requestedMoveInDate', e.target.value)}
                        className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#006AFF] ${errors.requestedMoveInDate ? 'border-rose-500' : 'border-slate-300'}`}
                      />
                      {errors.requestedMoveInDate && <p className="mt-1 text-xs text-rose-400">{errors.requestedMoveInDate}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        Desired Lease Term <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={form.desiredLeaseTerm}
                        onChange={(e) => updateField('desiredLeaseTerm', e.target.value)}
                        className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#006AFF] ${errors.desiredLeaseTerm ? 'border-rose-500' : 'border-slate-300'}`}
                      >
                        <option value="">Select term...</option>
                        <option value="6 months">6 Months</option>
                        <option value="12 months">12 Months</option>
                        <option value="18 months">18 Months</option>
                        <option value="24 months">24 Months</option>
                        <option value="Month-to-month">Month-to-month</option>
                      </select>
                      {errors.desiredLeaseTerm && <p className="mt-1 text-xs text-rose-400">{errors.desiredLeaseTerm}</p>}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        Primary Payment Method <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={form.primaryPaymentMethod}
                        onChange={(e) => updateField('primaryPaymentMethod', e.target.value)}
                        className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#006AFF] ${errors.primaryPaymentMethod ? 'border-rose-500' : 'border-slate-300'}`}
                      >
                        <option value="">Select your primary method</option>
                        {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
                      </select>
                      {form.primaryPaymentMethod === 'Other' && <input type="text" value={form.primaryPaymentMethodOther} onChange={(e) => updateField('primaryPaymentMethodOther', e.target.value)} placeholder="Enter payment method" className="mt-3 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none" />}
                      {errors.primaryPaymentMethod && <p className="mt-1 text-xs text-rose-400">{errors.primaryPaymentMethod}</p>}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Alternative Payment Method</label>
                        <select value={form.alternativePaymentMethod} onChange={(e) => updateField('alternativePaymentMethod', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#006AFF]">
                          <option value="">Optional backup method</option>
                          {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
                        </select>
                        {form.alternativePaymentMethod === 'Other' && <input type="text" value={form.alternativePaymentMethodOther} onChange={(e) => updateField('alternativePaymentMethodOther', e.target.value)} placeholder="Enter payment method" className="mt-3 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none" />}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Third Payment Method</label>
                        <select value={form.thirdChoicePaymentMethod} onChange={(e) => updateField('thirdChoicePaymentMethod', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#006AFF]">
                          <option value="">Optional additional method</option>
                          {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
                        </select>
                        {form.thirdChoicePaymentMethod === 'Other' && <input type="text" value={form.thirdChoicePaymentMethodOther} onChange={(e) => updateField('thirdChoicePaymentMethodOther', e.target.value)} placeholder="Enter payment method" className="mt-3 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none" />}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
                    <div>
                      <span className="block text-xs font-semibold uppercase text-slate-600 mb-2">Preferred Contact Method <span className="text-rose-400">*</span></span>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-900">
                        {['Text Message', 'Email'].map((method) => (
                          <label key={method} className="flex items-center gap-2">
                            <input type="checkbox" checked={form.preferredContactMethod.includes(method)} onChange={() => toggleArrayField('preferredContactMethod', method)} className="h-4 w-4 rounded accent-[#006AFF]" />
                            {method}
                          </label>
                        ))}
                      </div>
                      {errors.preferredContactMethod && <p className="mt-1 text-xs text-rose-400">{errors.preferredContactMethod}</p>}
                    </div>
                    <div>
                      <span className="block text-xs font-semibold uppercase text-slate-600 mb-2">Preferred Contact Times <span className="text-rose-400">*</span></span>
                      <div className="grid gap-3 sm:grid-cols-2 text-sm text-slate-900">
                        {PREFERRED_TIMES.map((time) => (
                          <label key={time} className="flex items-center gap-2">
                            <input type="checkbox" checked={form.preferredTime.includes(time)} onChange={() => toggleArrayField('preferredTime', time)} className="h-4 w-4 rounded accent-[#006AFF]" />
                            {time}
                          </label>
                        ))}
                      </div>
                      {errors.preferredTime && <p className="mt-1 text-xs text-rose-400">{errors.preferredTime}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Additional Contact Notes</label>
                      <input type="text" value={form.preferredTimeSpecific} onChange={(e) => updateField('preferredTimeSpecific', e.target.value)} placeholder="Best after 7pm, avoid Wednesdays" className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-[#006AFF]" />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 6: REVIEW & DISCLOSURES */}
              {currentStep === 'review' && (
                <div className="space-y-6">
                  <h2 id="application-step-title" tabIndex={-1} className="text-lg sm:text-xl font-bold text-slate-900 border-b border-slate-200 pb-3">
                    Review &amp; Legal Declarations
                  </h2>

                  {/* Summary Box */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-3 text-xs sm:text-sm text-slate-600">
                    <span className="text-xs uppercase font-bold text-[#006AFF]">Application Overview</span>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div><strong className="text-slate-900">Applicant:</strong> {form.firstName} {form.lastName}</div>
                      <div><strong className="text-slate-900">Email:</strong> {form.email}</div>
                      <div><strong className="text-slate-900">Phone:</strong> {form.phone}</div>
                      <div><strong className="text-slate-900">Property:</strong> {form.propertyAddress}</div>
                      <div><strong className="text-slate-900">Income:</strong> {form.monthlyIncome}/mo</div>
                      <div><strong className="text-slate-900">Employer:</strong> {form.employerName}</div>
                    </div>
                  </div>

                  {/* Mandatory Checkboxes */}
                  <div className="space-y-4 pt-2">
                    <label className="flex items-start gap-3 text-xs sm:text-sm text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.certifyAccurate}
                        onChange={(e) => updateField('certifyAccurate', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded accent-[#006AFF]"
                      />
                      <span>
                        <strong className="text-slate-900">Accuracy Certification:</strong> I certify that all information provided in this rental application is true, correct, and complete to the best of my knowledge. Material misrepresentation is grounds for denial or lease termination.
                      </span>
                    </label>
                    {errors.certifyAccurate && <p className="text-xs text-rose-400 pl-7">{errors.certifyAccurate}</p>}

                    <label className="flex items-start gap-3 text-xs sm:text-sm text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.authorizeScreening}
                        onChange={(e) => updateField('authorizeScreening', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded accent-[#006AFF]"
                      />
                      <span>
                        <strong className="text-slate-900">Screening Authorization:</strong> I authorize Choice Properties and its designated screening agents to verify all provided information, including consumer credit reports, eviction databases, and employment verifications under the FCRA.
                      </span>
                    </label>
                    {errors.authorizeScreening && <p className="text-xs text-rose-400 pl-7">{errors.authorizeScreening}</p>}

                    <label className="flex items-start gap-3 text-xs sm:text-sm text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.acknowledgeFee}
                        onChange={(e) => updateField('acknowledgeFee', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded accent-[#006AFF]"
                      />
                      <span>
                        <strong className="text-slate-900">Application Fee Policy:</strong> I acknowledge the fixed <strong className="text-[#006AFF]">$50.00 screening fee</strong>. Nothing is charged right now upon form submission; Choice Properties will contact me to securely coordinate payment before running the review. Once payment is processed, the fee is non-refundable.
                      </span>
                    </label>
                    {errors.acknowledgeFee && <p className="text-xs text-rose-400 pl-7">{errors.acknowledgeFee}</p>}

                    <label className="flex items-start gap-3 text-xs sm:text-sm text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.agreeTermsPrivacy}
                        onChange={(e) => updateField('agreeTermsPrivacy', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded accent-[#006AFF]"
                      />
                      <span>
                        <strong className="text-slate-900">Terms &amp; Privacy:</strong> I have read and agree to the <Link to="/terms" target="_blank" className="text-[#006AFF] underline">Terms of Service</Link>, <Link to="/privacy" target="_blank" className="text-[#006AFF] underline">Privacy Policy</Link>, and <Link to="/fair-housing" target="_blank" className="text-[#006AFF] underline">Fair Housing Policy</Link>.
                      </span>
                    </label>
                    {errors.agreeTermsPrivacy && <p className="text-xs text-rose-400 pl-7">{errors.agreeTermsPrivacy}</p>}

                    <label className="flex items-start gap-3 text-xs sm:text-sm text-slate-500 cursor-pointer pt-2">
                      <input
                        type="checkbox"
                        checked={form.smsConsent}
                        onChange={(e) => updateField('smsConsent', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded accent-[#006AFF]"
                      />
                      <span>
                        (Optional) I consent to receive transactional SMS updates regarding my application review and lease coordination. Message &amp; data rates may apply. Reply STOP to cancel anytime.
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between border-t border-slate-200 pt-6">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={stepIndex === 0 || isSubmitting}
                  className="rounded-xl border border-slate-300 bg-slate-850 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
                >
                  ← Back
                </button>

                {stepIndex < STEP_ORDER.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="rounded-xl bg-[#006AFF] px-6 py-2.5 text-sm font-bold text-white shadow-lg  transition hover:bg-[#0058D6] min-h-[44px]"
                  >
                    Continue →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-7 py-3 text-sm font-bold uppercase tracking-wider text-slate-900 shadow-lg shadow-emerald-900/30 transition hover:bg-[#0058D6] disabled:opacity-50 min-h-[44px]"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
