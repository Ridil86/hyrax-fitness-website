import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useContent } from '../hooks/useContent';
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
  headline: 'Train like a Hyrax',
  leadStrong: 'Hyrax Fitness is a start-stop training system built around scrambling, hauling, short sprints, and recovery.',
  leadSub: 'Train in the gym or outdoors without the long grindy cardio.',
  ctaText: 'Get Started',
  stats: [
    { value: '30-45 min', label: 'Sessions' },
    { value: '5', label: 'Modules' },
    { value: '3 Tiers', label: 'Pup to Iron Dassie' },
  ],
};

export default function Hero() {
  const { data } = useContent('hero');
  const { isAuthenticated } = useAuth();
  const d = data || fallback;

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
                      <Link className="btn primary" to="/portal">Go to My Account</Link>
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
