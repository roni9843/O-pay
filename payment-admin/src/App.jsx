import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import UserDetail from './pages/UserDetail'
import WalletAgents from './pages/WalletAgents'
import DeviceOnline from './pages/DeviceOnline'
import ActiveDevices from './pages/ActiveDevices'
import Payments from './pages/Payments'
import PaymentMessages from './pages/PaymentMessages'
import PendingBalances from './pages/PendingBalances'
import BalanceAdjustment from './pages/BalanceAdjustment'
import BinanceAddress from './pages/BinanceAddress'
import Devices from './pages/Devices'
import Settings from './pages/Settings'
import CreditPlans from './pages/CreditPlans'
import AgentApplications from './pages/AgentApplications'
import AgentApplicationDetail from './pages/AgentApplicationDetail'
import TopupMethods from './pages/TopupMethods'
import TopupRequests from './pages/TopupRequests'
import AddPaymentMethod from './pages/AddPaymentMethod' // Imported
import AdminStatus from './pages/AdminStatus'
import WalletAgentDetail from './pages/WalletAgentDetail'


import OpayBusiness from './pages/OpayBusiness'
import OpayBusinessDetail from './pages/OpayBusinessDetail'
import OpayBusinessHistory from './pages/OpayBusinessHistory'
import MerchantWithdraws from './pages/MerchantWithdraws'
import PaymentLinkSessions from './pages/PaymentLinkSessions'
import PrivateRoute from './components/PrivateRoute'
import AdminLayout from './layouts/AdminLayout'
import { Toaster } from 'react-hot-toast'

export default function App() {
  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<PrivateRoute><AdminLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/users/:id" element={<UserDetail />} />
        <Route path="/wallet-agents" element={<WalletAgents />} />
        <Route path="/wallet-agents/:id" element={<WalletAgentDetail />} />

        <Route path="/opay-business" element={<OpayBusiness />} />
        <Route path="/opay-business/:id" element={<OpayBusinessDetail />} />
        <Route path="/opay-business/:id/history" element={<OpayBusinessHistory />} />
        <Route path="/merchant-withdraws" element={<MerchantWithdraws />} />
        <Route path="/payment-link-sessions" element={<PaymentLinkSessions />} />
        <Route path="/device-online" element={<DeviceOnline />} />
        <Route path="/active-devices" element={<ActiveDevices />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/payment-messages" element={<PaymentMessages />} />
        <Route path="/pending-balances" element={<PendingBalances />} />
        <Route path="/balance-adjustment" element={<BalanceAdjustment />} />

        <Route path="/credit-plans" element={<CreditPlans />} />
        <Route path="/credit-topup-methods" element={<TopupMethods />} />
        <Route path="/credit-topup-requests" element={<TopupRequests />} />
        <Route path="/agent-applications" element={<AgentApplications />} />
        <Route path="/agent-applications/:id" element={<AgentApplicationDetail />} />

        <Route path="/add-payment-method" element={<AddPaymentMethod />} />


        <Route path="/binance-address" element={<BinanceAddress />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/admin-status" element={<AdminStatus />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </>
  )
}
