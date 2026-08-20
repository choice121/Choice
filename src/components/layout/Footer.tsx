import React from 'react';
import { 
  Home, 
  ShieldCheck, 
  Mail, 
  Phone, 
  MapPin, 
  Heart, 
  Lock,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface FooterProps {
  onNavigate: (view: string, param?: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { t } = useLanguage();

  const handleNav = (view: string, param?: string) => {
    onNavigate(view, param);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const topCities = [
    { city: 'Columbus', state: 'OH' },
    { city: 'Fort Worth', state: 'TX' },
    { city: 'Kansas City', state: 'MO' },
    { city: 'Dallas', state: 'TX' },
    { city: 'Indianapolis', state: 'IN' },
    { city: 'Charlotte', state: 'NC' },
    { city: 'Atlanta', state: 'GA' },
    { city: 'Houston', state: 'TX' },
  ];

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Col 1: Brand & Values */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
                <Home className="w-5 h-5" />
              </div>
              <span className="font-bold text-lg text-white tracking-tight">Choice Properties</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              Nationwide rental property marketplace connecting qualified renters with verified houses, apartments, and townhomes. Transparent pricing, pet-friendly standards, and encrypted digital applications.
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Verified Listings</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-blue-400" />
                <span>256-Bit SSL Encrypted</span>
              </div>
            </div>
          </div>

          {/* Col 2: Marketplace */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white tracking-wider uppercase">Marketplace</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <button onClick={() => handleNav('listings')} className="hover:text-white transition-colors">
                  {t('browseListings')}
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('how-to-apply')} className="hover:text-white transition-colors">
                  {t('howToApply')}
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('faq')} className="hover:text-white transition-colors">
                  {t('faq')}
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('tenant-portal')} className="hover:text-white transition-colors">
                  {t('trackApplication')}
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('apply')} className="hover:text-white transition-colors font-medium text-blue-400">
                  {t('applyNow')} ($50)
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Popular Cities */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white tracking-wider uppercase">Top Rental Markets</h4>
            <ul className="grid grid-cols-1 gap-2 text-sm text-slate-400">
              {topCities.slice(0, 5).map((c) => (
                <li key={c.city}>
                  <button
                    onClick={() => handleNav('listings', c.city)}
                    className="hover:text-white transition-colors flex items-center gap-1"
                  >
                    <span>{c.city}, {c.state}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Trust & Policies */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white tracking-wider uppercase">Legal & Compliance</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <button onClick={() => handleNav('fair-housing')} className="hover:text-white transition-colors">
                  Fair Housing Policy
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('application-policy')} className="hover:text-white transition-colors">
                  Application & Credit Policy
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('deposit-policy')} className="hover:text-white transition-colors">
                  Holding Deposit Policy
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('privacy')} className="hover:text-white transition-colors">
                  Privacy Policy
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('terms')} className="hover:text-white transition-colors">
                  Terms of Service
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Fair Housing & Equal Opportunity Statement */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-900/40 border border-blue-700/50 flex items-center justify-center text-blue-400 flex-shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-slate-200 block">Equal Housing Opportunity</span>
              <span>We do not discriminate based on race, color, religion, sex, handicap, familial status, or national origin.</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
            <span>APP FEE: $50</span>
            <span>•</span>
            <span>PET FRIENDLY</span>
            <span>•</span>
            <span>1X DEPOSIT</span>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} Choice Properties LLC. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <a href="mailto:support@choiceproperties.com" className="hover:text-slate-300 transition-colors">
              support@choiceproperties.com
            </a>
            <span>•</span>
            <span>Phone: 707-706-3137</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
