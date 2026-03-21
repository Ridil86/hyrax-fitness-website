# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyrax Fitness marketing, landing, and platform website with Cognito auth, Stripe subscriptions, admin CMS, and client portal. React SPA frontend with AWS serverless backend (API Gateway + Lambda + DynamoDB).

## Commands

```bash
npm run dev      # Start Vite dev server (port 5173)
npm run build    # Production build to dist/
npm run lint     # ESLint check
npm run preview  # Preview production build locally

# CDK (from infra/ directory) - MSYS_NO_PATHCONV=1 required on Windows Git Bash
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

- **Frontend** (root): React 19 + Vite 8 SPA, plain JavaScript (JSX), plain CSS (one file per component)
- **Backend** (`infra/`): AWS CDK (TypeScript) defining infrastructure + Lambda API code

### Frontend Data Flow

Components fetch data via custom hooks (`src/hooks/`) → API client (`src/api/client.js`) → API Gateway → Lambda. Every public-facing component has **hardcoded fallback data** so the site renders even if the API is down. Hooks use in-memory caching to avoid re-fetching within a session.

Key hook pattern: `useContent(sectionName)` fetches from `/api/content/{section}` with cache + fallback.

### Auth System

- **Provider**: AWS Cognito via `aws-amplify` v6, wrapped in `AuthContext.jsx`
- **Groups**: Admin (precedence 0), Client (precedence 10) - extracted from `cognito:groups` access token claim
- **Route protection**: `ProtectedRoute.jsx` checks auth + group membership
- **API auth**: ID token sent as `Authorization` header; Lambda validates via `infra/lambda/api/utils/auth.ts`
- **Google OAuth**: Federated login via Cognito Hosted UI, handled by `GoogleOAuthHandler.jsx`
- **Cognito Lambda triggers**: Pre-signup (Google account linking, duplicate email prevention), Post-confirmation (auto-adds to Client group), Custom-message (branded HTML verification/reset emails). Code in `infra/lambda/pre-signup/`, `post-confirmation/`, `custom-message/`

### Stripe Subscription System

Three fixed tiers: **Pup** (free), **Rock Runner** ($5/mo), **Iron Dassie** ($20/mo). Tier count is fixed - admin can only edit existing tiers, not add/remove.

- Upgrades: immediate with proration
- Downgrades: effective at period end
- Webhook (`infra/lambda/api/routes/stripe-webhook.ts`) handles checkout completion, subscription updates/deletions, invoice events
- Price changes create new Stripe Price objects (immutable); existing subscribers keep current rate
- Currently in **test mode** (`sk_test_*` keys)

### DynamoDB Single-Table Design

Table `HyraxContent` uses PK/SK pattern with GSI1 for cross-user queries. Key entity prefixes: `FAQ`, `CONTENT`, `WORKOUT`, `VIDEO`, `EXERCISE`, `EQUIPMENT`, `USER#<sub>`, `COMMUNITY`, `SUPPORT#<status>`, `COMPLETION_LOG`, `TIER`, `STRIPE_CUSTOMER`, `BILLING`, `ADMIN_ANALYTICS`, `AUDIT`.

Common query patterns:
- Single item: `GetCommand({ Key: { pk: 'ENTITY', sk: 'ENTITY#id' } })`
- List all of type: `QueryCommand` with `pk = :pk`
- User-scoped: `pk = 'USER#<sub>'`, sk prefixed by entity (e.g., `PROFILE`, `SETTINGS`)
- Time-range: `sk BETWEEN :from AND :to` for logs/analytics
- GSI1: `gsi1pk = 'TIER'` (all tiers), `gsi1pk = 'CATEGORY#name'` (community threads), `gsi1pk = 'SUBSCRIPTION'` (billing)

### Lambda API Structure

Single Lambda handles all routes via dispatcher (`infra/lambda/api/index.ts`). Route handlers in `infra/lambda/api/routes/`. Uses `fromFunctionArn` import pattern in CDK to avoid exceeding the 20KB Lambda resource-based policy limit.

Dispatcher uses regex-based path matching - **route order matters** (specific routes like `/api/audit/stats` must come before generic `/api/audit`). Path parameters are extracted via regex groups and set on `event.pathParameters`.

Shared utilities in `infra/lambda/api/utils/`:
- `auth.ts`: `extractClaims(event)` returns `{ sub, email, groups }`, `isAdmin(event)` checks Admin group
- `response.ts`: `success()`, `created()`, `badRequest()`, `forbidden()`, `notFound()`, `serverError()` - all include CORS headers

### Media & Video Pipeline

- **S3 bucket** (`hyrax-fitness-media-{account}`): stores uploaded videos and images, blocked public access
- **CloudFront CDN**: serves media from S3. CDN domain passed to Lambda as `CDN_DOMAIN` env var
- **Upload flow**: Admin/client requests presigned S3 URL via API (`/api/upload`, `/api/user-upload`) → uploads directly to S3
- **Video transcoding**: Separate Lambda (`hyrax-transcoder`) triggered by S3 `uploads/videos/` ObjectCreated events → creates MediaConvert job → EventBridge rule captures job completion/failure → updates video status in DynamoDB

### Community Forum

Threads with replies, reactions (likes/helpful), and admin moderation. Route handler in `community.ts` (~800 lines). Categories seeded via `infra/scripts/seed-categories.ts`. Uses `COMMUNITY` pk with GSI1 `CATEGORY#<name>` for category filtering.

### CDK Environment Loading

`infra/bin/infra.ts` loads `.env.local` from project root via `dotenv`. Requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Cognito stack) and `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` (Backend stack).

## Design System

Defined in `src/styles/variables.css`:
- Colors: `--ink` (dark), `--paper` (cream bg), `--sand`, `--rock`, `--earth`, `--sunset` (#F28501, primary), `--sunrise` (#FDB90F)
- Border radius: 18px default
- Font: system UI stack

## Key Patterns

- **CSS**: Plain CSS files per component (not CSS Modules despite file names). Use existing CSS custom properties.
- **Routing**: React Router 7 (`react-router-dom`). Hash links (`/#section`) handled by `ScrollManager` in `App.jsx`.
- **Lazy loading**: Pages use `React.lazy()` + `Suspense`. Images use `LazyImage` component with IntersectionObserver.
- **Animations**: `ScrollReveal` wrapper component using Framer Motion for scroll-triggered reveals.
- **Admin pages**: Use `AdminLayout` with sidebar nav. Protected by `ProtectedRoute` requiring Admin group.
- **Portal pages**: Use `PortalLayout` with sidebar nav. Protected by `ProtectedRoute` requiring auth.
- **Tier gating**: `src/utils/tiers.js` - `hasTierAccess(userTier, requiredTier)` checks access. `useTiers` hook fetches tier data.

## Adding a New API Route

1. **Create route handler** in `infra/lambda/api/routes/my-feature.ts` - use `extractClaims`/`isAdmin` for auth, response helpers for returns
2. **Import and register** in `infra/lambda/api/index.ts` - add regex match in the handler function (place specific paths before generic ones)
3. **Add API Gateway resource** in `infra/lib/backend-stack.ts` - create resource + method with Cognito authorizer if authenticated
4. **Deploy**: `cd infra && MSYS_NO_PATHCONV=1 npx cdk deploy --all --profile hyrax-fitness`

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
