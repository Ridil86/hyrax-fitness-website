import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import ScrollReveal from './ScrollReveal';
import LazyImage from './LazyImage';
import { useContent } from '../hooks/useContent';
import './Method.css';

const fallbackModules = [
  { img: '/img/module-bask-prime-800x600.jpg', alt: 'Warm sunrise light on rocks', name: 'Bask and Prime', desc: 'Breathing, mobility, and isometrics to activate without burning matches. Sunstone Holds and Crevice Flow warm the body through deliberate movement patterns.' },
  { img: '/img/module-scramble-800x600.jpg', alt: 'Athlete stepping and balancing on rocks', name: 'Scramble', desc: 'Climb, crawl, and footwork for confident movement on uneven terrain. Ledge Scrambles, Outcrop Crawls, and Summit Inversions build real-world agility.' },
  { img: '/img/module-forage-haul-800x600.jpg', alt: 'Farmer carry training outdoors', name: 'Forage and Haul', desc: 'Loaded carries and repeated pickups to build grip, trunk, and leg stamina. Colony Carries, Ridge Rows, and Boulder Presses develop functional strength.' },
  { img: '/img/module-sentinel-800x600.jpg', alt: 'Athlete holding a squat while scanning', name: 'Balance', desc: 'Static holds, freeze drills, and reactive changes that train control under adrenaline. Perch Squats, Sunstone Holds, and composure-under-load drills sharpen focus and stability.' },
  { img: '/img/module-bolt-cover-800x600.jpg', alt: 'Short sprint between cones on trail', name: 'Bolt to Cover', desc: '5 to 15 second bursts with recovery, repeated for high quality power. Bolt Sprints and Basalt Burpees train explosive output when it matters.' },
];

const fallbackBullets = [
  'Every session includes at least one carry and one scramble element.',
  'Work happens in forage bouts of 20 to 90 seconds.',
  'Breathing and composure are trained explicitly with balance holds and freezes.',
  'Cooldown is mandatory: slow breathing and mobility to reset.',
];

const aiBullets = [
  'AI generates your daily workout based on your history, goals, and available equipment.',
  'Personalized nutrition plans adapt to your training load and dietary needs.',
  'A digital coach answers your questions and adjusts your program in real time.',
  'Track benchmarks, log progress, and watch your training evolve week over week.',
];

export default function Method() {
  const { ref: gridRef, inView: gridInView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const { data } = useContent('method');
  const d = data || {};
  const modules = d.modules || fallbackModules;
  const bullets = d.bullets || fallbackBullets;

  return (
    <section id="method">
      <div className="wrap">
        <ScrollReveal>
          <div className="sectionHead">
            <div>
              <h2>{d.heading || 'The Hyrax Method'}</h2>
              <p className="muted">
                {d.subheading || 'Five modules that mirror hyrax behavior: warming, scrambling, hauling, and bolting to cover. Mix 3 to 5 modules per session for a complete training day.'}
              </p>
            </div>
            <span className="pill">{d.pill || '5 modules'}</span>
          </div>
        </ScrollReveal>

        <div className="moduleGrid" ref={gridRef} aria-label="Hyrax modules">
          {modules.map((mod, i) => (
            <motion.article
              className="module"
              key={mod.name}
              initial={{ opacity: 0, y: 30 }}
              animate={gridInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <LazyImage src={mod.img} alt={mod.alt} style={{ height: 108, overflow: 'hidden' }} />
              <div className="body">
                <strong>{mod.name}</strong>
                <p>{mod.desc}</p>
              </div>
            </motion.article>
          ))}
        </div>

        <div style={{ height: 20 }} />

        <ScrollReveal>
          <div className="split">
            <div className="mediaCard">
              <LazyImage
                src="/img/training-scramble-rocks-1400x900.jpg"
                alt="Scramble training on rocks"
                style={{ width: '100%', height: '100%', minHeight: 380 }}
              />
            </div>

            <div className="card">
              <div className="cardPad">
                <span className="pill">{d.splitPill || 'Real-World Utility'}</span>
                <h3 style={{ margin: '12px 0 8px', fontSize: '1.35rem' }}>{d.splitHeading || 'What makes it Hyrax'}</h3>
                <p className="muted" style={{ margin: '0 0 12px' }}>
                  {d.splitBody || 'Hyrax Fitness avoids long steady blocks. It is built around repeatable micro efforts, efficient mechanics, and deliberate recovery.'}
                </p>
                <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
                  {bullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
                <div style={{ height: 18 }} />
                <h4 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: 'var(--sunset)' }}>Powered by Intelligence</h4>
                <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
                  {aiBullets.map((b, i) => <li key={`ai-${i}`}>{b}</li>)}
                </ul>
                <div style={{ height: 14 }} />
                <a className="btn primary" href="#features">Explore the Platform</a>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
