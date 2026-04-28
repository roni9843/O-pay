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
