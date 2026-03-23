import { Link } from 'react-router-dom';
import ScrollReveal from './ScrollReveal';
import LazyImage from './LazyImage';
import { useContent } from '../hooks/useContent';
import { useAuth } from '../context/AuthContext';
import './GetStarted.css';

export default function GetStarted() {
  const { data } = useContent('getstarted');
  const { isAuthenticated } = useAuth();
  const d = data || {};

  return (
    <section id="get-started">
      <div className="wrap">
        <ScrollReveal>
          <div className="ctaBand">
            <div className="inner">
              <div>
                <span className="pill">{d.pill || 'Start here'}</span>
                <h2 style={{ margin: '12px 0 10px' }}>{d.heading || 'Find your training path'}</h2>
                <p className="muted" style={{ margin: '0 0 6px' }}>
                  {d.body || 'Take a quick assessment to discover your ideal Hyrax program. We\u2019ll ask about your fitness background, goals, and preferences, then build a plan that fits your life. It only takes about 2 minutes. No commitment, no credit card required.'}
                </p>
                {isAuthenticated ? (
                  <Link className="btn primary" to="/portal">Go to My Account</Link>
                ) : (
                  <Link className="btn primary" to="/get-started">{d.ctaText || 'Get Started'}</Link>
                )}
              </div>

              <LazyImage
                src={d.ctaImage || '/img/cta-sunset-training-1200x900.jpg'}
                alt={d.ctaImageAlt || 'Training at sunset near rocks'}
                className="cta-image"
                style={{ borderRadius: 22 }}
              />
            </div>
          </div>
        </ScrollReveal>

        <div style={{ height: 18 }} />

        <ScrollReveal>
          <div className="grid2">
            <div className="card">
              <div className="cardPad">
                <strong>{d.classFormatTitle || 'Need a class format?'}</strong>
                <LazyImage
                  className="cardImage"
                  src={d.classFormatImage || '/img/short-class-promo-800x600.jpg'}
                  alt={d.classFormatImageAlt || 'Short class format promo'}
                />
                <p className="muted" style={{ margin: '8px 0 0' }}>
                  {d.classFormatBody || 'Run a 45 minute Hyrax class with a short bask warmup, one scramble block, one haul block, and a bolt finisher.'}
                </p>
              </div>
            </div>
            <Link to="/events" className="card card-link">
              <div className="cardPad">
                <strong>{d.eventCardTitle || 'Want an event?'}</strong>
                <LazyImage
                  className="cardImage"
                  src={d.eventCardImage || '/img/hyrax-event-hosting-800x600.jpg'}
                  alt={d.eventCardImageAlt || 'Hyrax event hosting'}
                />
                <p className="muted" style={{ margin: '8px 0 0' }}>
                  {d.eventCardBody || 'Host a branded Hyrax event at your gym or find a competition near you. Get in touch to get started.'}
                </p>
              </div>
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
