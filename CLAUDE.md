# Hyrax Fitness Website

## Project Overview
Hyrax Fitness is a start-stop, scramble-and-carry training system inspired by the rock hyrax. This is the marketing/landing website built with React + Vite, with Cognito-based authentication, an admin dashboard with CMS, FAQ manager, and user management.

## Tech Stack
- **Framework**: React 19 + Vite 8
- **Routing**: react-router-dom (BrowserRouter)
- **Animations**: Framer Motion
- **Scroll Detection**: react-intersection-observer
- **Auth**: AWS Cognito (via aws-amplify v6)
- **Backend API**: API Gateway (REST) + Lambda (Node.js)
- **Database**: DynamoDB (single-table design)
- **Storage**: S3 (admin image uploads via pre-signed URLs)
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
    AuthContext.jsx    # React context: user state, groups, sign-in/up/out, getIdToken
  api/
    client.js          # Base fetch wrapper (apiGet, apiPost, apiPut, apiDelete)
    faq.js             # FAQ API functions (list, create, update, delete, reorder)
    content.js         # Content API functions (get section, update section)
    users.js           # Users API functions (list, getGroups, updateGroups)
    upload.js          # S3 upload functions (getPresignedUrl, uploadFile)
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
  pages/
    Login.jsx          # Email/password sign-in (handles NEW_PASSWORD_REQUIRED challenge)
    Register.jsx       # Registration with name, email, password
    ConfirmSignUp.jsx  # 6-digit verification code entry
    WorkoutLibrary.jsx # Browse workout library (within portal)
    WorkoutDetail.jsx  # Single workout detail + PDF download
    auth.css           # Shared auth page styles
    portal/
      PortalDashboard.jsx/.css  # Client portal home with profile card + quick links
      PortalProfile.jsx/.css    # Edit user name, view email
      PortalSettings.jsx/.css   # Notification preferences (placeholder)
    admin/
      Dashboard.jsx/.css   # Live stats (user, FAQ, workout counts) + quick links
      Users.jsx/.css       # Cognito user list, search, group management
      Content.jsx/.css     # Tabbed content CMS for all site sections
      FAQAdmin.jsx/.css    # FAQ CRUD with reorder
      WorkoutAdmin.jsx/.css # Workout library CRUD + PDF preview
      Merch.jsx            # "Future phase" placeholder
      admin.css            # Shared admin styles
  hooks/
    useContent.js      # Fetch content section with in-memory cache
    useFaq.js          # Fetch FAQ list with in-memory cache
    useWorkouts.js     # Fetch workout library with in-memory cache
    useLazyImage.js    # Image load state hook
    useScrollReveal.js # IntersectionObserver hook
  styles/
    variables.css      # CSS custom properties (colors, shadows)
    global.css         # Global styles, button classes, section layout
infra/                 # AWS CDK infrastructure (TypeScript)
  bin/infra.ts         # CDK app entry point (CognitoStack + BackendStack)
  lib/
    cognito-stack.ts   # Cognito User Pool, Groups, App Client, Lambda trigger
    backend-stack.ts   # DynamoDB, S3, API Gateway, Lambda API
  lambda/
    post-confirmation/index.ts  # Auto-assigns users to Client group
    api/
      index.ts         # Lambda entry point with route dispatcher
      routes/
        faq.ts         # FAQ CRUD + reorder handlers
        content.ts     # Content get/put handlers
        users.ts       # Cognito user list + group management
        upload.ts      # S3 pre-signed URL generator
        workouts.ts    # Workout library CRUD handlers
      utils/
        response.ts    # Shared HTTP response helpers
        auth.ts        # Extract/validate Cognito claims
  scripts/
    seed-content.ts    # Seed DynamoDB with content from JSON files
    seed-data/         # JSON seed files (faq, hero, dassie, method, workouts, programs, testimonials, getstarted)
  package.json         # CDK + Lambda dependencies
  tsconfig.json        # TypeScript config
  cdk.json             # CDK app config
public/
  img/                 # All site images (25 files)
```

## Backend Architecture

### DynamoDB Table (`HyraxContent`)
Single-table design with PK/SK pattern, PAY_PER_REQUEST billing.

| PK | SK | Use |
|----|-----|-----|
| `FAQ` | `FAQ#001` | FAQ item (id, q, a, sortOrder) |
| `CONTENT` | `hero` | Hero section data |
| `CONTENT` | `dassie` | Dassie section data |
| `CONTENT` | `method` | Method section data |
| `CONTENT` | `workouts` | Workouts section data |
| `CONTENT` | `programs` | Programs section data |
| `CONTENT` | `testimonials` | Testimonials data |
| `CONTENT` | `getstarted` | Get Started section data |
| `WORKOUT` | `WORKOUT#<id>` | Workout item (title, description, category, difficulty, duration, equipment[], exercises[], imageUrl, status, sortOrder) |
| `USER#<sub>` | `PROFILE` | User profile (email, givenName, familyName, tier, source, createdAt) |

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

### Content Data Pattern
Public components use `useContent(section)` hook which fetches from `/api/content/{section}`. All components keep hardcoded fallback data so the site works even if the API is unreachable. The hook has an in-memory cache to avoid re-fetching within the same session.

### S3 Media Bucket
- Bucket: `hyrax-fitness-media-{account}` (private, CORS configured)
- Admin uploads images via pre-signed URLs from `/api/upload`
- Uploaded files go under `uploads/` prefix with UUID keys

## Routing Architecture
- **`/`** (Home): Hero -> Dassie -> Method -> Workouts -> Testimonials -> GetStarted
- **`/programs`**: Programs page (3 pricing tiers)
- **`/gallery`**: Photo gallery page
- **`/faq`**: FAQ page (API-driven)
- **`/login`**: Sign-in page
- **`/register`**: Registration page
- **`/confirm`**: Email verification code page
- **`/portal`**: Client portal dashboard (authenticated, sidebar layout)
- **`/portal/workouts`**: Workout library (browse workouts, auth-gated)
- **`/portal/workouts/:id`**: Single workout detail + PDF download
- **`/portal/profile`**: Edit user profile (name)
- **`/portal/settings`**: Notification preferences (placeholder)
- **`/admin`**: Admin dashboard with live stats + workout count
- **`/admin/users`**: User management (search, group toggles)
- **`/admin/content`**: Content CMS (tabbed editor for all sections)
- **`/admin/faq`**: FAQ manager (CRUD + reorder)
- **`/admin/workouts`**: Workout library manager (CRUD + PDF preview)
- **`/admin/merch`**: Merchandise manager (future phase)

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
- **Sign-in**: Email + password (SRP auth flow)
- **Groups**: Admin (precedence 0), Client (precedence 10)
- **Post-confirmation Lambda**: Auto-assigns new users to Client group
- **Frontend**: aws-amplify v6, React Context (AuthContext)
- **Token Groups**: Extracted from `cognito:groups` claim in access token
- **API Auth**: ID token passed as `Authorization` header for admin API routes

### Environment Variables (Vite)
- `VITE_COGNITO_USER_POOL_ID` - Cognito User Pool ID
- `VITE_COGNITO_CLIENT_ID` - Cognito App Client ID
- `VITE_AWS_REGION` - AWS Region (us-east-1)
- `VITE_API_URL` - API Gateway base URL (https://qe1jdbuidl.execute-api.us-east-1.amazonaws.com/prod)
- Local dev: `.env.local` (gitignored), Production: Amplify Console env vars

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
```

## CDK Stacks
1. **HyraxFitnessCognito** - Cognito User Pool, Groups, App Client, post-confirmation Lambda
2. **HyraxFitnessBackend** - DynamoDB table, S3 bucket, API Gateway, Lambda API

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
MSYS_NO_PATHCONV=1 aws cognito-idp admin-create-user --user-pool-id <POOL_ID> --username admin@hyraxfitness.com --user-attributes Name=email,Value=admin@hyraxfitness.com Name=email_verified,Value=true --temporary-password "TempPass123!" --profile hyrax-fitness
MSYS_NO_PATHCONV=1 aws cognito-idp admin-add-user-to-group --user-pool-id <POOL_ID> --username admin@hyraxfitness.com --group-name Admin --profile hyrax-fitness
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
- Comparison chart with feature breakdown across all tiers
- Events section with hosting info (events@hyraxfitness.com)
- Each tier has "Get Started" button linking to intake flow

### Gallery Page (`/gallery`)
- 5-image masonry grid

### FAQ Page (`/faq`)
- API-driven animated accordion
- Covers: getting started, who it's for, progression, plan differences, limitations, cancellation

## Key Features
- Multi-page SPA with React Router (BrowserRouter)
- Cognito authentication with email/password and RBAC (Admin/Client groups)
- API-driven content with DynamoDB storage and in-memory caching
- Admin dashboard with live stats, quick links
- Admin FAQ Manager with CRUD and drag-to-reorder
- Admin Content CMS with tabbed editors for all site sections
- Admin User Management with search, group assignment
- S3 image uploads from Content CMS via pre-signed URLs
- Lazy-loaded pages/sections via React.lazy() + Suspense
- Lazy-loaded images via IntersectionObserver
- Scroll-reveal animations via Framer Motion
- ScrollManager for hash-based navigation across pages
- Animated mobile menu with hamburger-to-X transform
- Interactive FAQ accordion with smooth open/close
- Responsive: desktop, tablet, and mobile layouts
- SPA rewrite rule configured in Amplify for client-side routing

## Phase 2 Deployment Steps
Before deploying Phase 2 backend:

1. **Update IAM Policy**: Add DynamoDB, S3, and API Gateway permissions to `HyraxCDKDeployPolicy` on `hyraxfitness-admin`
2. **CDK Deploy**: `cd infra && MSYS_NO_PATHCONV=1 npx cdk deploy --all --profile hyrax-fitness`
3. **Seed DynamoDB**: `cd infra && MSYS_NO_PATHCONV=1 npx tsx scripts/seed-content.ts --profile hyrax-fitness`
4. **Set VITE_API_URL**: Add the API Gateway URL (from CDK output) as env var in Amplify Console
5. **Trigger Build**: Commit and push to master, or trigger manually via Amplify

## Future Work
- SES for production email (verification, notifications)
- Merchandise management in admin dashboard
- Intake questionnaire flow (health, activity level, age, sex, diet)
- Connect program tier CTAs to intake system
- Federated login (Google, Facebook)
