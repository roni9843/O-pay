import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { me } from "./lib/api";
import Home from "./pages/Home";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ProtectedPage from "./pages/ProtectedPage";
import PrivateRoute from "./components/PrivateRoute";
import { useAuthStore } from "./store/authStore";
import DashboardLayout from "./layouts/DashboardLayout";
import Overview from "./pages/dashboard/Overview";
import ProfilePage from "./pages/dashboard/Profile";
import AppPage from "./pages/dashboard/AppPage";
import Payment from "./pages/dashboard/Payment";
import Subscription from "./pages/dashboard/Subscription";
import AddBalance from "./pages/dashboard/AddBalance";
import PendingBalance from "./pages/dashboard/PendingBalance";
import YourPlan from "./pages/dashboard/YourPlan";
import Device from "./pages/dashboard/Device";
import DevicesPresence from "./pages/dashboard/DevicesPresence";
import AddPaymentMethod from "./pages/dashboard/AddPaymentMethod";
import AddPaymentPage from "./pages/dashboard/AddPaymentPage";
import ApiKeyPage from "./pages/dashboard/ApiKey";
import AddSupport from "./pages/dashboard/AddSupport";
import NumberStatus from "./pages/dashboard/NumberStatus";
import PaymentMessages from "./pages/dashboard/PaymentMessages";

import CreditTopup from "./pages/dashboard/CreditTopup";
import CreditHistory from "./pages/dashboard/CreditHistory";

export default function App() {
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (token) {
      // Validate session on app mount or token change
      me(token).catch((err) => {
        console.warn("Session validation failed:", err.message);
        // The 'request' helper in lib/api.js will automatically call logout() 
        // and redirect to /login if it receives a 401 or 403 error.
      });
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-100">
      <main className=" mx-auto ">
        <Routes>
          <Route
            path="/"
            element={token ? <Navigate to="/dashboard" /> : <Home />}
          />
          <Route
            path="/protected"
            element={
              <PrivateRoute>
                <ProtectedPage />
              </PrivateRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <DashboardLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Overview />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="app" element={<AppPage />} />
            <Route path="payment" element={<Payment />} />
            <Route path="payment-messages" element={<PaymentMessages />} />
            <Route path="subscription" element={<Subscription />} />
            <Route path="your-plan" element={<YourPlan />} />
            <Route path="device" element={<Device />} />
            <Route path="devices-presence" element={<DevicesPresence />} />
            <Route path="add-balance" element={<AddBalance />} />
            <Route path="pending-balance" element={<PendingBalance />} />
            <Route path="add-payment-method" element={<AddPaymentMethod />} />
            <Route path="add-payment-page" element={<AddPaymentPage />} />
            <Route path="api-key" element={<ApiKeyPage />} />
            <Route path="add-support" element={<AddSupport />} />
            <Route path="number-status" element={<NumberStatus />} />
            <Route path="credit-topup" element={<CreditTopup />} />
            <Route path="credit-history" element={<CreditHistory />} />
          </Route>

          <Route
            path="/register"
            element={!token ? <Register /> : <Navigate to="/dashboard" />}
          />
          <Route
            path="/login"
            element={<Login />}
          />
        </Routes>
      </main>
    </div>
  );
}
