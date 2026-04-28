import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { SiteSettingsProvider } from './contexts/SiteSettingsContext';
import LandingPage from './pages/LandingPage';
import Login from './pages/admin/Login';
import AdminLayout from './layouts/AdminLayout';
import LandingPageManager from './pages/admin/LandingPageManager';

function App() {
  return (
    <HelmetProvider>
      <SiteSettingsProvider>
        <BrowserRouter>
           <Routes>
              {/* Public Route */}
              <Route path="/" element={<LandingPage />} />

              {/* Admin Routes */}
              <Route path="/admin/login" element={<Login />} />
              <Route path="/admin" element={<AdminLayout />}>
                 <Route index element={<Navigate to="/admin/landing-page-manager" replace />} />
                 <Route path="landing-page-manager" element={<LandingPageManager />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
           </Routes>
        </BrowserRouter>
      </SiteSettingsProvider>
    </HelmetProvider>
  )
}

export default App
