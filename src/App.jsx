import { lazy, Suspense } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import Footer from './components/Footer';
import './styles/global.css';

const Method = lazy(() => import('./components/Method'));
const Workouts = lazy(() => import('./components/Workouts'));
const Programs = lazy(() => import('./components/Programs'));
const Gallery = lazy(() => import('./components/Gallery'));
const Testimonials = lazy(() => import('./components/Testimonials'));
const FAQ = lazy(() => import('./components/FAQ'));
const GetStarted = lazy(() => import('./components/GetStarted'));

function SectionLoader() {
  return (
    <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="section-spinner" />
    </div>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Suspense fallback={<SectionLoader />}>
          <Method />
        </Suspense>
        <Suspense fallback={<SectionLoader />}>
          <Workouts />
        </Suspense>
        <Suspense fallback={<SectionLoader />}>
          <Programs />
        </Suspense>
        <Suspense fallback={<SectionLoader />}>
          <Gallery />
        </Suspense>
        <Suspense fallback={<SectionLoader />}>
          <Testimonials />
        </Suspense>
        <Suspense fallback={<SectionLoader />}>
          <FAQ />
        </Suspense>
        <Suspense fallback={<SectionLoader />}>
          <GetStarted />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
