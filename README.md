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

### Funding participation and KakaoPay

The funding flow uses KakaoPay checkout.

1. Apply the funding migrations through `20260719020000_enable_kakaopay_funding_participation.sql`.
2. Deploy `kakaopay-ready`, `kakaopay-approve`, and `kakaopay-cancel` with JWT verification enabled.
3. Configure `KAKAOPAY_SECRET_KEY`, `KAKAOPAY_CID`, and `APP_URL` in the Supabase Edge Function secrets.
4. A signed-in participant must save a phone number and shipping address before checkout.
5. Only paid quantities count toward the funding goal. Participants can cancel and refund eligible payments from `/my-fundings`.
6. Only the funding creator and admins can view participant contact and shipping information.

## I want to use a custom domain - is that possible?

We don't support custom domains (yet). If you want to deploy your project under your own domain then we recommend using Netlify. Visit our docs for more details: [Custom domains](https://docs.lovable.dev/tips-tricks/custom-domain/)
