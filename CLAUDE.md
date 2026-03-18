# Hyrax Fitness Website

## Project Overview
Hyrax Fitness is a start-stop, scramble-and-carry training system inspired by the rock hyrax. This is the marketing/landing website built with React + Vite, with Cognito-based authentication, Stripe subscription billing, an admin dashboard with CMS, FAQ manager, billing dashboard, tier management, and user management.

## Tech Stack
- **Framework**: React 19 + Vite 8
- **Routing**: react-router-dom (BrowserRouter)
- **Animations**: Framer Motion
- **Scroll Detection**: react-intersection-observer
- **Auth**: AWS Cognito (via aws-amplify v6) with Google OAuth federated login
- **Payments**: Stripe (subscription billing, Checkout Sessions, Customer Portal, Webhooks)
- **Backend API**: API Gateway (REST) + Lambda (Node.js)
- **Database**: DynamoDB (single-table design with GSI1)
- **Storage**: S3 (admin image uploads via pre-signed URLs)
- **CDN**: CloudFront for media delivery
- **Infrastructure**: AWS CDK (TypeScript) in `infra/` directory
- **Styling**: CSS Modules (plain CSS files per component)
- **Build Output**: `dist/` directory (static SPA)

## Project Structure
```
src/
  App.jsx              # Router setup with AuthProvider, page routes, admin routes
  main.jsx             # Entry point (imports amplifyConfig before App)
  amplifyConfig.js     # AWS Amplify/Cognito configuration
  context/
    AuthContext.jsx    # React context: user state, groups, sign-in/up/out, getIdToken, refreshTier
  api/
    client.js          # Base fetch wrapper (apiGet, apiPost, apiPut, apiDelete)
    faq.js             # FAQ API functions (list, create, update, delete, reorder)
    content.js         # Content API functions (get section, update section)
    users.js           # Users API functions (list, getGroups, updateGroups)
    upload.js          # S3 upload functions (getPresignedUrl, uploadFile)
    profile.js         # User profile API (get, create, update)
    subscription.js    # Stripe subscription API (fetchTiers, checkout, portal, cancel)
    billing.js         # Admin billing API (stats, subscriptions, payments)
    tiers.js           # Admin tier API (fetchTiers, updateTier)
    audit.js           # Audit log API
  components/
    Header.jsx/.css    # Sticky nav with auth-aware CTA (Sign In / Sign Out / Admin link)
    Hero.jsx/.css      # Full-screen hero with animated entrance (API-driven with fallbacks)
    Method.jsx/.css    # 5 training modules grid (API-driven with fallbacks)
    Workouts.jsx/.css  # Signature workouts cards (API-driven with fallbacks)
    Dassie.jsx/.css    # "Why the Hyrax?" section (API-driven with fallbacks)
    Programs.jsx/.css  # 3-tier pricing + comparison chart + events (API-driven with fallbacks)
    Gallery.jsx/.css   # Photo gallery page
    Testimonials.jsx/.css  # 3 testimonial cards (API-driven with fallbacks)
    FAQ.jsx/.css       # Animated accordion (API-driven with loading/error states)
    GetStarted.jsx/.css    # CTA + class format and event cards (API-driven with fallbacks)
    Footer.jsx/.css    # Footer with route-aware links
    LazyImage.jsx      # Intersection-observer lazy image loader
    ScrollReveal.jsx   # Framer Motion scroll-reveal wrapper
    ProtectedRoute.jsx # Route guard checking auth + group membership
    AdminLayout.jsx/.css   # Admin sidebar nav + Outlet wrapper
    PortalLayout.jsx/.css  # Client portal sidebar nav + Outlet wrapper
    GoogleOAuthHandler.jsx # Handles Google OAuth redirect callback
    ErrorBoundary.jsx  # React error boundary
    CookieConsent.jsx  # GDPR cookie consent banner
  pages/
    Login.jsx          # Email/password sign-in (handles NEW_PASSWORD_REQUIRED challenge)
    Register.jsx       # Registration with name, email, password
    ConfirmSignUp.jsx  # 6-digit verification code entry
    WorkoutLibrary.jsx # Browse workout library (within portal)
    WorkoutDetail.jsx  # Single workout detail + PDF download
    IntakeWizard.jsx   # Onboarding intake questionnaire
    TermsOfUse.jsx     # Terms of use legal page
    PrivacyPolicy.jsx  # Privacy policy legal page
    CookiePolicy.jsx   # Cookie policy legal page
    auth.css           # Shared auth page styles
    portal/
      PortalDashboard.jsx/.css  # Client portal home with profile card + quick links
      PortalProfile.jsx/.css    # Edit user name, view email
      PortalSubscription.jsx/.css # Subscription management (upgrade/downgrade/cancel via Stripe)
      PortalSettings.jsx/.css   # Notification preferences (placeholder)
    admin/
      Dashboard.jsx/.css   # Live stats (user, FAQ, workout counts) + quick links
      Users.jsx/.css       # Cognito user list, search, group management
      UserProfile.jsx      # Individual user profile view
      Content.jsx/.css     # Tabbed content CMS for all site sections
      FAQAdmin.jsx/.css    # FAQ CRUD with reorder
      WorkoutAdmin.jsx/.css # Workout library CRUD + PDF preview
      Billing.jsx/.css     # Admin billing dashboard (stats, subscriptions, payments tabs)
      TierAdmin.jsx/.css   # Admin tier editor (edit 3 fixed tiers, syncs to Stripe)
      AuditLog.jsx/.css    # Admin audit log viewer
      Merch.jsx            # "Future phase" placeholder
      admin.css            # Shared admin styles
  hooks/
    useContent.js      # Fetch content section with in-memory cache
    useFaq.js          # Fetch FAQ list with in-memory cache
    useWorkouts.js     # Fetch workout library with in-memory cache
    useTiers.js        # Fetch tiers from API with in-memory cache, falls back to hardcoded TIERS
    useLazyImage.js    # Image load state hook
    useScrollReveal.js # IntersectionObserver hook
  utils/
    tiers.js           # Tier constants (TIERS), tierRank(), hasTierAccess(), getRequiredTierInfo()
  styles/
    variables.css      # CSS custom properties (colors, shadows)
    global.css         # Global styles, button classes, section layout
infra/                 # AWS CDK infrastructure (TypeScript)
  bin/infra.ts         # CDK app entry point — loads .env.local via dotenv, validates Google OAuth creds
  lib/
    cognito-stack.ts   # Cognito User Pool, Groups, App Client, Google OAuth, Lambda triggers
    backend-stack.ts   # DynamoDB (with GSI1), S3, API Gateway, Lambda API, Stripe env vars
  lambda/
    pre-signup/index.ts        # Google account linking + duplicate email prevention
    post-confirmation/index.ts # Auto-assigns users to Client group
    custom-message/index.ts    # Branded HTML emails (verification, invitation, forgot-password)
    api/
      index.ts         # Lambda entry point with route dispatcher
      routes/
        faq.ts         # FAQ CRUD + reorder handlers
        content.ts     # Content get/put handlers
        users.ts       # Cognito user list + group management
        upload.ts      # S3 pre-signed URL generator
        workouts.ts    # Workout library CRUD handlers
        tiers.ts       # Tier GET (public) + PUT (admin, syncs to Stripe)
        stripe.ts      # Stripe checkout, portal, subscription, cancel handlers
        stripe-webhook.ts # Stripe webhook (signature verification, event handling)
        billing.ts     # Admin billing stats, subscriptions, payments queries
      utils/
        response.ts    # Shared HTTP response helpers
        auth.ts        # Extract/validate Cognito claims
  scripts/
    seed-content.ts    # Seed DynamoDB with content from JSON files
    seed-tiers.ts      # Seed 3 tiers into DynamoDB + create/link Stripe Products/Prices
    seed-data/         # JSON seed files (faq, hero, dassie, method, workouts, programs, testimonials, getstarted)
  package.json         # CDK + Lambda dependencies (includes stripe, dotenv)
  tsconfig.json        # TypeScript config
  cdk.json             # CDK app config
public/
  img/                 # All site images (25 files)
```

## Backend Architecture

### DynamoDB Table (`HyraxContent`)
Single-table design with PK/SK pattern, PAY_PER_REQUEST billing. GSI1 (gsi1pk/gsi1sk) enables cross-user queries for subscriptions, payments, and tiers.

| PK | SK | GSI1PK | GSI1SK | Use |
|----|-----|--------|--------|-----|
| `FAQ` | `FAQ#001` | — | — | FAQ item (id, q, a, sortOrder) |
| `CONTENT` | `hero` | — | — | Hero section data |
| `CONTENT` | `dassie` | — | — | Dassie section data |
| `CONTENT` | `method` | — | — | Method section data |
| `CONTENT` | `workouts` | — | — | Workouts section data |
| `CONTENT` | `programs` | — | — | Programs section data |
| `CONTENT` | `testimonials` | — | — | Testimonials data |
| `CONTENT` | `getstarted` | — | — | Get Started section data |
| `WORKOUT` | `WORKOUT#<id>` | — | — | Workout item (title, description, category, difficulty, duration, equipment[], exercises[], imageUrl, status, sortOrder) |
| `USER#<sub>` | `PROFILE` | — | — | User profile (email, givenName, familyName, tier, source, createdAt) |
| `TIER` | `TIER#<id>` | `TIER` | `<sortOrder>` | Tier config (name, level, description, price, priceInCents, features[], stripeProductId, stripePriceId, sortOrder) |
| `USER#<sub>` | `SUBSCRIPTION` | `SUBSCRIPTION` | `<status>#<sub>` | Active subscription (stripeCustomerId, stripeSubscriptionId, tierId, status, currentPeriodEnd, cancelAtPeriodEnd) |
| `USER#<sub>` | `PAYMENT#<ts>#<id>` | `PAYMENT` | `<ts>#<sub>` | Payment record (stripeInvoiceId, amount, currency, status, paidAt, invoiceUrl, tierName) |
| `STRIPE_CUSTOMER` | `<stripeCustomerId>` | — | — | Reverse lookup: Stripe customer ID → Cognito sub |

### API Routes (API Gateway + Lambda)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/faq` | Public | List all FAQ items (sorted) |
| `POST` | `/api/faq` | Admin | Create FAQ item |
| `PUT` | `/api/faq/{id}` | Admin | Update FAQ item |
| `DELETE` | `/api/faq/{id}` | Admin | Delete FAQ item |
| `PUT` | `/api/faq/reorder` | Admin | Batch update sortOrder |
| `GET` | `/api/content/{section}` | Public | Get content section |
| `PUT` | `/api/content/{section}` | Admin | Update content section |
| `GET` | `/api/users` | Admin | List Cognito users |
| `GET` | `/api/users/{username}/groups` | Admin | Get user's groups |
| `PUT` | `/api/users/{username}/groups` | Admin | Update user's groups |
| `POST` | `/api/upload` | Admin | Get S3 pre-signed upload URL |
| `GET` | `/api/workouts` | Public | List workouts (published only; admin sees all) |
| `GET` | `/api/workouts/{id}` | Public | Get single workout (published only; admin sees all) |
| `POST` | `/api/workouts` | Admin | Create workout |
| `PUT` | `/api/workouts/{id}` | Admin | Update workout |
| `DELETE` | `/api/workouts/{id}` | Admin | Delete workout |
| `GET` | `/api/profile` | Authenticated | Get current user's profile |
| `POST` | `/api/profile` | Authenticated | Create profile (Google users) |
| `PUT` | `/api/profile` | Authenticated | Update profile (name fields) |
| `GET` | `/api/tiers` | Public | List all tiers sorted by sortOrder |
| `PUT` | `/api/tiers/{id}` | Admin | Update tier (name, description, price, features; syncs to Stripe) |
| `GET` | `/api/stripe/config` | Public | Returns Stripe publishable key |
| `POST` | `/api/stripe/webhook` | Public | Stripe webhook (signature-verified, handles checkout/subscription/invoice events) |
| `GET` | `/api/stripe/subscription` | Authenticated | Get current user's subscription |
| `POST` | `/api/stripe/create-checkout-session` | Authenticated | Create Stripe Checkout session for tier upgrade |
| `POST` | `/api/stripe/create-portal-session` | Authenticated | Create Stripe Billing Portal session |
| `POST` | `/api/stripe/cancel-subscription` | Authenticated | Cancel subscription at period end |
| `GET` | `/api/admin/billing/stats` | Admin | Billing stats (active subscribers, MRR, revenue, churn) |
| `GET` | `/api/admin/billing/subscriptions` | Admin | List all subscriptions with user info |
| `GET` | `/api/admin/billing/payments` | Admin | List all payments |
| `GET` | `/api/admin/billing/payments/{userSub}` | Admin | User-specific payment history |

### Content Data Pattern
Public components use `useContent(section)` hook which fetches from `/api/content/{section}`. All components keep hardcoded fallback data so the site works even if the API is unreachable. The hook has an in-memory cache to avoid re-fetching within the same session.

### S3 Media Bucket
- Bucket: `hyrax-fitness-media-867259842081` (private, CORS configured)
- CDN: `d1wvxliaq9snov.cloudfront.net`
- Admin uploads images via pre-signed URLs from `/api/upload`
- Uploaded files go under `uploads/` prefix with UUID keys

## Stripe Subscription System

### Tier Hierarchy
- **Pup** (Level 1, Free) — No Stripe subscription, basic access
- **Rock Runner** (Level 2, $5/mo) — Stripe Product: `prod_UAWrfzLkyrpYwe`, Price: `price_1TCBnoGymHmmAGZQWQZ5o2Bv`
- **Iron Dassie** (Level 3, $20/mo) — Stripe Product: `prod_UAWxOiFJWRo4A2`, Price: `price_1TCBtoGymHmmAGZQAqOVA79q`

### Subscription Logic
- **Upgrades**: Immediate with proration (Stripe updates subscription inline)
- **Downgrades**: Keep current tier until billing period end
- **Downgrade to Pup**: Cancels Stripe subscription at period end
- **Tier CMS**: Admin can edit names, prices, descriptions, features for existing 3 tiers (no add/remove)
- **Price changes**: Creates new Stripe Price (Stripe Prices are immutable); existing subscribers keep current rate

### Stripe Webhook Events Handled
- `checkout.session.completed` — Creates/updates subscription, updates profile tier
- `customer.subscription.updated` — Syncs status, period end, cancel-at-period-end
- `customer.subscription.deleted` — Reverts profile tier to Pup
- `invoice.payment_succeeded` — Records payment with amount/invoice URL
- `invoice.payment_failed` — Records failed payment

### Stripe Webhook URL
`https://qe1jdbuidl.execute-api.us-east-1.amazonaws.com/prod/api/stripe/webhook`

### Stripe Test Mode
- Currently in **sandbox/test mode** (`sk_test_*` keys)
- Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 0341` (decline)

### Tier Gating
Workout content is gated by tier level. `src/utils/tiers.js` provides `hasTierAccess(userTier, requiredTier)` for access checks. The `useTiers` hook fetches dynamic tier data from the API with hardcoded fallback.

## Routing Architecture
- **`/`** (Home): Hero -> Dassie -> Method -> Workouts -> Testimonials -> GetStarted
- **`/programs`**: Programs page (3 pricing tiers, dynamic from API)
- **`/gallery`**: Photo gallery page
- **`/faq`**: FAQ page (API-driven)
- **`/get-started`**: Intake wizard (onboarding questionnaire)
- **`/login`**: Sign-in page
- **`/register`**: Registration page
- **`/confirm`**: Email verification code page
- **`/terms`**: Terms of use
- **`/privacy`**: Privacy policy
- **`/cookies`**: Cookie policy
- **`/portal`**: Client portal dashboard (authenticated, sidebar layout)
- **`/portal/workouts`**: Workout library (browse workouts, auth-gated)
- **`/portal/workouts/:id`**: Single workout detail + PDF download
- **`/portal/profile`**: Edit user profile (name)
- **`/portal/subscription`**: Subscription management (upgrade/downgrade/cancel via Stripe)
- **`/portal/settings`**: Notification preferences (placeholder)
- **`/admin`**: Admin dashboard with live stats + workout count
- **`/admin/users`**: User management (search, group toggles)
- **`/admin/users/:username`**: Individual user profile
- **`/admin/content`**: Content CMS (tabbed editor for all sections)
- **`/admin/faq`**: FAQ manager (CRUD + reorder)
- **`/admin/workouts`**: Workout library manager (CRUD + PDF preview)
- **`/admin/billing`**: Billing dashboard (stats, subscriptions tab, payments tab)
- **`/admin/tiers`**: Tier editor (edit names, prices, descriptions, features for 3 fixed tiers)
- **`/admin/merch`**: Merchandise manager (future phase)
- **`/admin/audit`**: Audit log viewer

### Navigation Pattern
- Page routes use `<Link to="/programs">` from react-router-dom
- Home page section links use `<Link to="/#method">` (hash-based scroll)
- `ScrollManager` component in App.jsx handles:
  - Scrolling to hash targets when navigating (e.g., `/#method`)
  - Scrolling to top when navigating to a new page without hash
- SPA rewrite rule in Amplify ensures all routes serve `index.html`

### Auth-Aware Navigation
- Header CTA changes: "Sign In" when logged out, "Sign Out" when logged in
- "Portal" nav link appears for authenticated users
- "Admin" nav link only appears for users in the Admin Cognito group
- `/portal/*` routes are protected by `ProtectedRoute` (any authenticated user)
- `/admin/*` routes are protected by `ProtectedRoute` requiring Admin group
- Unauthenticated users redirected to `/login`
- Non-admin users redirected to `/` from admin routes
- Workouts nav link points to `/portal/workouts` (requires auth)

## Authentication Architecture
- **Provider**: Amazon Cognito User Pool (`hyrax-fitness-users`)
- **Sign-in**: Email + password (SRP auth flow) + Google OAuth (federated)
- **Google OAuth**: Configured in `cognito-stack.ts` with `UserPoolIdentityProviderGoogle`
- **Cognito Hosted UI Domain**: `hyrax-fitness.auth.us-east-1.amazoncognito.com`
- **Groups**: Admin (precedence 0), Client (precedence 10)
- **Pre-signup Lambda**: Google account linking + duplicate email prevention
- **Post-confirmation Lambda**: Auto-assigns new users to Client group
- **Custom Message Lambda**: Branded HTML emails for verification, invitation, forgot-password
- **Frontend**: aws-amplify v6, React Context (AuthContext)
- **Token Groups**: Extracted from `cognito:groups` claim in access token
- **API Auth**: ID token passed as `Authorization` header for protected API routes
- **refreshTier**: Function in AuthContext that re-fetches profile and updates `userTier` (called after checkout return)

### Environment Variables

#### Vite (Frontend) — `.env.local` / Amplify Console
- `VITE_COGNITO_USER_POOL_ID` - Cognito User Pool ID (`us-east-1_0HsevMn8s`)
- `VITE_COGNITO_CLIENT_ID` - Cognito App Client ID (`774n5lv7klqfuaf25ork04f8op`)
- `VITE_AWS_REGION` - AWS Region (`us-east-1`)
- `VITE_API_URL` - API Gateway base URL (`https://qe1jdbuidl.execute-api.us-east-1.amazonaws.com/prod`)
- `VITE_COGNITO_DOMAIN` - Cognito hosted UI domain
- `VITE_OAUTH_REDIRECT` - OAuth redirect URL

#### CDK / Lambda — `.env.local` (loaded by dotenv in `infra/bin/infra.ts`)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID (used by Cognito stack)
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret (used by Cognito stack)
- `STRIPE_SECRET_KEY` - Stripe secret key (`sk_test_...`, Lambda env var)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret (`whsec_...`, Lambda env var)
- `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key (`pk_test_...`, Lambda env var, also served via `/api/stripe/config`)

**Note**: `infra/bin/infra.ts` uses `dotenv` to auto-load all env vars from the project root's `.env.local`. Both Google OAuth and Stripe credentials are read from this file during `cdk deploy`.

## Design System
- **Colors**: `--ink` (#1B120A), `--paper` (#FBF7E6), `--sand` (#D3BF97), `--rock` (#A48051), `--earth` (#654C2B), `--sunset` (#F28501 - primary), `--sunrise` (#FDB90F)
- **Radius**: 18px default
- **Shadows**: `--shadow` (strong), `--shadow-soft` (subtle)
- **Font**: System UI stack

## Commands
```bash
npm run dev      # Start dev server (port 5173)
npm run build    # Production build to dist/
npm run preview  # Preview production build locally

# CDK commands (from infra/ directory)
cd infra && npx cdk synth                                                    # Synthesize both stacks
cd infra && MSYS_NO_PATHCONV=1 npx cdk deploy --all --profile hyrax-fitness  # Deploy all stacks
cd infra && MSYS_NO_PATHCONV=1 npx cdk diff --profile hyrax-fitness          # Preview changes

# Seed DynamoDB with content
cd infra && MSYS_NO_PATHCONV=1 npx tsx scripts/seed-content.ts --profile hyrax-fitness

# Seed tiers (only needed once — creates 3 tiers in DynamoDB with Stripe Product/Price IDs)
cd infra && MSYS_NO_PATHCONV=1 npx tsx scripts/seed-tiers.ts --profile hyrax-fitness
```

## CDK Stacks
1. **HyraxFitnessCognito** - Cognito User Pool, Groups, Google OAuth, App Client, pre-signup/post-confirmation/custom-message Lambda triggers
2. **HyraxFitnessBackend** - DynamoDB table (with GSI1), S3 bucket, CloudFront CDN, API Gateway (40+ routes), Lambda API (with Stripe SDK)

### CDK Environment Loading
`infra/bin/infra.ts` uses `dotenv` to load `.env.local` from the project root. This provides:
- Google OAuth credentials for the Cognito stack
- Stripe keys for the Backend stack's Lambda environment variables
- A validation guard throws a clear error if `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` are missing

### Lambda Permission Strategy
The API Gateway integration uses an imported function reference (`fromFunctionArn`) instead of the real Lambda construct. This prevents CDK from creating per-method `AWS::Lambda::Permission` resources (which would exceed the 20KB resource-based policy limit). A single broad permission (`api.arnForExecuteApi('*', '/*', '*')`) grants API Gateway invoke access to all routes.

## Deployment
- **Hosting**: AWS Amplify
- **App ID**: d2lx0kagzo4fyv
- **Region**: us-east-1
- **Default URL**: https://master.d2lx0kagzo4fyv.amplifyapp.com
- **Custom Domain**: https://hyraxfitness.com (+ www.hyraxfitness.com)
- **Branch**: master (auto-build on push)
- **Build Spec**: npm ci -> npm run build -> dist/**/*

## AWS Configuration
- **AWS CLI Profile**: `hyrax-fitness`
- **IAM User**: hyraxfitness-admin
- **Permissions**: AdministratorAccess-Amplify, AmazonRoute53FullAccess, HyraxCDKDeployPolicy
- **Account ID**: 867259842081
- **DNS**: Route53 Hosted Zone Z0983470RKHLQIR2UU8U

### Useful AWS Commands
```bash
# Check build status
MSYS_NO_PATHCONV=1 aws amplify list-jobs --app-id d2lx0kagzo4fyv --branch-name master --profile hyrax-fitness

# Check domain status
MSYS_NO_PATHCONV=1 aws amplify get-domain-association --app-id d2lx0kagzo4fyv --domain-name hyraxfitness.com --profile hyrax-fitness

# Trigger a new build
MSYS_NO_PATHCONV=1 aws amplify start-job --app-id d2lx0kagzo4fyv --branch-name master --job-type RELEASE --profile hyrax-fitness

# Create admin user (after CDK deploy)
MSYS_NO_PATHCONV=1 aws cognito-idp admin-create-user --user-pool-id us-east-1_0HsevMn8s --username admin@hyraxfitness.com --user-attributes Name=email,Value=admin@hyraxfitness.com Name=email_verified,Value=true --temporary-password "TempPass123!" --profile hyrax-fitness
MSYS_NO_PATHCONV=1 aws cognito-idp admin-add-user-to-group --user-pool-id us-east-1_0HsevMn8s --username admin@hyraxfitness.com --group-name Admin --profile hyrax-fitness
```

Note: On Windows with Git Bash, always prefix AWS CLI commands with `MSYS_NO_PATHCONV=1` to prevent path mangling of arguments that start with `/`.

## GitHub Repository
- **URL**: https://github.com/Ridil86/hyrax-fitness-website
- **Account**: Ridil86

## Content Sections

### Home Page (`/`)
1. **Hero** - Full-screen with logo, tagline, "Get Started" CTA, and stats
2. **Dassie** - "Why the Hyrax?" section about the rock hyrax (the dassie) and why it inspires the training system
3. **Method** - 5 training modules (Bask & Prime, Scramble, Forage & Haul, Sentinel, Bolt to Cover)
4. **Workouts** - 3 signature formats (Outcrop Circuit, Bolt Ladder, Colony Session) + Outcrop Challenge
5. **Testimonials** - 3 athlete quotes
6. **Get Started** - Intake flow CTA + class format and event cards

### Programs Page (`/programs`)
- 3 tiers: Pup (Free), Rock Runner ($5/mo), Iron Dassie ($20/mo)
- Tier data fetched dynamically from `/api/tiers` via `useTiers` hook (hardcoded fallback)
- Comparison chart with feature breakdown across all tiers
- Events section with hosting info (events@hyraxfitness.com)
- Each tier has CTA button (links to `/portal/subscription` for authenticated users)

### Gallery Page (`/gallery`)
- 5-image masonry grid

### FAQ Page (`/faq`)
- API-driven animated accordion
- Covers: getting started, who it's for, progression, plan differences, limitations, cancellation

## Key Features
- Multi-page SPA with React Router (BrowserRouter)
- Cognito authentication with email/password + Google OAuth and RBAC (Admin/Client groups)
- Stripe subscription billing with Checkout Sessions, Customer Portal, and webhook sync
- Tier-gated workout content (Pup/Rock Runner/Iron Dassie access levels)
- Admin billing dashboard with live stats (active subscribers, MRR, revenue, churn)
- Admin tier CMS (edit 3 fixed tiers, price changes create new Stripe Prices)
- API-driven content with DynamoDB storage and in-memory caching
- Admin dashboard with live stats, quick links
- Admin FAQ Manager with CRUD and drag-to-reorder
- Admin Content CMS with tabbed editors for all site sections
- Admin User Management with search, group assignment
- Admin Audit Log viewer
- S3 image uploads from Content CMS via pre-signed URLs
- Lazy-loaded pages/sections via React.lazy() + Suspense
- Lazy-loaded images via IntersectionObserver
- Scroll-reveal animations via Framer Motion
- ScrollManager for hash-based navigation across pages
- Animated mobile menu with hamburger-to-X transform
- Interactive FAQ accordion with smooth open/close
- Responsive: desktop, tablet, and mobile layouts
- SPA rewrite rule configured in Amplify for client-side routing
- GDPR cookie consent banner
- Legal pages (Terms of Use, Privacy Policy, Cookie Policy)

## Future Work
- SES for production email (verification, notifications)
- Merchandise management in admin dashboard
- Stripe production mode (switch from test to live keys)
- Advanced analytics and reporting in admin dashboard
