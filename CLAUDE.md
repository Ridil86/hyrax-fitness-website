# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyrax Fitness marketing, landing, and platform website with Cognito auth, Stripe subscriptions, AI-powered workout generation, nutrition planning, and digital coaching via Amazon Bedrock, admin tools, and client portal. React SPA frontend with AWS serverless backend (API Gateway + Lambda + DynamoDB).

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
cd infra && MSYS_NO_PATHCONV=1 npx tsx scripts/seed-program.ts --profile hyrax-fitness  # 14 equipment, 15 exercises, 15 workouts

# Promote a Cognito user to the Admin group (required to access /admin)
cd infra && MSYS_NO_PATHCONV=1 npx tsx scripts/promote-admin.ts user@example.com --profile hyrax-fitness
cd infra && MSYS_NO_PATHCONV=1 npx tsx scripts/promote-admin.ts user@example.com --remove --profile hyrax-fitness

# Trigger Amplify deploy
MSYS_NO_PATHCONV=1 aws amplify start-job --app-id d2lx0kagzo4fyv --branch-name master --job-type RELEASE --profile hyrax-fitness
```

No test framework is configured. There are no tests.

## Architecture

### Two Codebases in One Repo

- **Frontend** (root): React 19 + Vite 8 SPA, plain JavaScript (JSX), plain CSS (one file per component)
- **Backend** (`infra/`): AWS CDK (TypeScript) defining infrastructure + Lambda API code

### Frontend Data Flow

Components fetch data via custom hooks (`src/hooks/`) or API clients (`src/api/client.js`) -> API Gateway -> Lambda. Landing page components use **hardcoded data** directly (CMS was removed). The `useContent` hook remains only for the Programs page. Portal components fetch via API clients with Cognito ID token auth.

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

### AI Systems (Amazon Bedrock)

All three AI systems use **Claude Haiku 4.5** (`us.anthropic.claude-haiku-4-5-20251001-v1:0`) via cross-region US inference profile. Pricing: $0.80/M input tokens, $4.00/M output tokens.

**Shared infrastructure:**
- `infra/lambda/api/utils/bedrock.ts` - `invokeClaude(systemPrompt, userMessage, maxTokens)` with 3 retries + exponential backoff
- `infra/lambda/api/utils/catalog.ts` - `buildExerciseCatalogText()`, `buildWorkoutCatalogText()`, `buildEquipmentCatalogText()` for dynamic system prompts
- **Output sanitization**: em-dashes, en-dashes, emojis stripped from all AI responses before storage
- **IAM**: Lambda role has `bedrock:InvokeModel` on `arn:aws:bedrock:*::foundation-model/anthropic.*` and `arn:aws:bedrock:*:*:inference-profile/us.anthropic.*`, plus `aws-marketplace:ViewSubscriptions` and `aws-marketplace:Subscribe`

**Async Lambda Self-Invocation Pattern** (used by routines and nutrition):
1. Client POSTs to `/api/routine/generate` or `/api/nutrition/generate`
2. Lambda returns `{ status: 'generating' }` with 202 immediately
3. Lambda invokes itself asynchronously with flag (`__asyncRoutineGeneration` or `__asyncNutritionGeneration`)
4. Async invocation bypasses API Gateway (detected by checking the flag on event), runs Bedrock call (30-60s)
5. Results stored in DynamoDB with status `ready`
6. Frontend polls `/api/routine/today` or `/api/nutrition/today` every 3s for up to 90s

#### AI Workout Generation (Rock Runner+)

- **Route**: `infra/lambda/api/routes/routine.ts`
- **Frontend**: `src/pages/portal/MyRoutine.jsx`, `src/api/routine.js`
- **PDF**: `src/utils/routinePdf.js`
- **Endpoints**: `POST /generate`, `GET /today?date=`, `POST /swap`, `POST /preview` (admin), `GET /history`, `GET /{date}`
- **System prompt**: User fitness profile + 14-day completion history + exercise/workout/equipment catalogs + movement pattern tracking
- **Requires**: Completed fitness questionnaire

#### AI Nutrition Plans (Iron Dassie)

- **Route**: `infra/lambda/api/routes/nutrition.ts`
- **Frontend**: `src/pages/portal/MyNutrition.jsx`, `src/api/nutrition.js`
- **Endpoints**: `POST /generate`, `GET /today?date=`, `POST /preview` (admin), `GET /history`, `GET /{date}`
- **CRITICAL**: System prompt includes strict allergy safety rules - never include allergens even as trace/garnish
- **System prompt**: Nutrition profile (allergies, restrictions, preferences, macros) + fitness profile + today's workout + 7-day nutrition history
- **Requires**: Completed nutrition questionnaire

#### AI Coach Chat (Iron Dassie)

- **Route**: `infra/lambda/api/routes/chat.ts`
- **Frontend**: `src/pages/portal/TrainingChat.jsx`, `src/api/chat.js`
- **Endpoints**: `POST /api/chat`, `GET /api/chat/history`, `POST /api/chat/preview` (admin)
- **Synchronous** (not async) - direct Bedrock call within API Gateway timeout
- **Rate limit**: 20 messages/day
- **System prompt**: Full user context (fitness profile, nutrition profile, recent workout/meal logs, today's plans, exercise/workout/equipment catalogs)
- **Behavior rules**: Only fitness/nutrition/recovery topics, no em-dashes or emojis, personable without being sycophantic

### Fitness & Nutrition Questionnaires

- **Fitness**: `src/pages/portal/FitnessQuestionnaire.jsx` (6 steps) - experience, goals, schedule, environment, equipment, health/injuries
- **Nutrition**: `src/pages/portal/NutritionQuestionnaire.jsx` (8 steps) - allergies, restrictions, preferences, calories, macros, meal schedule, cooking, supplements
- **API**: `PUT /api/profile/fitness`, `PUT /api/profile/nutrition`
- Stored on user's DynamoDB profile record

### Meal Logging

- **Route**: `infra/lambda/api/routes/meal-log.ts`
- **Endpoints**: `POST /api/meal-logs`, `POST /api/meal-logs/plan` (batch), `GET /api/meal-logs?date=`, `GET /api/meal-logs/stats`, `DELETE /api/meal-logs/{id}`
- **Aggregates**: `MEAL_STATS#DAILY#{date}` and `MEAL_STATS#MONTHLY#{YYYY-MM}` records updated on each log

### Benchmarks

- **Frontend**: `src/pages/portal/Benchmarks.jsx`
- **5 standard benchmarks**: Boulder Press Max, Bolt Sprint, Perch Squat Max, Crag Pull Max, Sunstone Hold
- **API**: `GET /api/logs/benchmarks`, `POST /api/logs` with `type: "benchmark"`

### DynamoDB Single-Table Design

Table `HyraxContent` uses PK/SK pattern with GSI1 for cross-user queries.

**Entity prefixes**: `FAQ`, `CONTENT`, `WORKOUT`, `VIDEO`, `EXERCISE`, `EQUIPMENT`, `USER#<sub>`, `COMMUNITY`, `SUPPORT#<status>`, `COMPLETION_LOG`, `TIER`, `STRIPE_CUSTOMER`, `BILLING`, `ADMIN_ANALYTICS`, `AUDIT`, `ROUTINE`, `NUTRITION`, `CHAT`, `MEAL_LOG`, `MEAL_STATS`, `STATS`

Common query patterns:
- Single item: `GetCommand({ Key: { pk: 'ENTITY', sk: 'ENTITY#id' } })`
- List all of type: `QueryCommand` with `pk = :pk`
- User-scoped: `pk = 'USER#<sub>'`, sk prefixed by entity (e.g., `PROFILE`, `SETTINGS`, `ROUTINE#date`, `NUTRITION#date`, `CHAT#timestamp`)
- Time-range: `sk BETWEEN :from AND :to` for logs/analytics
- GSI1: `gsi1pk = 'TIER'` (all tiers), `gsi1pk = 'CATEGORY#name'` (community threads), `gsi1pk = 'SUBSCRIPTION'` (billing)

### Lambda API Structure

Single Lambda handles all routes via dispatcher (`infra/lambda/api/index.ts`). **26 route handlers** in `infra/lambda/api/routes/`:

`admin-analytics`, `audit`, `billing`, `chat`, `community`, `completion-log`, `content`, `email-preview`, `equipment`, `exercises`, `faq`, `fourthwall-webhook`, `meal-log`, `nutrition`, `profile`, `routine`, `signup`, `stripe`, `stripe-webhook`, `support`, `tiers`, `upload`, `user-upload`, `users`, `videos`, `workouts`

Uses `fromFunctionArn` import pattern in CDK to avoid exceeding the 20KB Lambda resource-based policy limit.

Dispatcher uses regex-based path matching - **route order matters** (specific routes like `/api/audit/stats` must come before generic `/api/audit`). Path parameters are extracted via regex groups and set on `event.pathParameters`.

Shared utilities in `infra/lambda/api/utils/`:
- `auth.ts`: `extractClaims(event)` returns `{ sub, email, groups }`, `isAdmin(event)` checks Admin group
- `response.ts`: `success()`, `created()`, `badRequest()`, `forbidden()`, `notFound()`, `serverError()` - all include CORS headers
- `bedrock.ts`: `invokeClaude(systemPrompt, userMessage, maxTokens)` - Bedrock client with retry logic
- `catalog.ts`: Dynamic catalog builders for AI system prompts

### PDF Generation

- `src/utils/workoutPdf.js` - Signature workout PDFs with exercise modifications, images, QR code, user personalization, tier badge, brand watermark
- `src/utils/routinePdf.js` - AI-generated routine PDFs with zebra-striped exercises, warm-up/bask sections, progression notes, QR code, brand watermark
- Both use jsPDF + qrcode libraries, brand colors from design system, sanitize em-dashes/emojis

### Media & Video Pipeline

- **S3 bucket** (`hyrax-fitness-media-{account}`): stores uploaded videos and images, blocked public access
- **CloudFront CDN**: serves media from S3. CDN domain passed to Lambda as `CDN_DOMAIN` env var
- **Upload flow**: Admin/client requests presigned S3 URL via API (`/api/upload`, `/api/user-upload`) -> uploads directly to S3
- **Video transcoding**: Separate Lambda (`hyrax-transcoder`) triggered by S3 `uploads/videos/` ObjectCreated events -> creates MediaConvert job -> EventBridge rule captures job completion/failure -> updates video status in DynamoDB
- **Trial reminder**: Separate Lambda (`infra/lambda/trial-reminder/`) for trial expiry email notifications

### Community Forum

Threads with replies, reactions (likes/helpful), and admin moderation. Route handler in `community.ts` (~800 lines). Categories seeded via `infra/scripts/seed-categories.ts`. Uses `COMMUNITY` pk with GSI1 `CATEGORY#<name>` for category filtering.

### Merch Storefront (Fourthwall)

- **Frontend**: `src/pages/Merch.jsx`, `src/pages/MerchProduct.jsx`, `src/api/fourthwall.js`
- **Cart**: `CartContext.jsx` provider wraps app, `CartDrawer.jsx` slide-out cart component
- **Backend**: `infra/lambda/api/routes/fourthwall-webhook.ts` handles order/shipping webhook events
- **Integration**: Fourthwall API for product catalog and checkout; webhook secret in `FOURTHWALL_WEBHOOK_SECRET` env var

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
- **Lazy loading**: Pages use `React.lazy()` + `Suspense`. Images use `LazyImage` component with IntersectionObserver (or native `loading="lazy"` for card grids).
- **Animations**: `ScrollReveal` wrapper component using Framer Motion for scroll-triggered reveals.
- **Admin pages**: Use `AdminLayout` with sidebar nav. Protected by `ProtectedRoute` requiring Admin group.
- **Portal pages**: Use `PortalLayout` with sidebar nav. Protected by `ProtectedRoute` requiring auth.
- **Tier gating**: `src/utils/tiers.js` - `hasTierAccess(userTier, requiredTier)` checks access. `useTiers` hook fetches tier data. Server-side validation in route handlers.
- **Landing page**: Hardcoded data in components (no CMS). Section order: Hero > Method > Workouts + Features > Testimonials > GetStarted.
- **AI output rules**: Never use em-dashes or emojis. Sanitize all Bedrock responses before storage/display.

## Portal Navigation (sidebar order)

Dashboard, My Routine, My Nutrition, AI Coach, Workouts, Videos, Progress, Benchmarks, Activity, Community, Subscription, Profile, Settings, Support

## Admin Pages

Dashboard, Users, FAQ, Equipment, Exercises, Workouts, Videos, Community, Support, Analytics (with AI token/cost tracking), AI Debug (multi-system prompt preview), Email Preview (template testing)

## Public Pages

- `/` - Landing page (Hero, Method, Workouts, Features, Testimonials, GetStarted)
- `/about` - Company story, founder bio, hyrax philosophy
- `/events` - Event types and hosting information
- `/programs` - Tier comparison and pricing
- `/merch` - Merchandise storefront (Fourthwall integration)
- `/merch/:id` - Individual product pages
- `/login`, `/get-started` - Auth flows
- `/terms`, `/privacy`, `/cookies` - Legal pages

## Adding a New API Route

1. **Create route handler** in `infra/lambda/api/routes/my-feature.ts` - use `extractClaims`/`isAdmin` for auth, response helpers for returns
2. **Import and register** in `infra/lambda/api/index.ts` - add regex match in the handler function (place specific paths before generic ones)
3. **Add API Gateway resource** in `infra/lib/backend-stack.ts` - create resource + method with Cognito authorizer if authenticated; include OPTIONS method for CORS
4. **Deploy**: `cd infra && MSYS_NO_PATHCONV=1 npx cdk deploy --all --profile hyrax-fitness`

## Admin Bootstrap

There is no self-serve path to become an admin. The first admin on a fresh deployment (and any subsequent promotions) must be added to the Cognito `Admin` group manually.

Preferred: run the bootstrap script after the user has signed up.

```bash
cd infra && MSYS_NO_PATHCONV=1 npx tsx scripts/promote-admin.ts user@example.com --profile hyrax-fitness
```

The script reads `VITE_COGNITO_USER_POOL_ID` from the project-root `.env.local`, finds the Cognito user by email, and calls `AdminAddUserToGroup`. Pass `--remove` to demote. The user must sign out and back in for the group claim to appear on their access token.

Equivalent raw AWS CLI (if the script is unavailable):

```bash
MSYS_NO_PATHCONV=1 aws cognito-idp admin-add-user-to-group \
  --user-pool-id $VITE_COGNITO_USER_POOL_ID \
  --username <email> \
  --group-name Admin \
  --region us-east-1 --profile hyrax-fitness
```

## Deployment

- **Hosting**: AWS Amplify (auto-builds on push to `master`)
- **App ID**: `d2lx0kagzo4fyv`
- **Domain**: hyraxfitness.com (+ www)
- **AWS Profile**: `hyrax-fitness` (always include `--profile hyrax-fitness` in AWS CLI commands)
- **Region**: us-east-1
- **Bedrock**: Cross-region inference profile routes to us-east-1, us-east-2, us-west-2. Model access must be enabled in all three regions.

## Environment Variables

Frontend (`.env.local`): `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_AWS_REGION`, `VITE_API_URL`, `VITE_COGNITO_DOMAIN`, `VITE_OAUTH_REDIRECT`

Backend (`.env.local`, loaded by CDK): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `FOURTHWALL_WEBHOOK_SECRET`

## Seed Data

- **14 equipment items**: Dumbbells, Kettlebells, Pull-Up Bar, Plyo Box, Sandbag, Weight Vest, Sled, Barbell, Parallettes, Rings, Cones, Loaded Backpack, Foam Roller, Resistance Band
- **15 exercises** (4 difficulty modifications each): Boulder Press, Crag Pull, Colony Carry, Ledge Scramble, Bolt Sprint, Outcrop Crawl, Perch Squat, Sunstone Hold, Ridge Row, Cliff Lunge, Basalt Burpee, Sentinel Press, Summit Inversion, Kopje Dip, Crevice Flow
- **15 workouts** (5 home, 5 gym, 5 outdoors): Dawn Forage, Colony Circuit, Burrow Burn, Thermal Drift, Pinnacle Flow, Kopje Complex, Granite Grind, Slab Ascent, Talus Storm, Spire Session, Ridge Run, Outcrop, Bolt, Colony March, Skyline
- **Seed command**: `cd infra && MSYS_NO_PATHCONV=1 npx tsx scripts/seed-program.ts --profile hyrax-fitness`

## Windows Git Bash Note

Always prefix AWS CLI commands with `MSYS_NO_PATHCONV=1` to prevent path mangling of arguments starting with `/`.
