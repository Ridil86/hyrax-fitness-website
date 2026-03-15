import { useState } from 'react';
import { motion } from 'framer-motion';
import ScrollReveal from './ScrollReveal';
import LazyImage from './LazyImage';
import './GetStarted.css';

export default function GetStarted() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
      setEmail('');
    }
  };

  return (
    <section id="get-started">
      <div className="wrap">
        <ScrollReveal>
          <div className="ctaBand">
            <div className="inner">
              <div>
                <span className="pill">Start here</span>
                <h2 style={{ margin: '12px 0 10px' }}>Get the 2 week starter plan</h2>
                <p className="muted" style={{ margin: 0 }}>
                  Drop in your email to receive a PDF link, a simple equipment list, and the Outcrop Challenge benchmark sheet.
                </p>

                <form onSubmit={handleSubmit} aria-label="Starter plan email capture">
                  <input
                    type="email"
                    name="email"
                    placeholder="you@domain.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <motion.button
                    className="btn primary"
                    type="submit"
                    whileTap={{ scale: 0.97 }}
                  >
                    {submitted ? 'Sent!' : 'Send me the plan'}
                  </motion.button>
                </form>

                {submitted && (
                  <motion.p
                    className="success-msg"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    Check your inbox for the starter plan!
                  </motion.p>
                )}

                <p className="muted small" style={{ margin: '10px 0 0' }}>
                  By signing up you agree to receive Hyrax Fitness updates. Unsubscribe anytime.
                </p>
              </div>

              <LazyImage
                src="/img/cta-sunset-training-1200x900.jpg"
                alt="Training at sunset near rocks"
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
                <strong>Need a class format?</strong>
                <LazyImage
                  className="cardImage"
                  src="/img/short-class-promo-800x600.jpg"
                  alt="Short class format promo"
                />
                <p className="muted" style={{ margin: '8px 0 0' }}>
                  Run a 45 minute Hyrax class with a short bask warmup, one scramble block, one haul block, and a bolt finisher.
                </p>
              </div>
            </div>
            <div className="card">
              <div className="cardPad">
                <strong>Want an event?</strong>
                <LazyImage
                  className="cardImage"
                  src="/img/hyrax-event-hosting-800x600.jpg"
                  alt="Hyrax event hosting"
                />
                <p className="muted" style={{ margin: '8px 0 0' }}>
                  Use the Outcrop Challenge as a repeatable test day, then scale loads and density by tier.
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
