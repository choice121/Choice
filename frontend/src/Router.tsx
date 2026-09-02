import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import { PropertyDetailPage } from './pages/PropertyDetailPage'
import { ListingsPage } from './pages/ListingsPage'

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/index.html" element={<App />} />
        <Route path="/property" element={<PropertyDetailPage />} />
        <Route path="/property.html" element={<PropertyDetailPage />} />
        <Route path="/property-react.html" element={<PropertyDetailPage />} />
        <Route path="/listings" element={<ListingsPage />} />
        <Route path="/listings.html" element={<ListingsPage />} />
        <Route path="/listings-react.html" element={<ListingsPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default Router
