import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      
      setAuth: (token, user) => set({ token, user }),
      
      logout: () => set({ token: null, user: null }),
      
      updateUser: (updates) => set((state) => ({ 
        user: state.user ? { ...state.user, ...updates } : null 
      })),

      fetchMe: async () => {
        const { token } = useAuthStore.getState();
        if (!token) return;
        try {
          // Use fetch to avoid circular dependency or complex axios setup inside store if simple
          const res = await fetch(`${API_BASE}/opay-business/auth/me`, {
             headers: { Authorization: `Bearer ${token}` }
          });
          
          if (res.status === 401) {
            set({ token: null, user: null });
            return;
          }

          const data = await res.json();
          if (data.success && data.user) {
            set({ user: data.user });
          }
        } catch (err) {
          console.error('Failed to refresh user:', err);
        }
      }
    }),
    {
      name: 'merchant-auth-storage',
    }
  )
)
