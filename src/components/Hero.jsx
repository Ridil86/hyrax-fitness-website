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
  headline: 'Fitness That Adapts to You',
  leadStrong: 'Custom workouts, personalized nutrition, and a digital coach that knows your goals. Built around a nature-inspired method designed for real results in 30-45 minutes.',
  leadSub: 'Train anywhere. Beginner to elite. No long grindy cardio.',
  ctaText: 'Start Your Free Trial',
  stats: [
    { value: 'For Everyone', label: 'Beginner to Elite' },
    { value: 'Fully Custom', label: 'Workouts, Nutrition, Coaching' },
    { value: '7-Day Free Trial', label: 'Full access, no credit card' },
  ],
};

export default function Hero() {
  const { isAuthenticated } = useAuth();
  const d = fallback;

  return (
    <section className="hero" id="top">
      <div className="hero-bg">
        <img
          src="/img/hero-hyrax-landing.jpg"
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
                <motion.span className="heroTagline" variants={fadeUp}>
                  Scramble. Haul. Bolt. Recover.
                </motion.span>
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
            <img src="/img/hero-hyrax-landing.jpg" alt="" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
