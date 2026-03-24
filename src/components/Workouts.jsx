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
    title: 'Custom Daily Workouts',
    tier: 'Rock Runner',
    desc: 'AI-generated routines tailored to your goals, equipment, and training history. New every day, with swap and regenerate options.',
  },
  {
    title: 'Personalized Nutrition Plans',
    tier: 'Iron Dassie',
    desc: 'Daily meal plans accounting for your allergies, preferences, workout schedule, and fitness goals. Complete with grocery lists and macro breakdowns.',
  },
  {
    title: 'AI Training Coach',
    tier: 'Iron Dassie',
    desc: 'Ask questions about form, recovery, modifications, and nutrition. Your coach knows your full training and diet history.',
  },
  {
    title: 'Progress Tracking & Benchmarks',
    tier: 'Rock Runner',
    desc: 'Log workouts and meals, track personal bests across 5 benchmark exercises, and visualize your progress with charts and calendars.',
  },
  {
    title: 'Workout & Video Library',
    tier: 'Free',
    desc: '15 signature workouts, 15 exercises with 4 difficulty levels each, and a growing video library of movement tutorials and full sessions.',
  },
  {
    title: 'Community Forum',
    tier: 'Free',
    desc: 'Connect with other Hyrax athletes, share progress, get tips, and stay motivated together.',
  },
];

const tierColors = {
  'Free': 'var(--sand)',
  'Rock Runner': 'var(--sunset)',
  'Iron Dassie': 'var(--earth)',
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
                <p className="muted">Every workout includes warm-up, structured exercise blocks, and a bask cooldown. Four difficulty levels from beginner to elite.</p>
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
                <h2>Everything You Need to Train Smarter</h2>
                <p className="muted">From free access to the full AI-powered experience, Hyrax grows with you.</p>
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
