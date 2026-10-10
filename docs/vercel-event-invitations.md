# Publish event invitations: Vercel + Render + Supabase

Frontend: Vercel. Existing API: https://dpc-managementsystem.onrender.com. Database: the Supabase database connected to that Render service.

The Vercel build renders only the public invitation page and a landing message. It reuses the existing RSVP component; the normal desktop/client build stays separate. No staff login, dashboard or account bootstrap is included in the invitation entry.

## 1. Update the existing Render service

Deploy the current backend code, including the invitation router, event ministry utilities and migrations 020, 021 and 022. Keep the service's existing Supabase `DATABASE_URL` and JWT secret in Render. Do not copy these to Vercel.

For a Render service whose Root Directory is `server`, use Build Command `npm ci && npm run build`, Start Command `node dist/index.js`, and Health Check Path `/api/health`. If the service uses the repository root, use its equivalent existing commands instead; do not create a second backend. The server already listens on `0.0.0.0` and Render's `PORT` environment variable.

Startup applies the additive migrations through the existing migration mechanism. Check Render logs for migration errors; a successful health response alone does not verify all invitation tables. Read-only probe `GET /api/event-invitations/public/not-a-token` should return JSON `{"error":"Invitation not found."}` with status 404. HTML `Cannot GET ...` means the invitation router is not deployed yet.

Checked on October 10, 2026: `/api/health` returned 200, but the invitation probe returned HTML `Cannot GET`. The live backend still needs the updated invitation code. No live database migration or response submission was performed during that check.

## 2. Create the Vercel project

1. Import GitHub repository `Isapolloo08/DPC_ManagementSystem` after the prepared code has been pushed.
2. Set **Root Directory** to `client` and **Framework Preset** to **Vite**.
3. The committed `client/vercel.json` supplies:
   - Install Command: `npm ci`
   - Build Command: `npm run build:invitations`
   - Output Directory: `dist-invitations`
4. Add this environment variable for Production (and Preview if desired):

   ```text
   VITE_PUBLIC_API_URL=https://dpc-managementsystem.onrender.com
   ```

5. Deploy. The resulting production URL looks like `https://your-project.vercel.app`.

The build requires an HTTPS API URL. Vite embeds it at build time, so changing it requires redeploying. The URL is public configuration, not a credential. Invitation routing uses `/#/invite/<token>` and loads the generated `index.html`; no API proxy or database connection is needed on Vercel. Current backend CORS permits browser requests to this API; the public client does not send cookies or an account token.

## 3. Generate an online invitation

In the desktop application's **Invitation Links & Responses**, enter your actual Vercel production URL in **Invitation website URL**, then generate or copy a link.

The link and its event must exist in the database used by Render. Either create/manage the event while connected to the Render backend through the application's server configuration, or synchronize the local event, members, ministries and invitation tables to the same Supabase database first. Changing the website URL alone does not synchronize records. Responses saved online live in Supabase; a locally connected desktop needs a refresh against Render or the normal cloud-sync flow to see them locally.

Check the public link on a phone outside the local network. Verify the event loads, member search includes its target ministries, and the organizer sees an intentional test response. Keep actual attendance confirmation in Event Attendance & Check-In.

## Local build/preview

From `client`, copy `.env.invitations.example` to ignored `.env.invitations`, then run:

```text
npm run build:invitations
npm run preview:invitations
```

Open `http://localhost:4174/#/invite/<token>`. This build uses the real Render API configured above; avoid submitting unintended live test responses. Automated browser verification intercepts requests with fixtures.

References: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Render web services](https://render.com/docs/web-services), [Render environment variables](https://render.com/docs/configure-environment-variables).
