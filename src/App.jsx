import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import Footer from './components/Footer';
import './styles/global.css';

const Method = lazy(() => import('./components/Method'));
const Workouts = lazy(() => import('./components/Workouts'));
const Testimonials = lazy(() => import('./components/Testimonials'));
const GetStarted = lazy(() => import('./components/GetStarted'));
const Programs = lazy(() => import('./components/Programs'));
const Gallery = lazy(() => import('./components/Gallery'));
const FAQ = lazy(() => import('./components/FAQ'));

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
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  );
}
