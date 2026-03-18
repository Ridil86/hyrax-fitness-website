import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import ScrollReveal from './ScrollReveal';
import LazyImage from './LazyImage';
import { useContent } from '../hooks/useContent';
import { useAuth } from '../context/AuthContext';
import './Workouts.css';

const fallbackWorkouts = [
  { img: '/img/workout-outcrop-circuit-1200x900.jpg', alt: 'Circuit training outdoors near rocks', name: 'Outcrop Circuit', desc: 'Stairs or step ups, carries, crawls, and scan freezes. Repeatable and dense.' },
  { img: '/img/workout-bolt-ladder-1200x900.jpg', alt: 'Short sprint training with cones', name: 'Bolt Ladder', desc: 'Every two minutes: burst, scramble, hold. High quality speed and power.' },
  { img: '/img/workout-colony-session-1200x900.jpg', alt: 'Partner training with sandbags', name: 'Colony Session', desc: 'Partner switches with carries and isometrics. Social, sweaty, and scalable.' },
];

export default function Workouts() {
  const { ref: gridRef, inView: gridInView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const { data } = useContent('workouts');
  const { isAuthenticated } = useAuth();
  const d = data || {};
  const workouts = d.workouts || fallbackWorkouts;
  const roundDetails = d.roundDetails || ['60s steps or stairs', '40m carry', '20m crawl', '6 scan freeze cycles'];
  const scoreDetails = d.scoreDetails || ['Total time', 'Carry load used', 'Freeze quality', 'Breath control'];

  return (
    <section id="workouts">
      <div className="wrap">
        <ScrollReveal>
          <div className="sectionHead">
            <div>
              <h2>{d.heading || 'Signature Workouts'}</h2>
            </div>
            <span className="pill">{d.pill || '30 to 45 minutes'}</span>
          </div>
        </ScrollReveal>

        <div className="workoutGrid" ref={gridRef} aria-label="Workout formats">
          {workouts.map((w, i) => (
            <motion.article
              className="workout"
              key={w.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={gridInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              <LazyImage
                src={w.img}
                alt={w.alt}
                style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
              />
              <div className="workout-overlay" />
              <div className="txt">
                <strong>{w.name}</strong>
                <span>{w.desc}</span>
              </div>
            </motion.article>
          ))}
        </div>

        <div style={{ height: 18 }} />

        <ScrollReveal>
          <div className="split reverse">
            <div className="card">
              <div className="cardPad">
                <span className="pill">{d.challengePill || 'Test Day'}</span>
                <h3 style={{ margin: '12px 0 8px', fontSize: '1.35rem' }}>{d.challengeHeading || 'The Outcrop Challenge'}</h3>
                <p className="muted" style={{ margin: '0 0 12px' }}>
                  {d.challengeBody || 'A simple benchmark event: 6 rounds of scramble, haul, and bolt work. Track time to completion and keep movement quality clean.'}
                </p>
                <div className="grid2" aria-label="Challenge details">
                  <div className="card" style={{ boxShadow: 'none', background: 'rgba(251,247,230,.55)' }}>
                    <div className="cardPad">
                      <strong>Round (x6)</strong>
                      <div className="muted small" style={{ marginTop: 8 }}>
                        {roundDetails.map((r, i) => <span key={i}>{r}<br /></span>)}
                      </div>
                    </div>
                  </div>
                  <div className="card" style={{ boxShadow: 'none', background: 'rgba(251,247,230,.55)' }}>
                    <div className="cardPad">
                      <strong>Score it</strong>
                      <div className="muted small" style={{ marginTop: 8 }}>
                        {scoreDetails.map((s, i) => <span key={i}>{s}<br /></span>)}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ height: 14 }} />
                {isAuthenticated ? (
                  <Link className="btn primary" to="/portal">Go to My Account</Link>
                ) : (
                  <a className="btn primary" href="#get-started">Get Started</a>
                )}
              </div>
            </div>

            <div className="mediaCard">
              <LazyImage
                src="/img/training-carry-sandbag-1400x900.jpg"
                alt="Sandbag carry training"
                style={{ width: '100%', height: '100%', minHeight: 380 }}
              />
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
