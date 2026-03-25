import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import ScrollReveal from './ScrollReveal';
import { useAuth } from '../context/AuthContext';
import './GetStarted.css';

const howSteps = [
  { num: '1', title: 'Start your free trial', desc: 'Create your account in under a minute. No credit card required. Get 7 days of full access.' },
  { num: '2', title: 'Build your profile', desc: 'Tell us your goals, equipment, and schedule. We handle the rest.' },
  { num: '3', title: 'Train with full access', desc: 'Enjoy personalized workouts, nutrition plans, coaching, and more for 7 days. Subscribe anytime to keep access.' },
];

export default function GetStarted() {
  const { isAuthenticated } = useAuth();
  const { ref: stepsRef, inView: stepsInView } = useInView({ triggerOnce: true, threshold: 0.15 });

  return (
    <section id="get-started">
      <div className="wrap">

        {/* 1. Section Header */}
        <ScrollReveal>
          <div className="sectionHead">
            <div>
              <h2>Get Started</h2>
              <p className="muted">Three steps. One goal. A program built around your life.</p>
            </div>
          </div>
        </ScrollReveal>

        {/* 2. How It Works Steps */}
        <div className="how-steps" ref={stepsRef}>
          {howSteps.map((step, i) => (
            <motion.div
              className="how-step"
              key={step.num}
              initial={{ opacity: 0, y: 20 }}
              animate={stepsInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.12 }}
            >
              <div className="how-step-num">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Trial Callout */}
        <ScrollReveal>
          <div className="trial-callout">
            <span className="trial-callout-icon">&#9733;</span>
            <div>
              <strong>7-day free trial on every account</strong>
              <p>Try personalized workouts, custom nutrition plans, digital coaching, and more. No credit card needed. No commitment.</p>
            </div>
          </div>
        </ScrollReveal>

        {/* 3. Choose Your Plan */}
        <ScrollReveal>
          <h3 className="get-started-sub-heading">Choose Your Plan</h3>
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
                  Custom nutrition plans, digital coaching, priority support, and everything else.
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

        {/* 4. Closing CTA */}
        <ScrollReveal>
          <div className="closing-cta">
            <h2>Ready to train smarter?</h2>
            <p className="muted">Start your 7-day free trial. Full access to every feature, no credit card required.</p>
            {isAuthenticated ? (
              <Link className="btn primary" to="/portal">Go to Dashboard</Link>
            ) : (
              <Link className="btn primary" to="/get-started">Start Free Trial</Link>
            )}
          </div>
        </ScrollReveal>

      </div>
    </section>
  );
}
