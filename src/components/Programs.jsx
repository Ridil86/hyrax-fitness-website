import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import ScrollReveal from './ScrollReveal';
import LazyImage from './LazyImage';
import { useContent } from '../hooks/useContent';
import { useTiers } from '../hooks/useTiers';
import { useAuth } from '../context/AuthContext';
import './Programs.css';

// Display-level metadata per tier (keyed by name) — not editable from CMS
const TIER_DISPLAY = {
  'Pup': { level: 'Explorer', priceSub: 'forever' },
  'Rock Runner': { level: 'Committed', priceSub: '/ month', featured: true },
  'Iron Dassie': { level: 'All In', priceSub: '/ month' },
};

const fallbackTiers = [
  { level: 'Explorer', name: 'Pup', desc: 'Curious newcomers testing the terrain. Dip in, explore the movements, and see if the Hyrax way clicks.', price: 'Free', priceSub: 'forever', features: ['Limited workout video library', 'Downloadable PDF guides', 'Movement tutorials', 'Community access'], cta: 'Get Started', ctaClass: 'btn primary' },
  { level: 'Committed', name: 'Rock Runner', desc: "Self-starters who want structure and accountability. You know you'll show up and be ready to train.", price: '$5', priceSub: '/ month', features: ['Customized workout routines', 'Benchmark tracking', 'Progress analytics', 'Full workout video library', 'Downloadable PDF guides', 'Movement tutorials', 'Community access'], cta: 'Get Started', ctaClass: 'btn primary', featured: true },
  { level: 'All In', name: 'Iron Dassie', desc: 'No half measures. Expert guidance, peak nutrition, and a system fully customized around your life.', price: '$20', priceSub: '/ month', features: ['Digital Personal Trainer', 'Customized diet plans', 'Customized workout routines', 'Benchmark tracking', 'Progress analytics', 'Full workout video library', 'Downloadable PDF guides', 'Movement tutorials', 'Community access', 'Priority support'], cta: 'Get Started', ctaClass: 'btn primary' },
];

const fallbackComparison = [
  { category: 'Content Library', items: [{ name: 'Workout Video Library', detail: 'Access to Hyrax workout videos covering all five modules with scaling options for every fitness level. Pup members get a curated starter selection.', pup: 'limited', runner: true, sentinel: true }, { name: 'Downloadable PDF Guides', detail: 'Printable workout sheets, equipment checklists, and session planners you can take to the gym or the trail.', pup: true, runner: true, sentinel: true }, { name: 'Movement Tutorials', detail: 'Step-by-step breakdowns for every Hyrax movement pattern. Learn proper form for carries, crawls, bolts, and scrambles.', pup: true, runner: true, sentinel: true }] },
  { category: 'Community', items: [{ name: 'Community Access', detail: 'Join the Hyrax community to share progress, ask questions, and connect with other athletes training the same system.', pup: true, runner: true, sentinel: true }] },
  { category: 'Personalization', items: [{ name: 'Customized Workout Routines', detail: 'Training plans built around your intake assessment. Workouts are tailored to your fitness level, equipment access, and weekly schedule.', pup: false, runner: true, sentinel: true }, { name: 'Customized Diet Plans', detail: 'Nutrition guidance matched to your training load and goals. Covers meal timing, macros, and practical food choices that support performance.', pup: false, runner: false, sentinel: true }] },
  { category: 'Tracking & Analytics', items: [{ name: 'Benchmark Tracking', detail: 'Log your Outcrop Challenge scores, carry loads, and session times. See exactly where you stand and how far you have come.', pup: false, runner: true, sentinel: true }, { name: 'Progress Analytics', detail: 'Charts and insights that break down your improvement over weeks and months. Spot trends, plateaus, and breakthroughs at a glance.', pup: false, runner: true, sentinel: true }] },
  { category: 'Coaching & Support', items: [{ name: 'Digital Personal Trainer', detail: 'An adaptive coaching system that adjusts your program week to week based on your performance, recovery, and feedback.', pup: false, runner: false, sentinel: true }, { name: 'Priority Support', detail: 'Fast-track access to help with your training, form questions, and program adjustments. Get answers when you need them.', pup: false, runner: false, sentinel: true }] },
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

/** Returns the CTA element for a tier card or comparison footer */
function TierCta({ tierLevel, tierId, isPaid, isAuthenticated, userTierLevel }) {
  if (isAuthenticated) {
    if (tierLevel === userTierLevel) {
      return <span className="tier-current-label">Current Subscription</span>;
    }
    if (tierLevel > userTierLevel) {
      return <Link className="btn primary" to="/portal/subscription">Upgrade</Link>;
    }
    return <span className="tier-included-label">Included in current subscription</span>;
  }

  // Not authenticated
  if (isPaid) {
    return (
      <Link
        className="btn primary"
        to="/get-started"
        onClick={() => {
          try { localStorage.setItem('pendingUpgradeTier', tierId); } catch { /* ignore */ }
        }}
      >
        Get Started
      </Link>
    );
  }
  return <Link className="btn primary" to="/get-started">Get Started</Link>;
}

export default function Programs() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const { ref: chartRef, inView: chartInView } = useInView({ triggerOnce: true, threshold: 0.05 });
  const { data } = useContent('programs');
  const { tiers: apiTiers, comparisonFeatures: apiComparison } = useTiers();
  const { isAuthenticated, userTier } = useAuth();
  const d = data || {};

  // Merge API tier data with display metadata; fall back to content/hardcoded tiers
  const tiers = apiTiers.length > 0
    ? apiTiers.map((t) => {
        const display = TIER_DISPLAY[t.name] || {};
        const priceDisplay = t.priceInCents === 0 ? 'Free' : `$${(t.priceInCents / 100).toFixed(0)}`;
        return {
          id: t.id,
          level: display.level || `Tier ${t.level}`,
          name: t.name,
          desc: t.description || '',
          price: priceDisplay,
          priceSub: display.priceSub || (t.priceInCents > 0 ? '/ month' : 'forever'),
          features: t.features || [],
          logoUrl: t.logoUrl,
          tierLevel: t.level,
          featured: display.featured || false,
          isPaid: t.priceInCents > 0,
        };
      })
    : (d.tiers || fallbackTiers).map((t, i) => ({
        ...t,
        id: String(i + 1),
        tierLevel: i + 1,
        isPaid: t.price !== 'Free',
      }));

  const comparisonFeatures = (apiComparison && apiComparison.length > 0)
    ? apiComparison
    : (d.comparisonFeatures || fallbackComparison);

  // Determine user's current tier level for comparison
  const userTierLevel = apiTiers.length > 0
    ? (apiTiers.find((t) => t.name === userTier)?.level || 1)
    : 1;

  // Ordered tier info for comparison footer CTAs
  const tierOrder = tiers.map((t) => ({
    level: t.tierLevel,
    name: t.name,
    id: t.id,
    isPaid: t.isPaid,
  }));

  return (
    <section id="programs">
      <div className="wrap">
        <ScrollReveal>
          <div className="sectionHead">
            <div>
              <h2>{d.heading || 'Choose Your Path'}</h2>
              <p className="muted">
                {d.subheading || 'Three tiers built for where you are and where you want to go. Every path leads to the same mountain. Pick the pace that suits you.'}
              </p>
            </div>
            <span className="pill">{d.pill || 'Pup to Iron Dassie'}</span>
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
                {tier.logoUrl && (
                  <img src={tier.logoUrl} alt={`${tier.name} logo`} className="tier-logo" />
                )}
                <h3>{tier.name}</h3>
                <div className="muted small">{tier.desc}</div>
                <div className="price">
                  {tier.price} <span>{tier.priceSub}</span>
                </div>
              </div>
              <div className="body">
                <ul>
                  {(tier.features || []).map((f, j) => <li key={j}>{f}</li>)}
                </ul>
                <div className="actions">
                  <TierCta
                    tierLevel={tier.tierLevel}

                    tierId={tier.id}
                    isPaid={tier.isPaid}
                    isAuthenticated={isAuthenticated}
                    userTierLevel={userTierLevel}
                  />
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
                <h2>{d.compareHeading || 'Compare Plans'}</h2>
                <p className="muted">
                  {d.compareSubheading || 'A closer look at what each tier includes so you can pick the right fit.'}
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
                  <th className="compare-plan-col">Iron Dassie<span className="compare-price">$20/mo</span></th>
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
                  {tierOrder.map((t, i) => (
                    <td key={t.id || i} className={`compare-plan-col ${i === 1 ? 'featured' : ''}`}>
                      <TierCta
                        tierLevel={t.level}

                        tierId={t.id}
                        isPaid={t.isPaid}
                        isAuthenticated={isAuthenticated}
                        userTierLevel={userTierLevel}
                      />
                    </td>
                  ))}
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
                <h2>{d.eventsHeading || 'Hyrax Fitness Events'}</h2>
                <p className="muted">
                  {d.eventsSubheading || 'Bring the Hyrax system to your community with branded events and competitions.'}
                </p>
              </div>
              <span className="pill">{d.eventsPill || 'Host or Compete'}</span>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="events-band">
              <div className="events-content">
                <h3>{d.eventsTitle || 'Host Your Own Hyrax Event'}</h3>
                <p>
                  {d.eventsBody || 'Whether you run a gym, coach a team, or organize community fitness days, you can bring the Hyrax experience to your crew. We provide the programming, branding, and support so you can focus on your athletes.'}
                </p>
                <ul className="events-list">
                  {(d.eventsList || [
                    'Ready-to-run event formats for groups of any size',
                    'Official Hyrax branding and promotional materials',
                    'Scalable workouts for mixed fitness levels',
                    'Scoring templates and leaderboard tools',
                  ]).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
                <p className="muted" style={{ marginTop: 14 }}>
                  {d.eventsNote || 'Interested in hosting or want to find an event near you? Reach out and we will help you get started.'}
                </p>
                <a
                  className="btn primary"
                  href={`mailto:${d.eventsEmail || 'events@hyraxfitness.com'}`}
                  style={{ marginTop: 8, display: 'inline-block' }}
                >
                  Contact Us
                </a>
                <span className="events-email">{d.eventsEmail || 'events@hyraxfitness.com'}</span>
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
