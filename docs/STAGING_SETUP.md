# 🧪 Staging Server Setup (Free Tier)

> Production uses the `render.yaml` Blueprint. Staging uses **separate free-tier services** to avoid costs.

## Step 1: Create Staging API (Free Web Service)

1. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**
2. Connect your GitHub repo: `SuperHuyGaming/GMU-Badminton-App`
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `gmu-social-api-staging` |
| **Branch** | `develop` |
| **Root Directory** | `server` |
| **Runtime** | Node |
| **Build Command** | `npm install --legacy-peer-deps` |
| **Start Command** | `node server.js` |
| **Instance Type** | Free |

4. Add environment variables:
   - `MONGO_URI` → your staging MongoDB connection string (can reuse production or create a separate free Atlas cluster)
   - `NODE_ENV` → `staging`
   - Copy over any other env vars from production (JWT secrets, VAPID keys, etc.)

## Step 2: Create Staging Frontend (Free Static Site)

1. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Static Site**
2. Connect your GitHub repo: `SuperHuyGaming/GMU-Badminton-App`
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `gmu-frontend-staging` |
| **Branch** | `develop` |
| **Root Directory** | `client` |
| **Build Command** | `npm install --legacy-peer-deps && npm run build` |
| **Publish Directory** | `dist` |

4. Add environment variable:
   - `VITE_API_URL` → the URL of your staging API from Step 1 (e.g. `gmu-social-api-staging.onrender.com`)

## That's It! 🎉

Both services will **auto-deploy whenever `develop` is updated** — completely free.

### How It Works

```
Feature Branch → PR to develop → CI passes → merge → staging auto-deploys (free)
                                                       ↓
                                    You test staging → merge develop to main → production deploys
```
