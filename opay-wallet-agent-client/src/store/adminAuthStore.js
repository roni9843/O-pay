import { create } from 'zustand'

const tokenKey = 'opay_client_admin_token'

export const useAdminAuthStore = create((set, get) => ({
  token: localStorage.getItem(tokenKey) || '',
  user: null,
  setToken: (t) => {
    if (t) localStorage.setItem(tokenKey, t); else localStorage.removeItem(tokenKey)
    set({ token: t })
  },
  setUser: (u) => set({ user: u }),
  logout: () => {
    localStorage.removeItem(tokenKey)
    set({ token: '', user: null })
  }
}))
