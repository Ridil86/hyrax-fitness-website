import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CookieConsentProvider } from './context/CookieConsentContext';
import Header from './components/Header';
import Hero from './components/Hero';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import GoogleOAuthHandler from './components/GoogleOAuthHandler';
import './styles/global.css';

const Dassie = lazy(() => import('./components/Dassie'));
const Method = lazy(() => import('./components/Method'));
const Workouts = lazy(() => import('./components/Workouts'));
const Testimonials = lazy(() => import('./components/Testimonials'));
const GetStarted = lazy(() => import('./components/GetStarted'));
const Programs = lazy(() => import('./components/Programs'));
const Gallery = lazy(() => import('./components/Gallery'));
const FAQ = lazy(() => import('./components/FAQ'));

// Auth pages
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ConfirmSignUp = lazy(() => import('./pages/ConfirmSignUp'));

// Admin pages
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Users = lazy(() => import('./pages/admin/Users'));
const Content = lazy(() => import('./pages/admin/Content'));
const FAQAdmin = lazy(() => import('./pages/admin/FAQAdmin'));
const Merch = lazy(() => import('./pages/admin/Merch'));
const UserProfile = lazy(() => import('./pages/admin/UserProfile'));
const AuditLog = lazy(() => import('./pages/admin/AuditLog'));
const WorkoutAdmin = lazy(() => import('./pages/admin/WorkoutAdmin'));
const VideoAdmin = lazy(() => import('./pages/admin/VideoAdmin'));
const Billing = lazy(() => import('./pages/admin/Billing'));
const TierAdmin = lazy(() => import('./pages/admin/TierAdmin'));

// Workout library pages
const WorkoutLibrary = lazy(() => import('./pages/WorkoutLibrary'));
const WorkoutDetail = lazy(() => import('./pages/WorkoutDetail'));

// Video library pages
const VideoLibrary = lazy(() => import('./pages/portal/VideoLibrary'));
const VideoDetail = lazy(() => import('./pages/portal/VideoDetail'));

// Community pages
const Community = lazy(() => import('./pages/portal/Community'));
const CommunityThread = lazy(() => import('./pages/portal/CommunityThread'));
const CommunityNewThread = lazy(() => import('./pages/portal/CommunityNewThread'));
const CommunityAdmin = lazy(() => import('./pages/admin/CommunityAdmin'));

// Support pages
const SupportTickets = lazy(() => import('./pages/portal/SupportTickets'));
const SupportTicket = lazy(() => import('./pages/portal/SupportTicket'));
const NewSupportTicket = lazy(() => import('./pages/portal/NewSupportTicket'));
const SupportAdmin = lazy(() => import('./pages/admin/SupportAdmin'));

// Legal pages
const TermsOfUse = lazy(() => import('./pages/TermsOfUse'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const CookiePolicy = lazy(() => import('./pages/CookiePolicy'));

// Intake + Client portal
const IntakeWizard = lazy(() => import('./pages/IntakeWizard'));
const Welcome = lazy(() => import('./pages/Welcome'));
const PortalLayout = lazy(() => import('./components/PortalLayout'));
const PortalDashboard = lazy(() => import('./pages/portal/PortalDashboard'));
const PortalProfile = lazy(() => import('./pages/portal/PortalProfile'));
const PortalSettings = lazy(() => import('./pages/portal/PortalSettings'));
const PortalSubscription = lazy(() => import('./pages/portal/PortalSubscription'));

// Cookie consent
const CookieConsent = lazy(() => import('./components/CookieConsent'));

function SectionLoader() {
  return (
    <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="section-spinner" />
    </div>
  );
}

function LazySection({ children }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<SectionLoader />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function ScrollManager() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1);
      // Small delay lets lazy-loaded sections render before scrolling
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 120);
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.hash]);

  return null;
}

function HomePage() {
  return (
    <>
      <GoogleOAuthHandler />
      <Hero />
      <LazySection><Dassie /></LazySection>
      <LazySection><Method /></LazySection>
      <LazySection><Workouts /></LazySection>
      <LazySection><Testimonials /></LazySection>
      <LazySection><GetStarted /></LazySection>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CookieConsentProvider>
        <ScrollManager />
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/programs" element={<LazySection><Programs /></LazySection>} />
            <Route path="/gallery" element={<LazySection><Gallery /></LazySection>} />
            <Route path="/faq" element={<LazySection><FAQ /></LazySection>} />
            {/* Legal routes */}
            <Route path="/terms" element={<LazySection><TermsOfUse /></LazySection>} />
            <Route path="/privacy" element={<LazySection><PrivacyPolicy /></LazySection>} />
            <Route path="/cookie-policy" element={<LazySection><CookiePolicy /></LazySection>} />

            {/* Auth routes */}
            <Route path="/login" element={<LazySection><Login /></LazySection>} />
            <Route path="/register" element={<LazySection><Register /></LazySection>} />
            <Route path="/confirm" element={<LazySection><ConfirmSignUp /></LazySection>} />

            {/* Intake wizard + welcome */}
            <Route path="/get-started" element={<LazySection><IntakeWizard /></LazySection>} />
            <Route path="/welcome" element={<LazySection><Welcome /></LazySection>} />

            {/* Client portal (any authenticated user) */}
            <Route path="/portal" element={
              <ProtectedRoute>
                <LazySection><PortalLayout /></LazySection>
              </ProtectedRoute>
            }>
              <Route index element={<LazySection><PortalDashboard /></LazySection>} />
              <Route path="workouts" element={<LazySection><WorkoutLibrary /></LazySection>} />
              <Route path="workouts/:id" element={<LazySection><WorkoutDetail /></LazySection>} />
              <Route path="videos" element={<LazySection><VideoLibrary /></LazySection>} />
              <Route path="videos/:id" element={<LazySection><VideoDetail /></LazySection>} />
              <Route path="community" element={<LazySection><Community /></LazySection>} />
              <Route path="community/new" element={<LazySection><CommunityNewThread /></LazySection>} />
              <Route path="community/:id" element={<LazySection><CommunityThread /></LazySection>} />
              <Route path="support" element={<LazySection><SupportTickets /></LazySection>} />
              <Route path="support/new" element={<LazySection><NewSupportTicket /></LazySection>} />
              <Route path="support/:id" element={<LazySection><SupportTicket /></LazySection>} />
              <Route path="profile" element={<LazySection><PortalProfile /></LazySection>} />
              <Route path="subscription" element={<LazySection><PortalSubscription /></LazySection>} />
              <Route path="settings" element={<LazySection><PortalSettings /></LazySection>} />
            </Route>

            {/* Admin routes (protected, requires Admin group) */}
            <Route path="/admin" element={
              <ProtectedRoute requiredGroup="Admin">
                <LazySection><AdminLayout /></LazySection>
              </ProtectedRoute>
            }>
              <Route index element={<LazySection><Dashboard /></LazySection>} />
              <Route path="users" element={<LazySection><Users /></LazySection>} />
              <Route path="users/:username" element={<LazySection><UserProfile /></LazySection>} />
              <Route path="content" element={<LazySection><Content /></LazySection>} />
              <Route path="faq" element={<LazySection><FAQAdmin /></LazySection>} />
              <Route path="audit" element={<LazySection><AuditLog /></LazySection>} />
              <Route path="workouts" element={<LazySection><WorkoutAdmin /></LazySection>} />
              <Route path="videos" element={<LazySection><VideoAdmin /></LazySection>} />
              <Route path="billing" element={<LazySection><Billing /></LazySection>} />
              <Route path="tiers" element={<LazySection><TierAdmin /></LazySection>} />
              <Route path="community" element={<LazySection><CommunityAdmin /></LazySection>} />
              <Route path="support" element={<LazySection><SupportAdmin /></LazySection>} />
              <Route path="merch" element={<LazySection><Merch /></LazySection>} />
            </Route>
          </Routes>
        </main>
        <Footer />
        <Suspense fallback={null}><CookieConsent /></Suspense>
        </CookieConsentProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
