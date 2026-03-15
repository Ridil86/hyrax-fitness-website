import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import ScrollReveal from './ScrollReveal';
import LazyImage from './LazyImage';
import './Method.css';

const modules = [
  { img: '/img/module-bask-prime-800x600.jpg', alt: 'Warm sunrise light on rocks', name: 'Bask and Prime', desc: 'Breathing, mobility, and isometrics to switch on without burning matches.' },
  { img: '/img/module-scramble-800x600.jpg', alt: 'Athlete stepping and balancing on rocks', name: 'Scramble', desc: 'Climb, crawl, and footwork for confident movement on uneven terrain.' },
  { img: '/img/module-forage-haul-800x600.jpg', alt: 'Farmer carry training outdoors', name: 'Forage and Haul', desc: 'Loaded carries and repeated pickups to build grip, trunk, and leg stamina.' },
  { img: '/img/module-sentinel-800x600.jpg', alt: 'Athlete holding a squat while scanning', name: 'Sentinel', desc: 'Freeze drills and reactive changes that train control under adrenaline.' },
  { img: '/img/module-bolt-cover-800x600.jpg', alt: 'Short sprint between cones on trail', name: 'Bolt to Cover', desc: '5 to 15 second bursts with recovery, repeated for high quality power.' },
];

const bullets = [
  'Every session includes at least one carry and one scramble element.',
  'Work happens in forage bouts of 20 to 90 seconds.',
  'Breathing and composure are trained explicitly with Sentinel freezes.',
  'Cooldown is mandatory: slow breathing and mobility to reset.',
];

export default function Method() {
  const { ref: gridRef, inView: gridInView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section id="method">
      <div className="wrap">
        <ScrollReveal>
          <div className="sectionHead">
            <div>
              <h2>The Hyrax Method</h2>
              <p className="muted">
                Five modules that mirror hyrax behavior: warming, scrambling, hauling, and bolting to cover.
                Mix 3 to 5 modules per session for a complete training day.
              </p>
            </div>
            <span className="pill">5 modules</span>
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
                <span className="pill">Real-World Utility</span>
                <h3 style={{ margin: '12px 0 8px', fontSize: '1.35rem' }}>What makes it Hyrax</h3>
                <p className="muted" style={{ margin: '0 0 12px' }}>
                  Hyrax Fitness avoids long steady blocks. It is built around repeatable micro efforts, efficient mechanics,
                  and deliberate recovery.
                </p>
                <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
                  {bullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
                <div style={{ height: 14 }} />
                <a className="btn primary" href="#workouts">See the workout formats</a>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
