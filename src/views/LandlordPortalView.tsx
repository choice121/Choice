import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  DollarSign, 
  FileCheck, 
  TrendingUp, 
  ShieldCheck, 
  Plus, 
  ChevronRight, 
  CheckCircle, 
  Clock,
  Home
} from 'lucide-react';

export const LandlordPortalView: React.FC<{ onNavigate: (view: string, param?: string) => void }> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'applications' | 'properties'>('overview');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>Property Owner & Landlord Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Owner Portfolio Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time leasing performance, applicant screening, and direct deposit accounting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('listings')}
            className="px-4 py-2.5 rounded-xl font-semibold text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 transition-colors"
          >
            View Live Listings
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Active Listings</span>
            <Home className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">2,495</div>
          <span className="text-[11px] text-emerald-600 font-semibold">100% Verified & Live</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Pending Applications</span>
            <Users className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">18</div>
          <span className="text-[11px] text-amber-600 font-semibold">Awaiting Owner Review</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Average Rent Yield</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">$1,450</div>
          <span className="text-[11px] text-slate-500 font-medium">Market competitive standard</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Avg Lease Days</span>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">12 Days</div>
          <span className="text-[11px] text-purple-600 font-semibold">Rapid applicant placement</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'overview'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Recent Activity & Applications
        </button>
        <button
          onClick={() => setActiveTab('applications')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'applications'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Screening Queue
        </button>
      </div>

      {/* Table / Queue Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white">Recent Verified Applicants</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                <th className="pb-3 font-semibold">Applicant</th>
                <th className="pb-3 font-semibold">Property Address</th>
                <th className="pb-3 font-semibold">Income</th>
                <th className="pb-3 font-semibold">App Fee ($50)</th>
                <th className="pb-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              <tr>
                <td className="py-3.5 font-bold text-slate-900 dark:text-white">Marcus Vance</td>
                <td className="py-3.5">5804 N Meadows Blvd, Columbus, OH</td>
                <td className="py-3.5 font-semibold text-emerald-600 dark:text-emerald-400">$4,800/mo (3.8x)</td>
                <td className="py-3.5 font-bold text-emerald-600">Paid ($50)</td>
                <td className="py-3.5">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    Screening Complete
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-3.5 font-bold text-slate-900 dark:text-white">Sarah Jenkins</td>
                <td className="py-3.5">2609 Avalon Pl, Columbus, OH</td>
                <td className="py-3.5 font-semibold text-emerald-600 dark:text-emerald-400">$5,200/mo (4.4x)</td>
                <td className="py-3.5 font-bold text-emerald-600">Paid ($50)</td>
                <td className="py-3.5">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    Approved
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
