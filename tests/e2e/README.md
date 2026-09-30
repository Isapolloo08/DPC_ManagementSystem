# DPC browser smoke tests

Playwright runs Chromium against the real DPC client and API. It checks backend
health, the startup/login page, password visibility, required username validation,
invalid credentials, expired sessions, and mobile login layout. With credentials,
it also checks login, live dashboard data, session persistence, member search,
calendar navigation, and logout.

## Run

```powershell
npm install
npx playwright install chromium
# Start the backend in another terminal if it is not already running:
npm run dev:server
# Then run the tests (Vite starts automatically if needed):
npm run test:e2e
```

Use an existing Admin, Pastor, or Coordinator test account for the authenticated
test. Set `DPC_TEST_USERNAME` and `DPC_TEST_PASSWORD` as environment variables, or
put them in the git-ignored `.env.playwright.local` file at the project root.
Without both values, the authenticated test is explicitly skipped.

Optional environment variables:

- `PLAYWRIGHT_BASE_URL`: existing client URL (default `http://127.0.0.1:3000`).
- `PLAYWRIGHT_API_URL`: backend origin without `/api` (default `http://127.0.0.1:4000`).

```powershell
npm run test:e2e:headed  # Watch Chromium execute the tests
npm run test:e2e:ui      # Interactive test runner
npm run test:e2e:report  # Open the latest HTML report
```

Tests do not add, edit, or delete church records. Browser API writes other than
login are blocked and fail the suite. Normal login may update the server's existing
login bookkeeping. Each test gets a fresh browser profile. The backend is not
automatically started because its startup runs migrations and email jobs.

Screenshots are saved in `test-results/` and the HTML report in
`playwright-report/`. Both are git-ignored and may contain private church data.
Authenticated tests disable traces/video so login credentials are not recorded
there. Public test failures retain a diagnostic trace.

Run with one worker to respect the local API's rate limits. Avoid repeatedly
running login tests in a short period: the API allows ten authentication requests
per fifteen minutes.

These are initial browser smoke checks, not coverage of every DPC feature or the
Electron desktop shell. Firefox and WebKit are not installed by this setup.
