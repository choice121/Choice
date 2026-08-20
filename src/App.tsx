import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { HomeView } from './views/HomeView';
import { ListingsView } from './views/ListingsView';
import { PropertyDetailView } from './views/PropertyDetailView';
import { ApplyView } from './views/ApplyView';
import { TenantPortalView } from './views/TenantPortalView';
import { LandlordPortalView } from './views/LandlordPortalView';
import { AdminPipelineView } from './views/AdminPipelineView';
import { LegalStaticView } from './views/LegalStaticView';

export default function App() {
  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | undefined>(undefined);
  const [searchParam, setSearchParam] = useState<string | undefined>(undefined);

  // Sync with browser URL / query parameters
  useEffect(() => {
    const parseUrl = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const path = window.location.pathname;

      const view = urlParams.get('view');
      const id = urlParams.get('id') || urlParams.get('property_id');
      const query = urlParams.get('q') || urlParams.get('city') || urlParams.get('search');

      if (id) {
        setSelectedPropertyId(id);
        if (path.includes('apply') || view === 'apply') {
          setCurrentView('apply');
        } else {
          setCurrentView('property');
        }
        return;
      }

      if (path.includes('apply') || view === 'apply') {
        setCurrentView('apply');
      } else if (path.includes('listings') || path.includes('properties') || view === 'listings') {
        setCurrentView('listings');
        if (query) setSearchParam(query);
      } else if (path.includes('tenant') || view === 'tenant-portal') {
        setCurrentView('tenant-portal');
      } else if (path.includes('landlord') || view === 'landlord-portal') {
        setCurrentView('landlord-portal');
      } else if (path.includes('pipeline') || view === 'pipeline') {
        setCurrentView('pipeline');
      } else if (['how-to-apply', 'faq', 'fair-housing', 'application-policy', 'deposit-policy', 'privacy', 'terms'].includes(view || '')) {
        setCurrentView(view!);
      } else {
        setCurrentView('home');
      }
    };

    parseUrl();
    window.addEventListener('popstate', parseUrl);
    return () => window.removeEventListener('popstate', parseUrl);
  }, []);

  const handleNavigate = (view: string, param?: string) => {
    setCurrentView(view);
    if (view === 'property' && param) {
      setSelectedPropertyId(param);
      window.history.pushState({}, '', `?view=property&id=${param}`);
    } else if (view === 'apply') {
      if (param) {
        setSelectedPropertyId(param);
        window.history.pushState({}, '', `?view=apply&id=${param}`);
      } else {
        window.history.pushState({}, '', `?view=apply`);
      }
    } else if (view === 'listings') {
      setSearchParam(param);
      window.history.pushState({}, '', param ? `?view=listings&q=${encodeURIComponent(param)}` : `?view=listings`);
    } else {
      window.history.pushState({}, '', `?view=${view}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectProperty = (id: string) => {
    setSelectedPropertyId(id);
    handleNavigate('property', id);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Navbar */}
      <Navbar currentView={currentView} onNavigate={handleNavigate} />

      {/* Main View Router Stage */}
      <main className="flex-1">
        {currentView === 'home' && (
          <HomeView
            onNavigate={handleNavigate}
            onSelectProperty={handleSelectProperty}
          />
        )}

        {currentView === 'listings' && (
          <ListingsView
            initialSearch={searchParam}
            onSelectProperty={handleSelectProperty}
            onApply={(id) => handleNavigate('apply', id)}
          />
        )}

        {currentView === 'property' && selectedPropertyId && (
          <PropertyDetailView
            propertyId={selectedPropertyId}
            onBack={() => handleNavigate('listings')}
            onApply={(id) => handleNavigate('apply', id)}
          />
        )}

        {currentView === 'apply' && (
          <ApplyView
            propertyId={selectedPropertyId}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'tenant-portal' && (
          <TenantPortalView onNavigate={handleNavigate} />
        )}

        {currentView === 'landlord-portal' && (
          <LandlordPortalView onNavigate={handleNavigate} />
        )}

        {currentView === 'pipeline' && (
          <AdminPipelineView />
        )}

        {[
          'how-to-apply',
          'faq',
          'fair-housing',
          'application-policy',
          'deposit-policy',
          'privacy',
          'terms',
        ].includes(currentView) && (
          <LegalStaticView type={currentView} onNavigate={handleNavigate} />
        )}
      </main>

      {/* Modern Footer */}
      <Footer onNavigate={handleNavigate} />
    </div>
  );
}
