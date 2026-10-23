## Project info

**URL**: https://lovable.dev/projects/a412c583-f150-44a0-83aa-fca5eaa8061f

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/a412c583-f150-44a0-83aa-fca5eaa8061f) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with .

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How is this project deployed?

GitHub `main` is the source of truth for the production build. Changes are validated locally and pushed directly to the repository.

### Funding participation and KakaoPay (legacy)

KakaoPay handlers remain available for existing payments. New funding checkout uses KSNET below.

1. Apply the funding migrations through `20260719020000_enable_kakaopay_funding_participation.sql`.
2. Deploy `kakaopay-ready`, `kakaopay-approve`, and `kakaopay-cancel` with JWT verification enabled.
3. Configure `KAKAOPAY_SECRET_KEY`, `KAKAOPAY_CID`, and `APP_URL` in the Supabase Edge Function secrets.
4. A signed-in participant must save a phone number and shipping address before checkout.
5. Only paid quantities count toward the funding goal. Participants can cancel and refund eligible payments from `/my-fundings`.
6. Only the funding creator and admins can view participant contact and shipping information.

### Payment mode (PG is decoupled from every other feature)

The checkout provider is chosen by `VITE_PAYMENT_MODE` (`mock | test | live | disabled`, see `src/services/payment/config.ts`).
Production builds turn `mock` or a missing value into `disabled`: the product page shows "결제 오픈 준비 중" and never calls a payment API,
while the seller center, reviews, magazine and membership keep working. Set the repository variable `PAYMENT_MODE` (Settings → Variables)
to `live` only after the KSNET secrets below exist — the deploy workflow checks those secrets only for `live`/`test`, so a missing PG setup
no longer blocks database, function and frontend deploys. The optional Edge secret `PAYMENT_MODE` adds the same switch on the server
(`ksnet-ready` refuses checkout when `disabled`; with `live` it rejects the sample MID and the test API host).
See [docs/SELLER_CENTER.md](docs/SELLER_CENTER.md) and the PG review in [docs/PG_PR160_REVIEW.md](docs/PG_PR160_REVIEW.md).

### Funding participation and KSNET (active when `PAYMENT_MODE=live`)

With `PAYMENT_MODE=live` (or `test`) the active provider in `src/services/payment/index.ts` is `ksnet`. The checkout opens the KSPay card window; `ksnet-return` confirms the approval with KSNET using the **amount stored in the DB** and only then marks the participation paid.

1. Configure the Edge Function secrets before applying migrations:
   - `KSNET_MID` — 10-digit store ID for card (인증결제) payments.
   - `KSNET_AUTH_HEADER` — refund API key from KStA → PG 상점정보 → pgapi (`base64(MID:key)`, the `pgapi ` prefix is optional). Without it refunds fail instead of being marked refunded.
   - `APP_URL` — site origin the buyer returns to (`/payments/ksnet/result`).
   - Optional: `KSNET_RETURN_URL` (defaults to `${SUPABASE_URL}/functions/v1/ksnet-return`, must stay ≤ 100 chars with its query) and `KSNET_API_BASE` (refund API host, defaults to production `https://pay.ksnet.co.kr`).
2. Apply `20261018020000_enable_ksnet_funding_payment.sql` and `20261019000000_harden_ksnet_payments.sql`. The latter blocks browser calls to payment finalizers and mock checkout, and stores approval/refund operations durably.
3. Deploy `ksnet-ready` (JWT verification on) and `ksnet-return` (**JWT verification off** — KSPay posts back from the browser). Redeploy `kakaopay-approve`, `kakaopay-cancel`, and `creator-cancel-participation`, then deploy the frontend.
4. The minimum KSPay amount is 1,000원. Verify a small real card payment, full refund, and mobile checkout before opening payments to customers.

PR checks only run tests and type checking. Merging to `main` runs deployment in the order above. See [the KSNET guide](docs/KSNET_PAYMENT.md) for local tests and recovery of uncertain payment results.

Local test setup uses KSNET's sample store ID `2999199999` with `KSNET_API_BASE=https://paydev.ksnet.co.kr`. Never deploy with the sample ID.

## I want to use a custom domain - is that possible?

We don't support custom domains (yet). If you want to deploy your project under your own domain then we recommend using Netlify. Visit our docs for more details: [Custom domains](https://docs.lovable.dev/tips-tricks/custom-domain/)
