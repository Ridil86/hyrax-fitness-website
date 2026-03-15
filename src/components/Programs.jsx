import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import ScrollReveal from './ScrollReveal';
import './Programs.css';

const tiers = [
  {
    level: 'Explorer',
    name: 'Pup',
    desc: 'Curious newcomers testing the terrain. Dip in, explore the movements, and see if the Hyrax way clicks.',
    price: 'Free',
    priceSub: 'forever',
    features: [
      'Full workout video library',
      'Downloadable PDF guides',
      'Movement tutorials',
      'Community access',
    ],
    cta: 'Get Started',
    ctaClass: 'btn primary',
  },
  {
    level: 'Committed',
    name: 'Rock Runner',
    desc: 'Self-starters who want structure and accountability. You know you\'ll show up \u2014 now train with precision.',
    price: '$5',
    priceSub: '/ month',
    features: [
      'Customized workout routines',
      'Benchmark tracking',
      'Full workout video library',
      'Downloadable PDF guides',
      'Progress analytics',
    ],
    cta: 'Get Started',
    ctaClass: 'btn primary',
    featured: true,
  },
  {
    level: 'All In',
    name: 'Sentinel',
    desc: 'No half measures. Expert guidance, peak nutrition, and a system built around your life.',
    price: '$20',
    priceSub: '/ month',
    features: [
      'Digital Personal Trainer',
      'Customized workout routines',
      'Customized diet plans',
      'Benchmark tracking',
      'Full workout video library',
      'Downloadable PDF guides',
      'Priority support',
    ],
    cta: 'Get Started',
    ctaClass: 'btn primary',
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
              <h2>Choose Your Path</h2>
              <p className="muted">
                Three tiers built for where you are and where you want to go.
                Every path leads to the same mountain &mdash; pick the pace that suits you.
              </p>
            </div>
            <span className="pill">Pup to Sentinel</span>
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
                  <a className={tier.ctaClass} href="/#get-started">{tier.cta}</a>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
