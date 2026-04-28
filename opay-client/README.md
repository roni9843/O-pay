# opay-client

A minimal React + Tailwind app that serves a single route and reads the provider and token from the URL path.

- Route pattern: `/api-autopay/:provider/:id`
- Example: `https://api.oraclepay.org/api-autopay/bkash/0b0e469a63c5aaa947daa5bd`

## Develop

```bash
# from opay-client
npm install
npm run dev
```

## Build

```bash
npm run build
```

Outputs to `dist/`. The backend can serve this under `/api-autopay/*`.
