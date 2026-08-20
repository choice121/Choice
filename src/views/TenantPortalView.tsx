import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ShieldCheck, 
  Download, 
  Key, 
  Home, 
  DollarSign,
  ChevronRight
} from 'lucide-react';
import { trackApplication } from '../lib/supabase';

export const TenantPortalView: React.FC<{ onNavigate: (view: string, param?: string) => void }> = ({ onNavigate }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [application, setApplication] = useState<any | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    const res = await trackApplication(query);
    setLoading(false);

    if (res.data) {
      setApplication(res.data);
    } else {
      setApplication(null);
      setError('No application found for this ID or email. Please check and try again.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300';
      case 'reviewing':
      case 'pending':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300';
      case 'lease_sent':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
          <FileText className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Applicant & Tenant Portal
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
          Track your rental application status, access approved lease agreements, and view move-in instructions in real time.
        </p>
      </div>

      {/* Lookup Card */}
      <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <form onSubmit={handleSearch} className="space-y-3">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Enter Application ID or Email Address
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. CP-2026-XXXX or applicant@email.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Track'}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Application Status Result Card */}
      {application && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-md space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-xs font-semibold text-slate-400 font-mono block">
                ID: {application.app_id || application.id}
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {application.applicant_name}
              </h2>
              <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Home className="w-3.5 h-3.5 text-blue-500" />
                <span>{application.property_address || 'Choice Properties Rental Listing'}</span>
              </div>
            </div>

            <div>
              <span
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider border ${getStatusColor(
                  application.status
                )}`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Status: {application.status || 'Under Review'}</span>
              </span>
            </div>
          </div>

          {/* Timeline Stages */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Application Milestones
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>1. Submitted</span>
                </div>
                <span className="text-[11px] text-slate-500 block mt-1">Application & $50 fee received</span>
              </div>

              <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4" />
                  <span>2. Screening</span>
                </div>
                <span className="text-[11px] text-slate-500 block mt-1">Background & income check</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-bold text-xs">
                  <FileText className="w-4 h-4" />
                  <span>3. Lease Signing</span>
                </div>
                <span className="text-[11px] text-slate-500 block mt-1">E-signature document issued</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-bold text-xs">
                  <Key className="w-4 h-4" />
                  <span>4. Move-In</span>
                </div>
                <span className="text-[11px] text-slate-500 block mt-1">Key exchange & inspection</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
