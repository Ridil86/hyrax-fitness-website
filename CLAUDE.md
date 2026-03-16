# Hyrax Fitness Website

## Project Overview
Hyrax Fitness is a start-stop, scramble-and-carry training system inspired by the rock hyrax. This is the marketing/landing website built with React + Vite, with Cognito-based authentication and an admin dashboard.

## Tech Stack
- **Framework**: React 19 + Vite 8
- **Routing**: react-router-dom (BrowserRouter)
- **Animations**: Framer Motion
- **Scroll Detection**: react-intersection-observer
- **Auth**: AWS Cognito (via aws-amplify v6)
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
    AuthContext.jsx    # React context: user state, groups, sign-in/up/out
  components/
    Header.jsx/.css    # Sticky nav with auth-aware CTA (Sign In / Sign Out / Admin link)
    Hero.jsx/.css      # Full-screen hero with animated entrance
    Method.jsx/.css    # 5 training modules grid
    Workouts.jsx/.css  # Signature workouts cards
    Dassie.jsx/.css    # "Why the Hyrax?" section about the rock hyrax / dassie
    Programs.jsx/.css  # 3-tier pricing page (Pup, Rock Runner, Iron Dassie) + comparison chart + events
    Gallery.jsx/.css   # Photo gallery page
    Testimonials.jsx/.css  # 3 testimonial cards
    FAQ.jsx/.css       # 10-question animated accordion page
    GetStarted.jsx/.css    # CTA for intake flow + class format and event cards
    Footer.jsx/.css    # Footer with route-aware links
    LazyImage.jsx      # Intersection-observer lazy image loader
    ScrollReveal.jsx   # Framer Motion scroll-reveal wrapper
    ProtectedRoute.jsx # Route guard checking auth + group membership
    AdminLayout.jsx/.css   # Admin sidebar nav + Outlet wrapper
  pages/
    Login.jsx          # Email/password sign-in (handles NEW_PASSWORD_REQUIRED challenge)
    Register.jsx       # Registration with name, email, password
    ConfirmSignUp.jsx  # 6-digit verification code entry
    auth.css           # Shared auth page styles
    admin/
      Dashboard.jsx    # Stats placeholder cards
      Users.jsx        # "Coming in Phase 2" placeholder
      Content.jsx      # "Coming in Phase 2" placeholder
      FAQAdmin.jsx     # "Coming in Phase 2" placeholder
      Merch.jsx        # "Coming in Phase 2" placeholder
      admin.css        # Shared admin styles
  hooks/
    useLazyImage.js    # Image load state hook
    useScrollReveal.js # IntersectionObserver hook
  styles/
    variables.css      # CSS custom properties (colors, shadows)
    global.css         # Global styles, button classes, section layout
infra/                 # AWS CDK infrastructure (TypeScript)
  bin/infra.ts         # CDK app entry point
  lib/cognito-stack.ts # Cognito User Pool, Groups, App Client, Lambda trigger
  lambda/post-confirmation/index.ts  # Auto-assigns users to Client group
  package.json         # CDK dependencies
  tsconfig.json        # TypeScript config
  cdk.json             # CDK app config
public/
  img/                 # All site images (25 files)
```

## Routing Architecture
- **`/`** (Home): Hero -> Dassie -> Method -> Workouts -> Testimonials -> GetStarted
- **`/programs`**: Programs page (3 pricing tiers)
- **`/gallery`**: Photo gallery page
- **`/faq`**: FAQ page (10 Q&As)
- **`/login`**: Sign-in page
- **`/register`**: Registration page
- **`/confirm`**: Email verification code page
- **`/admin`**: Admin dashboard (protected, requires Admin group)
- **`/admin/users`**: User management (Phase 2)
- **`/admin/content`**: CMS (Phase 2)
- **`/admin/faq`**: FAQ manager (Phase 2)
- **`/admin/merch`**: Merchandise manager (Phase 2)

### Navigation Pattern
- Page routes use `<Link to="/programs">` from react-router-dom
- Home page section links use `<Link to="/#method">` (hash-based scroll)
- `ScrollManager` component in App.jsx handles:
  - Scrolling to hash targets when navigating (e.g., `/#method`)
  - Scrolling to top when navigating to a new page without hash
- SPA rewrite rule in Amplify ensures all routes serve `index.html`

### Auth-Aware Navigation
- Header CTA changes: "Sign In" when logged out, "Sign Out" when logged in
- "Admin" nav link only appears for users in the Admin Cognito group
- `/admin/*` routes are protected by `ProtectedRoute` requiring Admin group
- Unauthenticated users redirected to `/login`
- Non-admin users redirected to `/` from admin routes

## Authentication Architecture
- **Provider**: Amazon Cognito User Pool (`hyrax-fitness-users`)
- **Sign-in**: Email + password (SRP auth flow)
- **Groups**: Admin (precedence 0), Client (precedence 10)
- **Post-confirmation Lambda**: Auto-assigns new users to Client group
- **Frontend**: aws-amplify v6, React Context (AuthContext)
- **Token Groups**: Extracted from `cognito:groups` claim in access token

### Environment Variables (Vite)
- `VITE_COGNITO_USER_POOL_ID` - Cognito User Pool ID
- `VITE_COGNITO_CLIENT_ID` - Cognito App Client ID
- `VITE_AWS_REGION` - AWS Region (us-east-1)
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
cd infra && npx cdk synth    # Synthesize CloudFormation template
cd infra && MSYS_NO_PATHCONV=1 npx cdk deploy --profile hyrax-fitness   # Deploy stack
cd infra && MSYS_NO_PATHCONV=1 npx cdk diff --profile hyrax-fitness     # Preview changes
```

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
- **CDK Stack**: HyraxFitnessCognito (Cognito User Pool + Lambda trigger)

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
3. **Workouts** - 3 signature formats (Outcrop Circuit, Bolt Ladder, Colony Session) + Outcrop Challenge
4. **Testimonials** - 3 athlete quotes
5. **Get Started** - Intake flow CTA + class format and event cards

### Programs Page (`/programs`)
- 3 tiers: Pup (Free), Rock Runner ($5/mo), Iron Dassie ($20/mo)
- Comparison chart with feature breakdown across all tiers
- Events section with hosting info (events@hyraxfitness.com)
- Each tier has "Get Started" button linking to intake flow

### Gallery Page (`/gallery`)
- 5-image masonry grid

### FAQ Page (`/faq`)
- 10 questions with animated accordion
- Covers: getting started, who it's for, progression, plan differences, limitations, cancellation

## Key Features
- Multi-page SPA with React Router (BrowserRouter)
- Cognito authentication with email/password and RBAC (Admin/Client groups)
- Admin dashboard with sidebar layout and nested routes
- Lazy-loaded pages/sections via React.lazy() + Suspense
- Lazy-loaded images via IntersectionObserver
- Scroll-reveal animations via Framer Motion
- ScrollManager for hash-based navigation across pages
- Animated mobile menu with hamburger-to-X transform
- Interactive FAQ accordion with smooth open/close
- Responsive: desktop, tablet, and mobile layouts
- SPA rewrite rule configured in Amplify for client-side routing

## Phase 2 (Future Work)
- DynamoDB for storing site content, user data, FAQ, merchandise
- S3 bucket for media/content library
- SES for production email (verification, notifications)
- Admin CMS tools: edit site content, manage FAQ, manage merchandise
- User management in admin dashboard
- Intake questionnaire flow (health, activity level, age, sex, diet)
- Connect program tier CTAs to intake system
- Federated login (Google, Facebook)
