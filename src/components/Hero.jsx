import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import './Hero.css';

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } },
};

// Fallback data while API loads (prevents empty hero on first paint)
const fallback = {
  headline: 'Your Personal Training System, Powered by AI',
  leadStrong: 'Hyrax Fitness combines a nature-inspired training method with AI-powered personalization to deliver custom workouts, nutrition plans, and real-time coaching - all tailored to your goals, equipment, and schedule.',
  leadSub: 'Train anywhere. 30-45 minute sessions. Beginner to elite. No long grindy cardio.',
  ctaText: 'Start Free',
  stats: [
    { value: '4 Levels', label: 'Beginner to Elite' },
    { value: 'AI-Powered', label: 'Workouts, Nutrition, Coaching' },
    { value: 'Free to Start', label: 'No credit card required' },
  ],
};

export default function Hero() {
  const { isAuthenticated } = useAuth();
  const d = fallback;

  return (
    <section className="hero" id="top">
      <div className="hero-bg">
        <img
          src="/img/hero-hyrax-on-outcrop-1600x900.jpg"
          alt=""
          className="hero-bg-img"
        />
        <div className="hero-overlay" />
      </div>

      <div className="hero-wrap">
        <motion.div
          className="heroGrid"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="heroCard" variants={fadeUp}>
            <div className="inner">
              <div className="heroLayout">
                <motion.img
                  className="heroLogo"
                  src="/img/hyrax-fitness-logo-512x512.png"
                  alt="Hyrax Fitness logo"
                  variants={fadeUp}
                />
                <motion.h1 className="heroHeadline" variants={fadeUp}>
                  {d.headline}
                </motion.h1>
                <motion.div className="heroPanel" variants={fadeUp}>
                  <p className="lead">
                    <span className="leadStrong">{d.leadStrong}</span>
                    <span className="leadSub">{d.leadSub}</span>
                  </p>
                  <div className="heroActions">
                    {isAuthenticated ? (
                      <Link className="btn primary" to="/portal">Go to Dashboard</Link>
                    ) : (
                      <Link className="btn primary" to="/get-started">{d.ctaText}</Link>
                    )}
                  </div>
                </motion.div>

                <motion.div className="stats" variants={fadeUp}>
                  {(d.stats || []).map((s, i) => (
                    <div className="stat" key={i}>
                      <strong>{s.value}</strong>
                      <span>{s.label}</span>
                    </div>
                  ))}
                </motion.div>
              </div>
            </div>
          </motion.div>

          <div className="heroBackdrop" aria-hidden="true">
            <img src="/img/hero-hyrax-on-outcrop-1600x900.jpg" alt="" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
