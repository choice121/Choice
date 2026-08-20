import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'es';

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    browseListings: 'Browse Listings',
    browseByCity: 'Browse by City',
    howToApply: 'How to Apply',
    faq: 'FAQ',
    trackApplication: 'Track Application',
    landlordPortal: 'Landlord Portal',
    forLandlords: 'For Landlords',
    aboutUs: 'About Us',
    applyNow: 'Apply Now',
    scheduleTour: 'Schedule Tour',
    
    // Hero & Home
    heroTitle: 'Find Your Next Home Nationwide',
    heroSubtitle: 'Browse thousands of verified rental homes, apartments, and condos. Transparent pricing, pet-friendly living, and online applications.',
    searchPlaceholder: 'City, State, Zip, or Address...',
    searchBtn: 'Search Homes',
    verifiedListings: 'Verified Listings',
    standardAppFee: '$50 Application Fee',
    securityDeposit: '1x Monthly Rent Deposit',
    petFriendly: 'Pet Friendly Nationwide',
    
    // Application
    rentalApplication: 'Rental Application',
    confidentialSecure: 'CONFIDENTIAL & SECURE',
    step1Title: 'Property & Applicant',
    step2Title: 'Residency & Occupancy',
    step3Title: 'Employment & Income',
    step4Title: 'References & Emergency Contact',
    step5Title: 'Payment Preferences',
    step6Title: 'Review & Submit',
    nextStep: 'Next Step',
    previousStep: 'Back',
    submitApplication: 'Submit Application ($50 Fee)',
    saveDraft: 'Draft Autosaved',
    
    // Property Detail
    monthlyRent: 'Monthly Rent',
    bedrooms: 'Beds',
    bathrooms: 'Baths',
    squareFeet: 'Sq Ft',
    petPolicy: 'Pet Policy',
    allPetsWelcome: 'All pets welcome. Standard pet deposit applies.',
    amenities: 'Features & Amenities',
    readyToApply: 'Ready to apply for this home?',
    inquireNow: 'Send Message / Inquire',
  },
  es: {
    // Navigation
    browseListings: 'Ver Propiedades',
    browseByCity: 'Buscar por Ciudad',
    howToApply: 'Cómo Aplicar',
    faq: 'Preguntas Frecuentes',
    trackApplication: 'Seguimiento de Solicitud',
    landlordPortal: 'Portal de Propietarios',
    forLandlords: 'Para Propietarios',
    aboutUs: 'Sobre Nosotros',
    applyNow: 'Aplicar Ahora',
    scheduleTour: 'Agendar Visita',
    
    // Hero & Home
    heroTitle: 'Encuentra Tu Próximo Hogar en Todo el País',
    heroSubtitle: 'Explora miles de casas, apartamentos y condominios verificados. Precios transparentes, admisión de mascotas y solicitudes en línea.',
    searchPlaceholder: 'Ciudad, Estado, Código Postal o Dirección...',
    searchBtn: 'Buscar Hogares',
    verifiedListings: 'Listados Verificados',
    standardAppFee: 'Tarifa de Solicitud de $50',
    securityDeposit: 'Depósito de Garantía de 1 Mes',
    petFriendly: 'Aceptamos Mascotas en Todo el País',
    
    // Application
    rentalApplication: 'Solicitud de Alquiler',
    confidentialSecure: 'CONFIDENCIAL Y SEGURO',
    step1Title: 'Propiedad y Solicitante',
    step2Title: 'Residencia y Ocupación',
    step3Title: 'Empleo e Ingresos',
    step4Title: 'Referencias y Contacto de Emergencia',
    step5Title: 'Preferencias de Pago',
    step6Title: 'Revisar y Enviar',
    nextStep: 'Siguiente Paso',
    previousStep: 'Atrás',
    submitApplication: 'Enviar Solicitud (Tarifa de $50)',
    saveDraft: 'Borrador Guardado',
    
    // Property Detail
    monthlyRent: 'Alquiler Mensual',
    bedrooms: 'Habitaciones',
    bathrooms: 'Baños',
    squareFeet: 'Pies² (Sq Ft)',
    petPolicy: 'Política de Mascotas',
    allPetsWelcome: 'Todas las mascotas son bienvenidas. Aplica depósito regular.',
    amenities: 'Características y Comodidades',
    readyToApply: '¿Listo para solicitar esta propiedad?',
    inquireNow: 'Enviar Mensaje / Consultar',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('cp-lang') as Language;
      return saved === 'es' ? 'es' : 'en';
    } catch {
      return 'en';
    }
  });

  const toggleLanguage = () => {
    const next = language === 'en' ? 'es' : 'en';
    setLanguageState(next);
    localStorage.setItem('cp-lang', next);
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('cp-lang', lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
};
