import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import ScrollReveal from './ScrollReveal';
import LazyImage from './LazyImage';
import './Programs.css';

const tiers = [
  {
    level: 'Explorer',
    name: 'Pup',
    desc: 'Curious newcomers testing the terrain. Dip in, explore the movements, and see if the Hyrax way clicks.',
    price: 'Free',
    priceSub: 'forever',
    features: [
      'Limited workout video library',
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
    desc: 'Self-starters who want structure and accountability. You know you\'ll show up and be ready to train.',
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
    desc: 'No half measures. Expert guidance, peak nutrition, and a system fully customized around your life.',
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

const comparisonFeatures = [
  {
    category: 'Content Library',
    items: [
      {
        name: 'Workout Video Library',
        detail: 'Access to Hyrax workout videos covering all five modules with scaling options for every fitness level. Pup members get a curated starter selection.',
        pup: 'limited',
        runner: true,
        sentinel: true,
      },
      {
        name: 'Downloadable PDF Guides',
        detail: 'Printable workout sheets, equipment checklists, and session planners you can take to the gym or the trail.',
        pup: true,
        runner: true,
        sentinel: true,
      },
      {
        name: 'Movement Tutorials',
        detail: 'Step-by-step breakdowns for every Hyrax movement pattern. Learn proper form for carries, crawls, bolts, and scrambles.',
        pup: true,
        runner: true,
        sentinel: true,
      },
    ],
  },
  {
    category: 'Community',
    items: [
      {
        name: 'Community Access',
        detail: 'Join the Hyrax community to share progress, ask questions, and connect with other athletes training the same system.',
        pup: true,
        runner: true,
        sentinel: true,
      },
    ],
  },
  {
    category: 'Personalization',
    items: [
      {
        name: 'Customized Workout Routines',
        detail: 'Training plans built around your intake assessment. Workouts are tailored to your fitness level, equipment access, and weekly schedule.',
        pup: false,
        runner: true,
        sentinel: true,
      },
      {
        name: 'Customized Diet Plans',
        detail: 'Nutrition guidance matched to your training load and goals. Covers meal timing, macros, and practical food choices that support performance.',
        pup: false,
        runner: false,
        sentinel: true,
      },
    ],
  },
  {
    category: 'Tracking & Analytics',
    items: [
      {
        name: 'Benchmark Tracking',
        detail: 'Log your Outcrop Challenge scores, carry loads, and session times. See exactly where you stand and how far you have come.',
        pup: false,
        runner: true,
        sentinel: true,
      },
      {
        name: 'Progress Analytics',
        detail: 'Charts and insights that break down your improvement over weeks and months. Spot trends, plateaus, and breakthroughs at a glance.',
        pup: false,
        runner: true,
        sentinel: true,
      },
    ],
  },
  {
    category: 'Coaching & Support',
    items: [
      {
        name: 'Digital Personal Trainer',
        detail: 'An adaptive coaching system that adjusts your program week to week based on your performance, recovery, and feedback.',
        pup: false,
        runner: false,
        sentinel: true,
      },
      {
        name: 'Priority Support',
        detail: 'Fast-track access to help with your training, form questions, and program adjustments. Get answers when you need them.',
        pup: false,
        runner: false,
        sentinel: true,
      },
    ],
  },
];

function Check() {
  return (
    <svg className="compare-icon check" viewBox="0 0 20 20" fill="none" aria-label="Included">
      <circle cx="10" cy="10" r="10" />
      <path d="M6 10.5l2.5 2.5L14 7.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Dash() {
  return (
    <svg className="compare-icon dash" viewBox="0 0 20 20" fill="none" aria-label="Not included">
      <circle cx="10" cy="10" r="10" />
      <path d="M7 10h6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Limited() {
  return (
    <span className="compare-limited" aria-label="Limited access">Limited</span>
  );
}

function CellIcon({ value }) {
  if (value === 'limited') return <Limited />;
  return value ? <Check /> : <Dash />;
}

export default function Programs() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const { ref: chartRef, inView: chartInView } = useInView({ triggerOnce: true, threshold: 0.05 });

  return (
    <section id="programs">
      <div className="wrap">
        <ScrollReveal>
          <div className="sectionHead">
            <div>
              <h2>Choose Your Path</h2>
              <p className="muted">
                Three tiers built for where you are and where you want to go.
                Every path leads to the same mountain. Pick the pace that suits you.
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

        {/* Comparison Chart */}
        <div className="compare-section" ref={chartRef}>
          <ScrollReveal>
            <div className="sectionHead" style={{ marginTop: 54 }}>
              <div>
                <h2>Compare Plans</h2>
                <p className="muted">
                  A closer look at what each tier includes so you can pick the right fit.
                </p>
              </div>
            </div>
          </ScrollReveal>

          <motion.div
            className="compare-table-wrap"
            initial={{ opacity: 0, y: 30 }}
            animate={chartInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <table className="compare-table" aria-label="Plan comparison">
              <thead>
                <tr>
                  <th className="compare-feature-col">Feature</th>
                  <th className="compare-plan-col">Pup<span className="compare-price">Free</span></th>
                  <th className="compare-plan-col featured">Rock Runner<span className="compare-price">$5/mo</span></th>
                  <th className="compare-plan-col">Sentinel<span className="compare-price">$20/mo</span></th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((group) => (
                  <ComparisonGroup key={group.category} group={group} />
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="compare-feature-col" />
                  <td className="compare-plan-col">
                    <a className="btn primary compare-cta" href="/#get-started">Get Started</a>
                  </td>
                  <td className="compare-plan-col featured">
                    <a className="btn primary compare-cta" href="/#get-started">Get Started</a>
                  </td>
                  <td className="compare-plan-col">
                    <a className="btn primary compare-cta" href="/#get-started">Get Started</a>
                  </td>
                </tr>
              </tfoot>
            </table>
          </motion.div>
        </div>

        {/* Events Section */}
        <div className="events-section" id="events">
          <ScrollReveal>
            <div className="sectionHead" style={{ marginTop: 54 }}>
              <div>
                <h2>Hyrax Fitness Events</h2>
                <p className="muted">
                  Bring the Hyrax system to your community with branded events and competitions.
                </p>
              </div>
              <span className="pill">Host or Compete</span>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="events-band">
              <div className="events-content">
                <h3>Host Your Own Hyrax Event</h3>
                <p>
                  Whether you run a gym, coach a team, or organize community fitness days,
                  you can bring the Hyrax experience to your crew. We provide the programming,
                  branding, and support so you can focus on your athletes.
                </p>
                <ul className="events-list">
                  <li>Ready-to-run event formats for groups of any size</li>
                  <li>Official Hyrax branding and promotional materials</li>
                  <li>Scalable workouts for mixed fitness levels</li>
                  <li>Scoring templates and leaderboard tools</li>
                </ul>
                <p className="muted" style={{ marginTop: 14 }}>
                  Interested in hosting or want to find an event near you? Reach out and
                  we will help you get started.
                </p>
                <a
                  className="btn primary"
                  href="mailto:events@hyraxfitness.com"
                  style={{ marginTop: 8, display: 'inline-block' }}
                >
                  Contact Us
                </a>
                <span className="events-email">events@hyraxfitness.com</span>
              </div>
              <LazyImage
                src="/img/hyrax-event-hosting-800x600.jpg"
                alt="Hyrax Fitness event with athletes competing outdoors"
                className="events-image"
              />
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

function ComparisonGroup({ group }) {
  return (
    <>
      <tr className="compare-category-row">
        <td colSpan={4}>{group.category}</td>
      </tr>
      {group.items.map((item) => (
        <tr className="compare-row" key={item.name}>
          <td className="compare-feature-col">
            <strong className="compare-feature-name">{item.name}</strong>
            <span className="compare-feature-detail">{item.detail}</span>
          </td>
          <td className="compare-plan-col"><CellIcon value={item.pup} /></td>
          <td className="compare-plan-col featured"><CellIcon value={item.runner} /></td>
          <td className="compare-plan-col"><CellIcon value={item.sentinel} /></td>
        </tr>
      ))}
    </>
  );
}
