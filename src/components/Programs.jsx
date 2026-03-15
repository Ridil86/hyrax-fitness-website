import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import ScrollReveal from './ScrollReveal';
import './Programs.css';

const tiers = [
  {
    level: 'Beginner',
    name: 'Pup',
    desc: 'Low impact, short distances, plenty of recovery.',
    price: 'Free',
    priceSub: 'starter plan',
    features: ['3 sessions per week', 'Light carries and step ups', 'Walk jog bolts', 'Longer rests'],
    cta: 'Download starter plan',
    ctaClass: 'btn primary',
    href: '#get-started',
  },
  {
    level: 'Standard',
    name: 'Rock Runner',
    desc: 'The sweet spot: moderate load with consistent density.',
    price: '$29',
    priceSub: '/ month',
    features: ['4 sessions per week', 'Structured progressions', 'Benchmark tracking', 'Equipment options'],
    cta: 'Join the waitlist',
    ctaClass: 'btn',
    href: '#get-started',
    featured: true,
  },
  {
    level: 'Advanced',
    name: 'Sentinel Pro',
    desc: 'Heavier loads, sharper sprints, tighter recovery.',
    price: '$59',
    priceSub: '/ month',
    features: ['5 sessions per week', 'Heavier carries and holds', 'Reactive sentinel blocks', 'Optional test events'],
    cta: 'Request coaching',
    ctaClass: 'btn',
    href: '#get-started',
  },
];

export default function Programs() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section id="programs">
      <div className="wrap">
        <ScrollReveal>
          <div className="sectionHead">
            <div>
              <h2>Programs and Levels</h2>
              <p className="muted">
                Three tiers that scale impact, load, and density. Swap equipment freely.
                The pattern matters more than the tools.
              </p>
            </div>
            <span className="pill">Pup to Pro</span>
          </div>
        </ScrollReveal>

        <div className="tiers" ref={ref} aria-label="Program tiers">
          {tiers.map((tier, i) => (
            <motion.article
              className={`tier ${tier.featured ? 'featured' : ''}`}
              key={tier.name}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              <div className="top">
                <span className="pill">{tier.level}</span>
                <h3>{tier.name}</h3>
                <div className="muted small">{tier.desc}</div>
                <div className="price">
                  {tier.price} <span>{tier.priceSub}</span>
                </div>
              </div>
              <div className="body">
                <ul>
                  {tier.features.map((f, j) => <li key={j}>{f}</li>)}
                </ul>
                <div className="actions">
                  <a className={tier.ctaClass} href={tier.href}>{tier.cta}</a>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
