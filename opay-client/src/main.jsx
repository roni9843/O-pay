import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App'
import PaymentPage from './PaymentPage'
import PaymentFootprint from './PaymentFootprint'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Subdomain deployment: app lives at https://pay.oraclepay.org/:provider/:id */}
    <BrowserRouter>
      <Routes>
        <Route path="payment" element={<PaymentPage />} />
        <Route path="payment/:code/footprint" element={<PaymentFootprint />} />
        <Route path="payment/:code/mask/footprint" element={<PaymentFootprint />} />
        <Route path="payment/:code" element={<PaymentPage />} />

        <Route path=":provider/:id" element={<App />} />
        <Route path="*" element={<div className="p-6 text-center">Invalid autopay URL</div>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
