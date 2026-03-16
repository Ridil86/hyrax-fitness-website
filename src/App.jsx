import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Header';
import Hero from './components/Hero';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
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

function SectionLoader() {
  return (
    <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="section-spinner" />
    </div>
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
      <Hero />
      <Suspense fallback={<SectionLoader />}>
        <Dassie />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <Method />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <Workouts />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <Testimonials />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <GetStarted />
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollManager />
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/programs" element={
              <Suspense fallback={<SectionLoader />}><Programs /></Suspense>
            } />
            <Route path="/gallery" element={
              <Suspense fallback={<SectionLoader />}><Gallery /></Suspense>
            } />
            <Route path="/faq" element={
              <Suspense fallback={<SectionLoader />}><FAQ /></Suspense>
            } />

            {/* Auth routes */}
            <Route path="/login" element={
              <Suspense fallback={<SectionLoader />}><Login /></Suspense>
            } />
            <Route path="/register" element={
              <Suspense fallback={<SectionLoader />}><Register /></Suspense>
            } />
            <Route path="/confirm" element={
              <Suspense fallback={<SectionLoader />}><ConfirmSignUp /></Suspense>
            } />

            {/* Admin routes (protected, requires Admin group) */}
            <Route path="/admin" element={
              <ProtectedRoute requiredGroup="Admin">
                <Suspense fallback={<SectionLoader />}><AdminLayout /></Suspense>
              </ProtectedRoute>
            }>
              <Route index element={<Suspense fallback={<SectionLoader />}><Dashboard /></Suspense>} />
              <Route path="users" element={<Suspense fallback={<SectionLoader />}><Users /></Suspense>} />
              <Route path="content" element={<Suspense fallback={<SectionLoader />}><Content /></Suspense>} />
              <Route path="faq" element={<Suspense fallback={<SectionLoader />}><FAQAdmin /></Suspense>} />
              <Route path="merch" element={<Suspense fallback={<SectionLoader />}><Merch /></Suspense>} />
            </Route>
          </Routes>
        </main>
        <Footer />
      </AuthProvider>
    </BrowserRouter>
  );
}
