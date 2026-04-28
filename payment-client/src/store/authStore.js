import { create } from "zustand";
import { devtools } from "zustand/middleware";

export const useAuthStore = create(
  devtools(
    (set) => ({
      token: localStorage.getItem("token") || null,
      user: null,
      setToken: (token) => {
        if (token) localStorage.setItem("token", token);
        else localStorage.removeItem("token");
        set({ token, user: null }, false, "setToken");
      },
      setUser: (user) => set({ user }, false, "setUser"),
      logout: () => {
        localStorage.removeItem("token");
        set({ token: null, user: null }, false, "logout");
      },
    }),
    { name: "AuthStore" } // DevTools-এ store-এর নাম দেখাবে
  )
);
