import { useAuthStore } from '../store/authStore'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, options)
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && !path.includes('/login')) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    const err = new Error((data && data.message) || 'API error')
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export const api = {
  get: (url, config = {}) => request(url, { method: 'GET', headers: config.headers }),
  post: (url, body, config = {}) => request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...config.headers }, body: JSON.stringify(body) }),
  patch: (url, body, config = {}) => request(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...config.headers }, body: JSON.stringify(body) }),
  put: (url, body, config = {}) => request(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...config.headers }, body: JSON.stringify(body) }),
  delete: (url, config = {}) => request(url, { method: 'DELETE', headers: config.headers }),
}

export async function login(payload) {
  // Use admin-only login endpoint
  return request('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}

export async function me(token) {
  return request('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  })
}

// Admin endpoints (stubs; implement on backend as needed)
export async function listUsers(token, params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/api/admin/users${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function createUser(token, payload) {
  return request('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
}

export async function getUser(token, id) {
  return request(`/api/admin/users/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function updateUser(token, id, payload) {
  return request(`/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
}

export async function updateSubscriptionAdmin(token, id, payload) {
  return request(`/api/subscriptions/${id}/admin`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
}

export async function addPaymentMethodAdmin(token, payload) {
  return request(`/api/payment-methods/admin/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
}

export async function getUserDevicesAdmin(token, userId) {
  return request(`/api/devices/admin/user/${userId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function getUserPaymentMethodsAdmin(token, userId) {
  return request(`/api/payment-methods/admin/user/${userId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function deletePaymentMethodAdmin(token, id) {
  return request(`/api/payment-methods/admin/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function updatePaymentMethodAdmin(token, id, payload) {
  return request(`/api/payment-methods/admin/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
}

export async function addBalance(token, id, amount, mode) {
  const payload = mode ? { amount, mode } : { amount }
  return request(`/api/admin/users/${id}/balance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
}

export async function addCredit(token, id, amount, mode) {
  const payload = mode ? { amount, mode } : { amount }
  return request(`/api/admin/users/${id}/credit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}

export async function addMinimumCredit(token, id, amount, mode) {
  const payload = mode ? { amount, mode } : { amount }
  return request(`/api/admin/users/${id}/minimum-credit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}

export async function getStats(token) {
  return request('/api/admin/stats', {
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function listDevices(token, params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/api/admin/devices${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function listDevicesOnlineStatus(token) {
  return request('/api/admin/devices/online-status', {
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function deleteDevice(token, id) {
  return request(`/api/admin/devices/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function listPayments(token, params = {}) {
  const sanitizedParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  )
  const qs = new URLSearchParams(sanitizedParams).toString()
  return request(`/api/admin/payments${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function getSubscriptionPlans() {
  return request('/api/subscription-plans')
}

export async function purchaseUserSubscription(token, userId, payload) {
  return request(`/api/admin/users/${userId}/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
}

export async function getUserSubscriptionsAdmin(token, userId) {
  return request(`/api/admin/users/${userId}/subscriptions`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function getDevicePaymentMethods(deviceCode) {
  return request('/api/payment-methods/deviceIdGetPaymentMethods/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceCode }),
  })
}

export async function getUserPaymentMethods(token, params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/api/admin/payment-methods${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function updatePaymentMethodStatus(token, id, status) {
  return request(`/api/admin/payment-methods/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  })
}
export async function uploadPaymentPageImage(token, file) {
  const formData = new FormData()
  formData.append('image', file)
  const res = await fetch(`${API_BASE}/api/uploads/payment-page-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    const err = new Error((data && data.error) || 'Image upload failed')
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export async function getWalletAgentTemplates(token) {
  return request('/api/admin/wallet-agent/templates', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function saveWalletAgentTemplate(token, payload) {
  return request('/api/admin/wallet-agent/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}

// Opay Business (brands) admin APIs
export async function listOpayBusinesses(token) {
  return request('/api/admin/opay-businesses', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function createBalanceAdjustment(token, payload) {
  return request('/api/admin/balance-adjustments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}

export async function getBalanceAdjustmentHistory(token, params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/api/admin/balance-adjustments${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function createOpayBusiness(token, payload) {
  return request('/api/admin/opay-businesses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}

export async function getOpayBusinessPaymentHistory(token, id, params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/api/admin/opay-businesses/${id}/payment-page-history${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function getOpayBusinessDashboardOverview(token, id) {
  return request(`/api/admin/opay-businesses/${id}/dashboard-overview`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function updateOpayBusiness(token, id, payload) {
  return request(`/api/admin/opay-businesses/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}

export async function regenerateOpayBusinessToken(token, id) {
  return request(`/api/admin/opay-businesses/${id}/regenerate-token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function getOpayBusiness(token, id) {
  return request(`/api/admin/opay-businesses/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

// Global Payment Sessions (Admin)
export async function getPaymentSessionsAdmin(token, params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/api/admin/payment-sessions${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

// Credit Plans
export async function getCreditPlans() {
  return request('/api/credit-plans'); // Public/Open endpoint or token optional? Added token check below if needed
}

export async function createCreditPlan(token, payload) {
  return request('/api/credit-plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
}

export async function updateCreditPlan(token, id, payload) {
  return request(`/api/credit-plans/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
}

export async function deleteCreditPlan(token, id) {
  return request(`/api/credit-plans/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

// Agent Applications
export async function getAgentApplications(token) {
  return request('/api/agent-applications', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function getAgentApplicationDetail(token, id) {
  return request(`/api/agent-applications/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function updateAgentApplicationStatus(token, id, status) {
  return request(`/api/agent-applications/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status })
  })
}

export async function deleteAgentApplication(token, id) {
  return request(`/api/agent-applications/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
}

// Credit Topup Methods
export async function getCreditTopupMethods() {
  return request('/api/credit-topup-methods')
}

// Re-writing with token argument standardization
export async function createCreditTopupMethod(token, payload) {
   return request('/api/credit-topup-methods', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
     body: JSON.stringify(payload)
   })
}

export async function deleteCreditTopupMethod(token, id) {
   return request(`/api/credit-topup-methods/${id}`, {
     method: 'DELETE',
     headers: { Authorization: `Bearer ${token}` }
   })
}

// Requests
export async function getCreditTopupRequests(token) {
   return request('/api/credit-topup-requests', {
     headers: { Authorization: `Bearer ${token}` }
   })
}

export async function updateCreditTopupRequestStatus(token, id, status, reason) {
   return request(`/api/credit-topup-requests/${id}/status`, {
     method: 'PATCH',
     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
     body: JSON.stringify({ status, rejectionReason: reason })
   })
}

// Landing Page Management
export async function getAdminFAQs(token) {
  return request('/api/landing-page/admin/faqs', {
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function createFAQ(token, payload) {
  return request('/api/landing-page/faqs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
}

export async function updateFAQ(token, id, payload) {
  return request(`/api/landing-page/faqs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
}

export async function deleteFAQ(token, id) {
  return request(`/api/landing-page/faqs/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function getLandingSettings(key) {
  // Public endpoint used by admin too for view
  return request(`/api/landing-page/settings/${key}`)
}

export async function saveLandingSetting(token, payload) {
  return request('/api/landing-page/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
}

export async function uploadLandingVideo(token, file) {
  const formData = new FormData()
  formData.append('video', file)
  const res = await fetch(`${API_BASE}/api/uploads/landing-video`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    const err = new Error((data && data.error) || 'Video upload failed')
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export async function getAllLandingSettings() {
  const res = await fetch(`${API_BASE}/api/landing-page/settings/all`)
  return res.json()
}

export async function saveBulkLandingSettings(token, settings) {
  return request('/api/landing-page/settings/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ settings })
  })
}


// Payment Partners
export async function getPaymentPartners(token) {
  return request('/api/payment-partners/admin', {
     headers: { Authorization: `Bearer ${token}` }
  })
}

export async function createPaymentPartner(token, payload) {
  return request('/api/payment-partners', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
     body: JSON.stringify(payload)
  })
}

export async function deletePaymentPartner(token, id) {
  return request(`/api/payment-partners/${id}`, {
     method: 'DELETE',
     headers: { Authorization: `Bearer ${token}` }
  })
}

export async function getMerchantWithdrawals(token) {
  return request('/api/admin/merchant-withdrawals', {
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function updateMerchantWithdrawalStatus(token, id, status, rejectReason, proofImages) {
  return request(`/api/admin/merchant-withdrawals/${id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status, rejectReason, proofImages })
  })
}

export async function uploadWithdrawalProofs(token, files) {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
    }
    const res = await fetch(`${API_BASE}/api/uploads/withdrawal-proof`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            useAuthStore.getState().logout();
            window.location.href = '/login';
        }
        const err = new Error((data && data.error) || 'Proof upload failed');
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data;
}

export async function getMerchantWithdrawalConfig(token) {
  return request('/api/admin/merchant-withdrawal-config', {
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function updateMerchantWithdrawalConfig(token, payload) {
  return request('/api/admin/merchant-withdrawal-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
}

// Notification Numbers
export async function getAdminNotificationNumbers(token) {
  return request('/api/settings/notification-numbers', {
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function setAdminNotificationNumbers(token, numbers) {
  return request('/api/settings/notification-numbers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ numbers })
  })
}

// Status Message Management
export async function getGlobalStatus(token) {
  return request('/api/admin-status/global', {
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function setGlobalStatus(token, payload) {
  return request('/api/admin-status/global', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
}

export async function setUserStatus(token, payload) {
  return request('/api/admin-status/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
}

export async function listUsersWithStatus(token) {
  return request('/api/admin-status/users-with-status', {
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function sendAlarm(token, payload) {
  return request('/api/admin-status/alarm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
}

export default {
  login, me,
  listUsers, createUser, getUser, updateUser, addBalance, addCredit, getAdminFAQs, createFAQ, updateFAQ, deleteFAQ, getLandingSettings, saveLandingSetting, uploadLandingVideo,
  getAllLandingSettings, saveBulkLandingSettings,
  getStats, listDevices, listDevicesOnlineStatus, deleteDevice, listPayments,
  getSubscriptionPlans, purchaseUserSubscription, getUserSubscriptionsAdmin,
  uploadPaymentPageImage, getWalletAgentTemplates, saveWalletAgentTemplate,
  getDevicePaymentMethods, getUserPaymentMethods, updatePaymentMethodStatus,
  listOpayBusinesses, createOpayBusiness, updateOpayBusiness, regenerateOpayBusinessToken, getOpayBusiness, getPaymentSessionsAdmin,
  getCreditPlans, createCreditPlan, updateCreditPlan, deleteCreditPlan,
  getAgentApplications, getAgentApplicationDetail, updateAgentApplicationStatus, deleteAgentApplication,
  getCreditTopupMethods, createCreditTopupMethod, deleteCreditTopupMethod,
  getCreditTopupRequests, updateCreditTopupRequestStatus, addMinimumCredit,
  getPaymentPartners, createPaymentPartner, deletePaymentPartner,
  getMerchantWithdrawals, updateMerchantWithdrawalStatus, uploadWithdrawalProofs,
  getMerchantWithdrawalConfig, updateMerchantWithdrawalConfig,
  getAdminNotificationNumbers, setAdminNotificationNumbers,
  getGlobalStatus, setGlobalStatus, setUserStatus, listUsersWithStatus
}


