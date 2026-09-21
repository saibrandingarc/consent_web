# consent_web

Public Consent Management website (Next.js). Deploys to its own Azure App Service.

## Local

```bash
pnpm install
cp .env.example .env
pnpm dev   # http://localhost:3000
```

Point `NEXT_PUBLIC_API_URL` at `consent_api` (`http://localhost:4000/api/v1`).

## Azure

Create a Node **22** Linux Web App. Add GitHub secret `AZUREAPPSERVICE_PUBLISHPROFILE`. Optional variables: `AZURE_WEB_APP`, `WEB_URL`, `API_URL`, `ADMIN_URL`. App settings: `deploy/azure/env.example`.
