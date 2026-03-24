import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import ScrollReveal from './ScrollReveal';
import { useAuth } from '../context/AuthContext';
import './Workouts.css';

const workoutCategories = [
  {
    category: 'Home',
    tagline: 'No gym required. Bodyweight and minimal equipment sessions you can do anywhere.',
    duration: '15-30 min',
    workouts: ['Dawn Forage', 'Colony Circuit', 'Burrow Burn', 'Thermal Drift', 'Pinnacle Flow'],
  },
  {
    category: 'Gym',
    tagline: 'Heavy compounds, supersets, and full-facility sessions for serious training.',
    duration: '25-40 min',
    workouts: ['Kopje Complex', 'Granite Grind', 'Slab Ascent', 'Talus Storm', 'Spire Session'],
  },
  {
    category: 'Outdoors',
    tagline: 'Trail-ready formats that turn parks, benches, and open ground into your gym.',
    duration: '20-35 min',
    workouts: ['Ridge Run', 'Outcrop', 'Bolt', 'Colony March', 'Skyline'],
  },
];

const platformFeatures = [
  {
    title: 'Workout & Video Library',
    tier: 'Free',
    desc: '15 signature workouts, 60+ exercises at 4 difficulty levels, and a growing video library.',
  },
  {
    title: 'Community Forum',
    tier: 'Free',
    desc: 'Connect with other Hyrax athletes. Share progress, get tips, stay motivated.',
  },
  {
    title: 'Custom Daily Workouts',
    tier: 'Free Trial',
    desc: 'Fresh routines every day, tailored to your goals, equipment, and training history.',
  },
  {
    title: 'Progress Tracking & Benchmarks',
    tier: 'Free Trial',
    desc: 'Log workouts and meals. Track personal bests. Visualize progress with charts and calendars.',
  },
  {
    title: 'Personalized Nutrition Plans',
    tier: 'Free Trial',
    desc: 'Meal plans built around your allergies, preferences, and fitness goals. Includes grocery lists and macros.',
  },
  {
    title: 'Digital Training Coach',
    tier: 'Free Trial',
    desc: 'Ask about form, recovery, or nutrition. Your coach knows your full history.',
  },
];

const tierColors = {
  'Free': 'var(--sand)',
  'Free Trial': 'var(--sunset)',
};

export default function Workouts() {
  const { ref: gridRef, inView: gridInView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const { ref: featRef, inView: featInView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const { isAuthenticated } = useAuth();

  return (
    <>
      {/* Signature Workouts */}
      <section id="workouts">
        <div className="wrap">
          <ScrollReveal>
            <div className="sectionHead">
              <div>
                <h2>15 Signature Workouts</h2>
                <p className="muted">Four difficulty levels. Warm-up, training blocks, and cooldown built into every session.</p>
              </div>
              <span className="pill">Home, Gym, and Outdoors</span>
            </div>
          </ScrollReveal>

          <div className="workout-categories" ref={gridRef} aria-label="Workout categories">
            {workoutCategories.map((cat, i) => (
              <motion.div
                className="workout-cat-card"
                key={cat.category}
                initial={{ opacity: 0, y: 30 }}
                animate={gridInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.12 }}
              >
                <div className="workout-cat-header">
                  <h3>{cat.category}</h3>
                  <span className="workout-cat-duration">{cat.duration}</span>
                </div>
                <p className="workout-cat-tagline">{cat.tagline}</p>
                <ul className="workout-cat-list">
                  {cat.workouts.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            {isAuthenticated ? (
              <Link className="btn primary" to="/portal/workouts">Browse the Full Library</Link>
            ) : (
              <Link className="btn primary" to="/login">Browse the Full Library</Link>
            )}
          </div>
        </div>
      </section>

      {/* Platform Features */}
      <section id="features" className="features-section">
        <div className="wrap">
          <ScrollReveal>
            <div className="sectionHead">
              <div>
                <h2>The Complete Platform</h2>
                <p className="muted">Start free. Upgrade when you are ready. The platform grows with you.</p>
              </div>
              <span className="pill">The Platform</span>
            </div>
          </ScrollReveal>

          <div className="features-grid" ref={featRef} aria-label="Platform features">
            {platformFeatures.map((feat, i) => (
              <motion.div
                className="feature-card"
                key={feat.title}
                initial={{ opacity: 0, y: 25 }}
                animate={featInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.45, delay: i * 0.1 }}
              >
                <div className="feature-card-top">
                  <span
                    className="feature-tier-badge"
                    style={{ background: tierColors[feat.tier] || 'var(--sand)' }}
                  >
                    {feat.tier}
                  </span>
                </div>
                <h3>{feat.title}</h3>
                <p>{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
