# payment-backend

Express + Mongoose backend providing auth endpoints used by the frontend.

Quick start (PowerShell):

```powershell
cd "e:\MY Aplication\3rd Step\88-website\payment-backend"
npm install
# create a .env file (you can copy .env.example)
# ensure you have MongoDB running locally or point MONGO_URI to a hosted DB
npm run dev
```

Endpoints:

- POST /api/auth/register { name, email, password } -> { token, user }
- POST /api/auth/login { email, password } -> { token, user }
- GET /api/auth/me (requires Authorization: Bearer <token>) -> user
