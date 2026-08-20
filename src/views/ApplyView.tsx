import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  ShieldCheck, 
  Lock, 
  AlertCircle, 
  ChevronRight, 
  ChevronLeft, 
  Upload, 
  DollarSign, 
  PawPrint, 
  UserCheck, 
  FileText, 
  Copy, 
  Check, 
  RotateCcw,
  Sparkles,
  Building,
  Home
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Property, RentalApplication } from '../types';
import { getPropertyById, submitRentalApplication } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

interface ApplyViewProps {
  propertyId?: string;
  onNavigate: (view: string, param?: string) => void;
}

export const ApplyView: React.FC<ApplyViewProps> = ({ propertyId, onNavigate }) => {
  const { language, t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [loadingProperty, setLoadingProperty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedAppId, setSubmittedAppId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<RentalApplication>({
    property_id: propertyId || '',
    property_address: '',
    monthly_rent: 0,
    applicant_name: '',
    email: '',
    phone: '',
    dob: '',
    ssn: '',
    id_type: 'Driver License',
    id_number: '',
    id_state: '',
    current_address: '',
    current_city: '',
    current_state: '',
    current_zip: '',
    current_rent: 0,
    residence_duration_years: 1,
    landlord_name: '',
    landlord_phone: '',
    reason_for_moving: '',
    employment_status: 'Employed Full-Time',
    employer_name: '',
    job_title: '',
    monthly_income: 0,
    supervisor_name: '',
    supervisor_phone: '',
    additional_income: 0,
    additional_income_source: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
    pets: [],
    vehicles: [],
    co_applicants: [],
    payment_preference: 'Debit / Credit Card',
    signature_data: '',
    agreed_to_terms: false,
  });

  const [hasPets, setHasPets] = useState(false);
  const [petType, setPetType] = useState('Dog');
  const [petBreed, setPetBreed] = useState('');
  const [hasCoApplicant, setHasCoApplicant] = useState(false);
  const [coName, setCoName] = useState('');
  const [coEmail, setCoEmail] = useState('');
  const [coPhone, setCoPhone] = useState('');

  // Signature canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureType, setSignatureType] = useState<'draw' | 'type'>('type');
  const [typedSignature, setTypedSignature] = useState('');

  // Load property if propertyId is provided
  useEffect(() => {
    if (propertyId) {
      setLoadingProperty(true);
      getPropertyById(propertyId).then((res) => {
        if (res.data) {
          setSelectedProperty(res.data);
          setFormData((prev) => ({
            ...prev,
            property_id: res.data!.id,
            property_address: `${res.data!.address}, ${res.data!.city}, ${res.data!.state} ${res.data!.zip}`,
            monthly_rent: res.data!.rent,
          }));
        }
        setLoadingProperty(false);
      });
    }
  }, [propertyId]);

  // Load saved draft
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cp_apply_draft');
      if (saved && !propertyId) {
        const parsed = JSON.parse(saved);
        setFormData((prev) => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.warn(e);
    }
  }, []);

  // Autosave draft
  useEffect(() => {
    if (!submittedAppId) {
      localStorage.setItem('cp_apply_draft', JSON.stringify(formData));
    }
  }, [formData, submittedAppId]);

  const updateField = (field: keyof RentalApplication, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrorMessage(null);
  };

  // Drawing canvas logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#006aff';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing && canvasRef.current) {
      setIsDrawing(false);
      updateField('signature_data', canvasRef.current.toDataURL());
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateField('signature_data', '');
  };

  // Validate step before progressing
  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!formData.applicant_name.trim()) {
        setErrorMessage('Please enter your full legal name.');
        return false;
      }
      if (!formData.email.trim() || !formData.email.includes('@')) {
        setErrorMessage('Please enter a valid email address.');
        return false;
      }
      if (!formData.phone.trim()) {
        setErrorMessage('Please enter your phone number.');
        return false;
      }
    }
    if (step === 2) {
      if (!formData.current_address.trim()) {
        setErrorMessage('Please provide your current street address.');
        return false;
      }
    }
    if (step === 3) {
      if (!formData.employer_name.trim() && formData.employment_status !== 'Retired') {
        setErrorMessage('Please enter your employer name.');
        return false;
      }
      if (!formData.monthly_income || Number(formData.monthly_income) <= 0) {
        setErrorMessage('Please enter your estimated monthly gross income.');
        return false;
      }
    }
    if (step === 4) {
      if (!formData.emergency_contact_name.trim() || !formData.emergency_contact_phone.trim()) {
        setErrorMessage('Please provide an emergency contact name and phone number.');
        return false;
      }
    }
    if (step === 6) {
      if (!formData.agreed_to_terms) {
        setErrorMessage('You must review and agree to the screening authorization terms.');
        return false;
      }
      if (signatureType === 'type' && !typedSignature.trim()) {
        setErrorMessage('Please type your full legal name as your digital signature.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setErrorMessage(null);
      setCurrentStep((prev) => Math.min(prev + 1, 6));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setErrorMessage(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(6)) return;

    setSubmitting(true);
    setErrorMessage(null);

    const submission: RentalApplication = {
      ...formData,
      signature_data: signatureType === 'type' ? typedSignature : formData.signature_data,
      pets: hasPets ? [{ type: petType, breed: petBreed || 'Domestic', weight: '20' }] : [],
      co_applicants: hasCoApplicant && coName ? [{ name: coName, email: coEmail, phone: coPhone, relationship: 'Co-Applicant' }] : [],
    };

    const res = await submitRentalApplication(submission);
    setSubmitting(false);

    if (res.ok && res.appId) {
      setSubmittedAppId(res.appId);
      localStorage.removeItem('cp_apply_draft');
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        console.warn(e);
      }
    } else {
      setErrorMessage(res.error || 'Failed to submit application. Please try again.');
    }
  };

  const copyAppId = () => {
    if (submittedAppId) {
      navigator.clipboard.writeText(submittedAppId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // Success Confirmation Screen
  if (submittedAppId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Application Received
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Your Application Has Been Submitted!
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Thank you, <strong>{formData.applicant_name}</strong>. Your application for <strong>{formData.property_address || 'Rental Property'}</strong> is now being processed by our leasing team.
          </p>
        </div>

        {/* Application ID Card */}
        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-md mx-auto space-y-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Your Tracking Application ID
          </span>
          <div className="flex items-center justify-between gap-2 p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400">
            <span>{submittedAppId}</span>
            <button
              onClick={copyAppId}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Copy Application ID"
            >
              {copiedId ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            <span>Standard $50 Application Fee Confirmation Logged</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => onNavigate('tenant-portal')}
            className="px-6 py-3 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all"
          >
            Track Application Status
          </button>
          <button
            onClick={() => onNavigate('listings')}
            className="px-5 py-3 rounded-xl font-semibold text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200"
          >
            Return to Marketplace
          </button>
        </div>
      </div>
    );
  }

  const stepTitles = [
    'Property & Applicant',
    'Residency & History',
    'Employment & Income',
    'Emergency & References',
    'Payment & Terms',
    'Sign & Submit',
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>{t('confidentialSecure')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            {t('rentalApplication')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Step {currentStep} of 6 — {stepTitles[currentStep - 1]}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            $50 Standard Application Fee
          </span>
        </div>
      </div>

      {/* Step Indicator Progress Bar */}
      <div className="grid grid-cols-6 gap-2">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <div
            key={s}
            onClick={() => {
              if (s < currentStep) setCurrentStep(s);
            }}
            className={`h-2.5 rounded-full transition-all cursor-pointer ${
              s === currentStep
                ? 'bg-blue-600 ring-2 ring-blue-400/50'
                : s < currentStep
                ? 'bg-emerald-500'
                : 'bg-slate-200 dark:bg-slate-800'
            }`}
            title={`Step ${s}: ${stepTitles[s - 1]}`}
          />
        ))}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-600 dark:text-rose-300 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Selected Property Preview Pill */}
      {formData.property_address && (
        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
              <Home className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 block">Applying For Property:</span>
              <span className="font-bold text-sm text-slate-900 dark:text-white truncate block max-w-sm sm:max-w-md">
                {formData.property_address}
              </span>
            </div>
          </div>
          {formData.monthly_rent > 0 && (
            <div className="text-right flex-shrink-0">
              <span className="text-xs text-slate-500 block">Monthly Rent</span>
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                ${formData.monthly_rent?.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Step Forms */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6">
        {/* STEP 1: Applicant Information */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Primary Applicant Details</h2>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Property Address Applying For *
              </label>
              <input
                type="text"
                value={formData.property_address}
                onChange={(e) => updateField('property_address', e.target.value)}
                placeholder="e.g. 5804 N Meadows Blvd, Columbus, OH 43229"
                className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.applicant_name}
                  onChange={(e) => updateField('applicant_name', e.target.value)}
                  placeholder="First Middle Last"
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="(555) 000-0000"
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={formData.dob || ''}
                  onChange={(e) => updateField('dob', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  SSN / ITIN (Last 4 or Full)
                </label>
                <input
                  type="password"
                  value={formData.ssn || ''}
                  onChange={(e) => updateField('ssn', e.target.value)}
                  placeholder="XXX-XX-XXXX"
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ID Type</label>
                <select
                  value={formData.id_type}
                  onChange={(e) => updateField('id_type', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option>Driver License</option>
                  <option>State ID</option>
                  <option>Passport</option>
                  <option>Military ID</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ID Number</label>
                <input
                  type="text"
                  value={formData.id_number || ''}
                  onChange={(e) => updateField('id_number', e.target.value)}
                  placeholder="D12345678"
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Issuing State</label>
                <input
                  type="text"
                  value={formData.id_state || ''}
                  onChange={(e) => updateField('id_state', e.target.value)}
                  placeholder="OH, TX, MO..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Residency History & Pets */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Current Residence & Occupancy</h2>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Current Street Address *
              </label>
              <input
                type="text"
                required
                value={formData.current_address}
                onChange={(e) => updateField('current_address', e.target.value)}
                placeholder="123 Main St, Apt 4B"
                className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">City</label>
                <input
                  type="text"
                  value={formData.current_city || ''}
                  onChange={(e) => updateField('current_city', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">State</label>
                <input
                  type="text"
                  value={formData.current_state || ''}
                  onChange={(e) => updateField('current_state', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ZIP Code</label>
                <input
                  type="text"
                  value={formData.current_zip || ''}
                  onChange={(e) => updateField('current_zip', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Current Monthly Rent ($)</label>
                <input
                  type="number"
                  value={formData.current_rent || ''}
                  onChange={(e) => updateField('current_rent', Number(e.target.value))}
                  placeholder="1200"
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Duration at Residence (Years)</label>
                <input
                  type="number"
                  value={formData.residence_duration_years || 1}
                  onChange={(e) => updateField('residence_duration_years', Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Pets Checkbox */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasPets}
                  onChange={(e) => setHasPets(e.target.checked)}
                  className="w-4 h-4 rounded-md text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <PawPrint className="w-4 h-4 text-emerald-500" />
                  <span>I will be bringing pets (Choice Properties is Pet-Friendly)</span>
                </span>
              </label>

              {hasPets && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Pet Type</label>
                    <select
                      value={petType}
                      onChange={(e) => setPetType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                    >
                      <option>Dog</option>
                      <option>Cat</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Breed & Weight</label>
                    <input
                      type="text"
                      value={petBreed}
                      onChange={(e) => setPetBreed(e.target.value)}
                      placeholder="e.g. Golden Retriever (45 lbs)"
                      className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Employment & Income */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Employment & Monthly Income</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Employment Status</label>
                <select
                  value={formData.employment_status}
                  onChange={(e) => updateField('employment_status', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option>Employed Full-Time</option>
                  <option>Employed Part-Time</option>
                  <option>Self-Employed / Freelance</option>
                  <option>Retired</option>
                  <option>Student</option>
                  <option>Other / Unemployed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Employer / Company Name *</label>
                <input
                  type="text"
                  required
                  value={formData.employer_name}
                  onChange={(e) => updateField('employer_name', e.target.value)}
                  placeholder="Company Inc."
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Job Title / Position</label>
                <input
                  type="text"
                  value={formData.job_title || ''}
                  onChange={(e) => updateField('job_title', e.target.value)}
                  placeholder="Software Engineer, Nurse, Manager..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Gross Monthly Income ($) *
                </label>
                <input
                  type="number"
                  required
                  value={formData.monthly_income || ''}
                  onChange={(e) => updateField('monthly_income', Number(e.target.value))}
                  placeholder="e.g. 4500"
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Supervisor / HR Contact Name</label>
                <input
                  type="text"
                  value={formData.supervisor_name || ''}
                  onChange={(e) => updateField('supervisor_name', e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Supervisor / HR Phone Number</label>
                <input
                  type="tel"
                  value={formData.supervisor_phone || ''}
                  onChange={(e) => updateField('supervisor_phone', e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Emergency Contact & References */}
        {currentStep === 4 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Emergency Contact & Reference</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Emergency Contact Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.emergency_contact_name}
                  onChange={(e) => updateField('emergency_contact_name', e.target.value)}
                  placeholder="Full Name"
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Emergency Contact Phone *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.emergency_contact_phone}
                  onChange={(e) => updateField('emergency_contact_phone', e.target.value)}
                  placeholder="(555) 999-0000"
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Relationship
                </label>
                <input
                  type="text"
                  value={formData.emergency_contact_relationship || ''}
                  onChange={(e) => updateField('emergency_contact_relationship', e.target.value)}
                  placeholder="Parent, Sibling, Friend..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Payment & Transparency */}
        {currentStep === 5 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Fee Disclosure & Payment Method</h2>

            {/* Breakdown Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between text-sm pb-2 border-b border-slate-200 dark:border-slate-700">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Application Screening Fee</span>
                <span className="font-bold text-slate-900 dark:text-white">$50.00</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Security Deposit (Due upon lease approval)</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  ${formData.monthly_rent > 0 ? formData.monthly_rent.toLocaleString() : '1x Rent'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                The non-refundable $50 application fee covers identity verification, nationwide credit reporting, background checks, and prior eviction history screening.
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Preferred Fee Payment Method
              </label>
              <select
                value={formData.payment_preference}
                onChange={(e) => updateField('payment_preference', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
              >
                <option>Debit / Credit Card (Instant Online)</option>
                <option>ACH Electronic Bank Transfer</option>
                <option>Venmo / Zelle Secure Transfer</option>
              </select>
            </div>
          </div>
        )}

        {/* STEP 6: Review & Digital Signature */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Review & Digital Signature</h2>

            {/* Summary card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Applicant:</span>
                <span className="font-bold text-slate-900 dark:text-white">{formData.applicant_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Email & Phone:</span>
                <span className="font-medium text-slate-900 dark:text-white">{formData.email} • {formData.phone}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Target Listing:</span>
                <span className="font-medium text-slate-900 dark:text-white">{formData.property_address || 'Choice Properties Rental'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Application Fee:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">$50.00 Fixed</span>
              </div>
            </div>

            {/* Signature Switcher */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Applicant E-Signature *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSignatureType('type')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      signatureType === 'type'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                    }`}
                  >
                    Type Name
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignatureType('draw')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      signatureType === 'draw'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                    }`}
                  >
                    Draw Signature
                  </button>
                </div>
              </div>

              {signatureType === 'type' ? (
                <div>
                  <input
                    type="text"
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                    placeholder="Type your full legal name here"
                    className="w-full px-4 py-3 rounded-xl text-lg font-serif italic bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Typing your name acts as your legally binding digital signature under the E-SIGN Act.
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="border border-slate-300 dark:border-slate-700 rounded-xl bg-white overflow-hidden">
                    <canvas
                      ref={canvasRef}
                      width={500}
                      height={120}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-28 touch-none cursor-crosshair"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-xs text-rose-500 hover:underline font-semibold"
                    >
                      Clear Signature
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Agreement Checkbox */}
            <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={formData.agreed_to_terms}
                  onChange={(e) => updateField('agreed_to_terms', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded-md text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  I certify that all statements in this application are true and complete. I authorize Choice Properties and its representatives to conduct background checks, credit checks, employment verification, and landlord references.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Step Actions Footer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {currentStep < 6 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all flex items-center gap-1.5 active:scale-95"
            >
              <span>Continue</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 rounded-xl text-sm font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{submitting ? 'Submitting Application...' : 'Submit Application ($50 Fee)'}</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
