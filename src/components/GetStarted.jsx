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
                <h2 style={{ margin: '12px 0 10px' }}>{d.heading || 'Ready to train smarter?'}</h2>
                <p className="muted" style={{ margin: '0 0 6px' }}>
                  {d.body || 'Create your free account in under a minute. Start with the full workout library and community access, then upgrade when you are ready for AI-powered personalization, custom nutrition plans, and real-time coaching.'}
                </p>
                {isAuthenticated ? (
                  <Link className="btn primary" to="/portal">Go to Dashboard</Link>
                ) : (
                  <Link className="btn primary" to="/get-started">{d.ctaText || 'Create Free Account'}</Link>
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
          <div className="grid3">
            <div className="card tier-card">
              <div className="cardPad">
                <span className="tier-card-badge" style={{ background: 'var(--sand)' }}>Free</span>
                <strong>Explore the Method</strong>
                <p className="muted" style={{ margin: '8px 0 0' }}>
                  Access the workout library, movement tutorials, downloadable guides, and community forum. No credit card required.
                </p>
              </div>
            </div>
            <div className="card tier-card tier-featured">
              <div className="cardPad">
                <span className="tier-card-badge" style={{ background: 'var(--sunset)' }}>$5/mo</span>
                <strong>Get Personalized</strong>
                <p className="muted" style={{ margin: '8px 0 0' }}>
                  Unlock AI-generated daily workouts, progress tracking, benchmarks, and detailed analytics tailored to your goals.
                </p>
              </div>
            </div>
            <div className="card tier-card">
              <div className="cardPad">
                <span className="tier-card-badge" style={{ background: 'var(--earth)' }}>$20/mo</span>
                <strong>The Full System</strong>
                <p className="muted" style={{ margin: '8px 0 0' }}>
                  Everything in Rock Runner plus custom nutrition plans, AI coaching chat, and priority support.
                </p>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
            <Link to="/programs" className="muted" style={{ color: 'var(--sunset)', fontWeight: 600, fontSize: '0.95rem' }}>
              Compare all features &rarr;
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
