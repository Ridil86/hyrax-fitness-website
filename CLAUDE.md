# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyrax Fitness marketing/landing website with Cognito auth, Stripe subscriptions, admin CMS, and client portal. React SPA frontend with AWS serverless backend (API Gateway + Lambda + DynamoDB).

## Commands

```bash
npm run dev      # Start Vite dev server (port 5173)
npm run build    # Production build to dist/
npm run lint     # ESLint check
npm run preview  # Preview production build locally

# CDK (from infra/ directory) — MSYS_NO_PATHCONV=1 required on Windows Git Bash
cd infra && MSYS_NO_PATHCONV=1 npx cdk deploy --all --profile hyrax-fitness
cd infra && MSYS_NO_PATHCONV=1 npx cdk diff --profile hyrax-fitness
cd infra && MSYS_NO_PATHCONV=1 npx cdk synth

# Seed DynamoDB
cd infra && MSYS_NO_PATHCONV=1 npx tsx scripts/seed-content.ts --profile hyrax-fitness
cd infra && MSYS_NO_PATHCONV=1 npx tsx scripts/seed-tiers.ts --profile hyrax-fitness  # one-time

# Trigger Amplify deploy
MSYS_NO_PATHCONV=1 aws amplify start-job --app-id d2lx0kagzo4fyv --branch-name master --job-type RELEASE --profile hyrax-fitness
```

No test framework is configured. There are no tests.

## Architecture

### Two Codebases in One Repo

- **Frontend** (root): React 19 + Vite 8 SPA, plain JavaScript (JSX), CSS Modules
- **Backend** (`infra/`): AWS CDK (TypeScript) defining infrastructure + Lambda API code

### Frontend Data Flow

Components fetch data via custom hooks (`src/hooks/`) → API client (`src/api/client.js`) → API Gateway → Lambda. Every public-facing component has **hardcoded fallback data** so the site renders even if the API is down. Hooks use in-memory caching to avoid re-fetching within a session.

Key hook pattern: `useContent(sectionName)` fetches from `/api/content/{section}` with cache + fallback.

### Auth System

- **Provider**: AWS Cognito via `aws-amplify` v6, wrapped in `AuthContext.jsx`
- **Groups**: Admin (precedence 0), Client (precedence 10) — extracted from `cognito:groups` access token claim
- **Route protection**: `ProtectedRoute.jsx` checks auth + group membership
- **API auth**: ID token sent as `Authorization` header; Lambda validates via `infra/lambda/api/utils/auth.ts`
- **Google OAuth**: Federated login via Cognito Hosted UI, handled by `GoogleOAuthHandler.jsx`

### Stripe Subscription System

Three fixed tiers: **Pup** (free), **Rock Runner** ($5/mo), **Iron Dassie** ($20/mo). Tier count is fixed — admin can only edit existing tiers, not add/remove.

- Upgrades: immediate with proration
- Downgrades: effective at period end
- Webhook (`infra/lambda/api/routes/stripe-webhook.ts`) handles checkout completion, subscription updates/deletions, invoice events
- Price changes create new Stripe Price objects (immutable); existing subscribers keep current rate
- Currently in **test mode** (`sk_test_*` keys)

### DynamoDB Single-Table Design

Table `HyraxContent` uses PK/SK pattern with GSI1 for cross-user queries. Key entity prefixes: `FAQ`, `CONTENT`, `WORKOUT`, `USER#<sub>`, `TIER`, `STRIPE_CUSTOMER`. See `infra/lambda/api/routes/` for exact key patterns.

### Lambda API Structure

Single Lambda handles all routes via dispatcher (`infra/lambda/api/index.ts`). Route handlers in `infra/lambda/api/routes/`. Uses `fromFunctionArn` import pattern in CDK to avoid exceeding the 20KB Lambda resource-based policy limit.

### CDK Environment Loading

`infra/bin/infra.ts` loads `.env.local` from project root via `dotenv`. Requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Cognito stack) and `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` (Backend stack).

## Design System

Defined in `src/styles/variables.css`:
- Colors: `--ink` (dark), `--paper` (cream bg), `--sand`, `--rock`, `--earth`, `--sunset` (#F28501, primary), `--sunrise` (#FDB90F)
- Border radius: 18px default
- Font: system UI stack

## Key Patterns

- **CSS**: Plain CSS files per component (not CSS Modules despite file names). Use existing CSS custom properties.
- **Routing**: `react-router-dom` BrowserRouter. Hash links (`/#section`) handled by `ScrollManager` in `App.jsx`.
- **Lazy loading**: Pages use `React.lazy()` + `Suspense`. Images use `LazyImage` component with IntersectionObserver.
- **Animations**: `ScrollReveal` wrapper component using Framer Motion for scroll-triggered reveals.
- **Admin pages**: Use `AdminLayout` with sidebar nav. Protected by `ProtectedRoute` requiring Admin group.
- **Portal pages**: Use `PortalLayout` with sidebar nav. Protected by `ProtectedRoute` requiring auth.
- **Tier gating**: `src/utils/tiers.js` — `hasTierAccess(userTier, requiredTier)` checks access. `useTiers` hook fetches tier data.

## Deployment

- **Hosting**: AWS Amplify (auto-builds on push to `master`)
- **App ID**: `d2lx0kagzo4fyv`
- **Domain**: hyraxfitness.com (+ www)
- **AWS Profile**: `hyrax-fitness` (always include `--profile hyrax-fitness` in AWS CLI commands)
- **Region**: us-east-1

## Environment Variables

Frontend (`.env.local`): `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_AWS_REGION`, `VITE_API_URL`, `VITE_COGNITO_DOMAIN`, `VITE_OAUTH_REDIRECT`

Backend (`.env.local`, loaded by CDK): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`

## Windows Git Bash Note

Always prefix AWS CLI commands with `MSYS_NO_PATHCONV=1` to prevent path mangling of arguments starting with `/`.
