import { Link } from 'react-router-dom';
import ScrollReveal from './ScrollReveal';
import LazyImage from './LazyImage';
import { useAuth } from '../context/AuthContext';
import './GetStarted.css';

export default function GetStarted() {
  const { isAuthenticated } = useAuth();

  return (
    <section id="get-started">
      <div className="wrap">
        <ScrollReveal>
          <div className="ctaBand">
            <div className="inner">
              <div>
                <span className="pill">Start here</span>
                <h2 style={{ margin: '12px 0 10px' }}>Ready to train smarter?</h2>
                <p className="muted" style={{ margin: '0 0 6px' }}>
                  Create your free account in under a minute. Start with the full library and community, then upgrade for custom programs and coaching.
                </p>
                {isAuthenticated ? (
                  <Link className="btn primary" to="/portal">Go to Dashboard</Link>
                ) : (
                  <Link className="btn primary" to="/get-started">Create Free Account</Link>
                )}
              </div>

              <Link to={isAuthenticated ? '/portal' : '/get-started'}>
                <LazyImage
                  src="/img/cta-sunset-training-1200x900.jpg"
                  alt="Training at sunset near rocks"
                  className="cta-image"
                  style={{ borderRadius: 22 }}
                />
              </Link>
            </div>
          </div>
        </ScrollReveal>

        <div style={{ height: 18 }} />

        <ScrollReveal>
          <div className="grid3">
            <Link to="/programs" className="card tier-card card-link">
              <div className="cardPad">
                <span className="tier-card-badge" style={{ background: 'var(--sand)' }}>Free</span>
                <strong>Explore the Method</strong>
                <p className="muted" style={{ margin: '8px 0 0' }}>
                  Workout library, movement tutorials, guides, and community. No credit card required.
                </p>
              </div>
            </Link>
            <Link to="/programs" className="card tier-card tier-featured card-link">
              <div className="cardPad">
                <span className="tier-card-badge" style={{ background: 'var(--sunset)' }}>$5/mo</span>
                <strong>Get Personalized</strong>
                <p className="muted" style={{ margin: '8px 0 0' }}>
                  Custom daily workouts, progress tracking, benchmarks, and analytics tailored to you.
                </p>
              </div>
            </Link>
            <Link to="/programs" className="card tier-card card-link">
              <div className="cardPad">
                <span className="tier-card-badge" style={{ background: 'var(--earth)' }}>$20/mo</span>
                <strong>The Full System</strong>
                <p className="muted" style={{ margin: '8px 0 0' }}>
                  Custom nutrition plans, digital coaching, priority support, and everything in Rock Runner.
                </p>
              </div>
            </Link>
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
