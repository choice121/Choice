import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Search, 
  MapPin, 
  HelpCircle, 
  FileText, 
  UserCheck, 
  Moon, 
  Sun, 
  Menu, 
  X, 
  Globe, 
  Shield, 
  Building2, 
  Info,
  ChevronRight,
  PhoneCall,
  Sparkles
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string, param?: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [drawerOpen]);

  const handleNav = (view: string, param?: string) => {
    setDrawerOpen(false);
    onNavigate(view, param);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-200 ${
          scrolled
            ? 'bg-white/90 dark:bg-slate-950/90 backdrop-blur-md shadow-xs border-b border-slate-200/80 dark:border-slate-800/80'
            : 'bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-900'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between">
          {/* Logo & Brand */}
          <button
            onClick={() => handleNav('home')}
            className="flex items-center gap-2.5 sm:gap-3 group text-left focus:outline-none"
            aria-label="Choice Properties Home"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 dark:bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6">
                <path d="M3 9.5L12 3L21 9.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V9.5Z" fill="currentColor" fillOpacity="0.9" />
                <circle cx="12" cy="11" r="2.5" fill="#006aff" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                Choice Properties
              </span>
              <span className="block text-[11px] font-medium text-slate-700 dark:text-slate-200 tracking-wider uppercase">
                Rental Marketplace
              </span>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            <button
              onClick={() => handleNav('listings')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'listings'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50'
                  : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              {t('browseListings')}
            </button>

            <button
              onClick={() => handleNav('how-to-apply')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'how-to-apply'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50'
                  : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              {t('howToApply')}
            </button>

            <button
              onClick={() => handleNav('faq')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'faq'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50'
                  : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              {t('faq')}
            </button>

            <button
              onClick={() => handleNav('tenant-portal')}
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-emerald-500" />
              <span>{t('trackApplication')}</span>
            </button>

            <button
              onClick={() => handleNav('landlord-portal')}
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 flex items-center gap-1.5"
            >
              <UserCheck className="w-4 h-4 text-blue-500" />
              <span>{t('landlordPortal')}</span>
            </button>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
              title="Switch Language (English / Español)"
              aria-label="Switch Language"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{language === 'en' ? 'ES' : 'EN'}</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Dark Mode"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* Apply Button CTA */}
            <button
              onClick={() => handleNav('apply')}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md transition-all active:scale-95"
            >
              <span>{t('applyNow')}</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
              aria-label="Open Mobile Menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs md:hidden transition-opacity"
        />
      )}

      {/* Mobile Sliding Navigation Drawer */}
      <aside
        className={`fixed top-0 right-0 bottom-0 z-50 w-80 max-w-[85vw] bg-white dark:bg-slate-950 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 md:hidden ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Home className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">Choice Properties</div>
              <div className="text-[10px] text-slate-700 dark:text-slate-200">Nationwide Rentals</div>
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-1.5 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Links */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <button
            onClick={() => handleNav('listings')}
            className="w-full flex items-center justify-between p-3 rounded-xl text-left text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Home className="w-4 h-4 text-blue-600" />
              <span>{t('browseListings')}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>

          <button
            onClick={() => handleNav('how-to-apply')}
            className="w-full flex items-center justify-between p-3 rounded-xl text-left text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="w-4 h-4 text-emerald-500" />
              <span>{t('howToApply')}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>

          <button
            onClick={() => handleNav('faq')}
            className="w-full flex items-center justify-between p-3 rounded-xl text-left text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Info className="w-4 h-4 text-indigo-500" />
              <span>{t('faq')}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>

          <button
            onClick={() => handleNav('tenant-portal')}
            className="w-full flex items-center justify-between p-3 rounded-xl text-left text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-amber-500" />
              <span>{t('trackApplication')}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>

          <button
            onClick={() => handleNav('landlord-portal')}
            className="w-full flex items-center justify-between p-3 rounded-xl text-left text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          >
            <div className="flex items-center gap-3">
              <UserCheck className="w-4 h-4 text-blue-500" />
              <span>{t('landlordPortal')}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>

          <button
            onClick={() => handleNav('admin-pipeline')}
            className="w-full flex items-center justify-between p-3 rounded-xl text-left text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span>Admin Orion Pipeline</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-900">
            <button
              onClick={() => handleNav('about')}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-left text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              <Building2 className="w-4 h-4" />
              <span>{t('aboutUs')}</span>
            </button>
            <button
              onClick={() => handleNav('fair-housing')}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-left text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              <Shield className="w-4 h-4" />
              <span>Fair Housing Act</span>
            </button>
          </div>
        </div>

        {/* Drawer Footer CTA */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-900 space-y-2 bg-slate-50 dark:bg-slate-900/50">
          <button
            onClick={() => handleNav('apply')}
            className="w-full py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center justify-center gap-2"
          >
            <span>{t('applyNow')} ($50 Fee)</span>
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="text-center">
            <a
              href="mailto:support@choiceproperties.com"
              className="text-xs text-slate-600 dark:text-slate-400 hover:underline"
            >
              support@choiceproperties.com
            </a>
          </div>
        </div>
      </aside>
    </>
  );
};
