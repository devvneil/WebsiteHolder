# Deploying the two sites to Netlify

The Netlify projects already exist:

| Site | Netlify project | Site ID | URL |
| --- | --- | --- | --- |
| AURELIA | `aurelia-observatory` | `f22b9a8a-25fb-4f43-b7bb-dc596ea910b1` | https://aurelia-observatory.netlify.app |
| TANGERINE PRESS | `tangerine-press` | `d3bd44ed-b4ec-41e0-ab96-0c0a3515eabd` | https://tangerine-press.netlify.app |

## Option 1 — one command from any machine (needs `NETLIFY_AUTH_TOKEN`)

```bash
cd aurelia && zip -qr ../aurelia.zip . && cd ..
curl -X POST "https://api.netlify.com/api/v1/sites/f22b9a8a-25fb-4f43-b7bb-dc596ea910b1/deploys" \
  -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" -H "Content-Type: application/zip" \
  --data-binary @aurelia.zip

cd tangerine && zip -qr ../tangerine.zip . && cd ..
curl -X POST "https://api.netlify.com/api/v1/sites/d3bd44ed-b4ec-41e0-ab96-0c0a3515eabd/deploys" \
  -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" -H "Content-Type: application/zip" \
  --data-binary @tangerine.zip
```

## Option 2 — GitHub Actions

1. Repo **Settings → Actions → General** → enable Actions.
2. Repo **Settings → Secrets and variables → Actions** → add secret `NETLIFY_AUTH_TOKEN`.
3. Run the **"Deploy sites to Netlify"** workflow (Actions tab → Run workflow).

## Option 3 — Netlify CLI

```bash
npx netlify-cli deploy --prod --dir=aurelia   --site f22b9a8a-25fb-4f43-b7bb-dc596ea910b1
npx netlify-cli deploy --prod --dir=tangerine --site d3bd44ed-b4ec-41e0-ab96-0c0a3515eabd
```
