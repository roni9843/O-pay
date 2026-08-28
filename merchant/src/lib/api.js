import axios from 'axios'
import { useAuthStore } from '../store/authStore'

// Base API URL comes from Vite env (see .env file)
// Fallback keeps local dev working if env is missing
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

export const api = axios.create({
  baseURL: API_BASE,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 Unauthorized or 403 Forbidden means session (token) expired or is invalid
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.warn('Session expired or unauthorized. Logging out...')
      useAuthStore.getState().logout()
      window.location.href = '/login'; // Redirect to login
    }
    return Promise.reject(error)
  }
)

export async function login(email, password) {
  const res = await api.post('/opay-business/auth/login', { email, password })
  return res.data
}

export async function register(payload) {
  const res = await api.post('/opay-business/auth/register', payload)
  return res.data
}

export async function getMe() {
  const res = await api.get('/opay-business/auth/me')
  return res.data
}

export async function getPaymentPageHistory(params = {}) {
  const res = await api.get('/opay-business/payment-page-history', { params })
  return res.data
}

export async function deletePaymentPageHistory(code) {
  const res = await api.delete(`/opay-business/payment-page-history/${code}`)
  return res.data
}

export async function expirePaymentPageHistory(code) {
  const res = await api.post(`/opay-business/payment-page-history/${code}/expire`)
  return res.data
}

export async function getDashboardOverview(params = {}) {
  const res = await api.get('/opay-business/dashboard-overview', { params })
  return res.data
}

export async function fetchMerchantWithdrawals() {
    const res = await api.get('/opay-business/withdrawals')
    return res.data
}

export async function getWithdrawalConfig() {
  const res = await api.get('/opay-business/withdrawal-config')
  return res.data
}

export async function uploadPaymentPageImage(file) {
  const formData = new FormData()
  formData.append('image', file)
  const res = await api.post('/uploads/payment-page-image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return res.data
}

export async function getActivationPackages() {
  const res = await api.get('/opay-business/activation-package')
  return res.data
}

export const getActivationPackage = getActivationPackages;

export async function createActivationCheckout(packageId = null) {
  const res = await api.post('/opay-business/create-activation-checkout', { packageId })
  return res.data
}

export async function getPendingNagad() {
  const res = await api.get('/opay-business/pending-nagad')
  return res.data
}


export async function getAutoWithdrawalHistory(params = {}) {
  const res = await api.get('/opay-business/auto-withdraw/history', { params })
  return res.data
}

export async function cancelAutoWithdrawal(id) {
  const res = await api.post(`/opay-business/auto-withdraw/${id}/cancel`)
  return res.data
}

export async function getAutoWithdrawalPendingCount() {
  const res = await api.get('/opay-business/auto-withdraw/history', { params: { status: 'pending', limit: 1 } })
  return res.data?.total || 0
}

export async function initTopup(amount) {
  const res = await api.post('/opay-business/topup-init', { amount })
  return res.data
}

export async function getTopupHistory(params = {}) {
  const res = await api.get('/opay-business/topup-history', { params })
  return res.data
}
