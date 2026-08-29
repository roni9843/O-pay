import { useAuthStore } from '../store/authStore';

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Handle session expiration (401 Unauthorized / 403 Forbidden)
    if ((res.status === 401 || res.status === 403) && !path.includes('/login')) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    const err = new Error((data && data.message) || "API error");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function register(payload) {
  return request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function sendOtp(payload) {
  return request("/api/auth/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function verifyOtpAndRegister(payload) {
  return request("/api/auth/verify-otp-and-register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function login(payload) {
  return request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function me(token) {
  return request("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getSubscriptionPlans() {
  return request("/api/subscription-plans");
}

export async function addBalance(amount, token) {
  return request("/api/users/add-balance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ amount }),
  });
}

export async function purchaseSubscription(token, payload) {
  return request("/api/subscriptions/purchase", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function getMySubscriptions(token) {
  return request("/api/subscriptions/my", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// Subscription API key helpers
export async function getSubscriptionApiKey(token, subId) {
  return request(`/api/subscriptions/${subId}/api-key`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getMyDevices(token) {
  return request('/api/devices', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function generateSubscriptionApiKey(token, subId, callbackUrl) {
  return request(`/api/subscriptions/${subId}/api-key/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(callbackUrl ? { callbackUrl } : {})
  });
}

export async function toggleSubscriptionApiKey(token, subId, active) {
  return request(`/api/subscriptions/${subId}/api-key/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ active })
  });
}

export async function revokeSubscriptionApiKey(token, subId) {
  return request(`/api/subscriptions/${subId}/api-key`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateSubscriptionCallbackUrl(token, subId, callbackUrl) {
  return request(`/api/subscriptions/${subId}/api-key/callback`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ callbackUrl })
  });
}

// Profile APIs
export async function updateProfile(token, payload) {
  return request('/api/users/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
}

export async function updateSupportNumber(token, supportNumber) {
  return updateProfile(token, { supportNumber });
}

export async function changePassword(token, payload) {
  return request('/api/users/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
}

export async function getDashboardOverview(token) {
  return request('/api/dashboard/overview', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function getPaymentMessages(token, params = {}) {
  const search = new URLSearchParams(params).toString();
  return request(`/api/dashboard/payment-messages${search ? `?${search}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function getPayments(token, params = {}) {
  const search = new URLSearchParams(params).toString();
  return request(`/api/dashboard/payments${search ? `?${search}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

// Generic HTTP methods
export async function get(path, token) {
  return request(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function post(path, data, token) {
  return request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });
}

export async function del(path, token) {
  return request(path, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}
export async function getMyPaymentMethods(token) {
  return get("/api/payment-methods", token);
}

export async function getPaymentMethodPages(token) {
  return get("/api/payment-method-page-content", token);
}

export async function createPaymentMethodPage(token, data) {
  return post("/api/payment-method-page-content", data, token);
}
export async function updatePaymentMethodPage(token, id, data) {
  return request(`/api/payment-method-page-content/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export async function deletePaymentMethodPage(token, id) {
  return request(`/api/payment-method-page-content/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
export async function togglePaymentMethodStatus(token, id, status) {
  return request(`/api/payment-methods/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
}
// Upload payment page image
export async function uploadPaymentPageImage(token, file) {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`${API_BASE}/api/uploads/payment-page-image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403)) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    const err = new Error((data && data.error) || 'Image upload failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data; // { success, url }
}
export async function verifyOtp(path, data, token) {
  return request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export async function getCreditPlans(token) {
  return get("/api/credit-plans?active=true", token);
}

// TOPUP FUNCTIONS
export async function getCreditTopupMethods(token) {
  return get("/api/credit-topup-methods?active=true", token);
}

export async function getMyCreditTopupRequests(token) {
  return get("/api/credit-topup-requests/my", token);
}

export async function submitCreditTopupRequest(token, payload) {
  // payload: { planId, methodId, methodName, submissionData }
  return post("/api/credit-topup-requests", payload, token);
}

// AUTO WITHDRAWAL FUNCTIONS
export async function getPendingAutoWithdrawals(token) {
  return request("/api/auto-withdrawal/pending", {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function bookAutoWithdrawal(token, id) {
  return request(`/api/auto-withdrawal/${id}/book`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function rejectAutoWithdrawal(token, id, reason) {
  return request(`/api/auto-withdrawal/${id}/reject`, {
    method: "POST",
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason })
  });
}

export async function getAutoWithdrawalHistory(token) {
  return request("/api/auto-withdrawal/history", {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function getAutoWithdrawalStats(token) {
  return request("/api/auto-withdrawal/stats", {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function completeAutoWithdrawal(token, id, proofImages) {
  const formData = new FormData();
  if (proofImages && proofImages.length > 0) {
    proofImages.forEach(file => {
      formData.append("proofs", file);
    });
  }
  return request(`/api/auto-withdrawal/${id}/complete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
}

// NAGAD FUNCTIONS
export async function getAgentPendingNagad(token) {
  return request("/api/dashboard/pending-nagad", {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function acceptPendingNagad(token, code) {
  return request("/api/dashboard/pending-nagad/accept", {
    method: "POST",
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code })
  });
}

export async function rejectPendingNagad(token, code) {
  return request("/api/dashboard/pending-nagad/reject", {
    method: "POST",
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code })
  });
}


export async function getSupportedBanks() {
  return request('/api/opay-business/supported-banks');
}

export async function getAgentBankAccounts(token) {
  return request('/api/dashboard/bank-accounts', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function addAgentBankAccount(token, payload) {
  return request('/api/dashboard/bank-accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
}

export async function deleteAgentBankAccount(token, id) {
  return request(`/api/dashboard/bank-accounts/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function getAgentPendingBankPayments(token) {
  return request('/api/dashboard/pending-bank-payments', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function acceptPendingBankPayment(token, code) {
  return request('/api/dashboard/pending-bank-payments/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code })
  });
}

export async function rejectPendingBankPayment(token, code) {
  return request('/api/dashboard/pending-bank-payments/reject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code })
  });
}

export default {
  login,
  me,
  register,
  getMyDevices,
  getSubscriptionApiKey,
  generateSubscriptionApiKey,
  toggleSubscriptionApiKey,
  revokeSubscriptionApiKey,
  updateSubscriptionCallbackUrl,
  updateProfile,
  updateSupportNumber,
  changePassword,
  getDashboardOverview,
  getPayments,
  getPaymentMessages,
  get,
  post,
  delete: del,
  getMyPaymentMethods,
  getPaymentMethodPages,
  createPaymentMethodPage,
  updatePaymentMethodPage,
  deletePaymentMethodPage,
  togglePaymentMethodStatus,
  uploadPaymentPageImage,
  getCreditTopupMethods,
  submitCreditTopupRequest,
  getMyCreditTopupRequests,
  getPendingAutoWithdrawals,
  bookAutoWithdrawal,
  rejectAutoWithdrawal,
  getAutoWithdrawalHistory,
  completeAutoWithdrawal,
  getAgentPendingNagad,
  acceptPendingNagad,
  rejectPendingNagad,
  getAgentBankAccounts,
  getSupportedBanks,
  addAgentBankAccount,
  deleteAgentBankAccount,
  getAgentPendingBankPayments,
  acceptPendingBankPayment,
  rejectPendingBankPayment
};
