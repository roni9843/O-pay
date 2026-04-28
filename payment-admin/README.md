# Payment Admin

Admin panel for managing users, balances, devices, and payments.

## Stack
- Vite + React
- Tailwind CSS
- Zustand for state
- React Router v6

## Setup

1. Copy env and set API URL
```
cp .env.example .env
```

2. Install and run
```
npm install
npm run dev
```

Visit the URL printed by Vite. Default API base: `http://localhost:5000`.

## Structure
- `src/layouts/AdminLayout.jsx`: Sidebar + header + outlet
- `src/pages/*`: Dashboard, Users, UserDetail, Payments, Devices, Settings
- `src/store/authStore.js`: Token + user
- `src/lib/api.js`: API helpers (admin stubs)
