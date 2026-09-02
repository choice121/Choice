import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import { PropertyDetailPage } from './pages/PropertyDetailPage'
import { ListingsPage } from './pages/ListingsPage'
import { FaqPage } from './pages/FaqPage'
import { HowToApplyPage } from './pages/HowToApplyPage'
import { HowItWorksPage } from './pages/HowItWorksPage'
import { FairHousingPage } from './pages/FairHousingPage'
import { RentalApplicationPolicyPage } from './pages/RentalApplicationPolicyPage'
import { HoldingDepositPolicyPage } from './pages/HoldingDepositPolicyPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { PoliciesPage } from './pages/PoliciesPage'
import { ApplyPage } from './pages/ApplyPage'

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ListingsPage />} />
        <Route path="/index.html" element={<ListingsPage />} />
        <Route path="/migration" element={<App />} />
        <Route path="/migration.html" element={<App />} />
        
        {/* Listings & Properties */}
        <Route path="/property" element={<PropertyDetailPage />} />
        <Route path="/property/:id" element={<PropertyDetailPage />} />
        <Route path="/property.html" element={<PropertyDetailPage />} />
        <Route path="/property-react" element={<PropertyDetailPage />} />
        <Route path="/property-react/:id" element={<PropertyDetailPage />} />
        <Route path="/property-react.html" element={<PropertyDetailPage />} />
        <Route path="/listings" element={<ListingsPage />} />
        <Route path="/listings.html" element={<ListingsPage />} />
        <Route path="/listings-react" element={<ListingsPage />} />
        <Route path="/listings-react.html" element={<ListingsPage />} />

        {/* Informational Pages */}
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/faq.html" element={<FaqPage />} />
        <Route path="/how-to-apply" element={<HowToApplyPage />} />
        <Route path="/how-to-apply.html" element={<HowToApplyPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/how-it-works.html" element={<HowItWorksPage />} />

        {/* Application Intake */}
        <Route path="/apply" element={<ApplyPage />} />
        <Route path="/apply/" element={<ApplyPage />} />
        <Route path="/apply.html" element={<ApplyPage />} />

        {/* Policies & Legal */}
        <Route path="/policies" element={<PoliciesPage />} />
        <Route path="/policies.html" element={<PoliciesPage />} />
        <Route path="/fair-housing" element={<FairHousingPage />} />
        <Route path="/fair-housing.html" element={<FairHousingPage />} />
        <Route path="/rental-application-policy" element={<RentalApplicationPolicyPage />} />
        <Route path="/rental-application-policy.html" element={<RentalApplicationPolicyPage />} />
        <Route path="/holding-deposit-policy" element={<HoldingDepositPolicyPage />} />
        <Route path="/holding-deposit-policy.html" element={<HoldingDepositPolicyPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/privacy.html" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/terms.html" element={<TermsPage />} />

        <Route path="*" element={<ListingsPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default Router
