# consent_web

Independent public site. It only talks to **consent_api** over HTTPS (`NEXT_PUBLIC_API_URL`). It does not host the API.

Local API: `http://localhost:4000/api/v1`  
Azure API: `https://consentapi-abgrbph5cfccbxe0.eastus2-01.azurewebsites.net/api/v1`

## Local

```bash
pnpm install
cp .env.example .env
pnpm dev   # http://localhost:3000
```

## Azure

Node **22** Linux Web App. Secret `AZUREAPPSERVICE_PUBLISHPROFILE`. Default app name `consentmngtdev`. Set `NEXT_PUBLIC_API_URL` at **build** time (GitHub Actions already defaults to the Azure API).
