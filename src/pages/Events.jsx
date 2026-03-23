import ScrollReveal from '../components/ScrollReveal';
import LazyImage from '../components/LazyImage';
import { useContent } from '../hooks/useContent';
import './events.css';

const eventFormats = [
  {
    title: 'Community Fitness Day',
    desc: 'A casual, all-levels event focused on participation over competition. Perfect for parks, community centers, and neighborhood groups. Everyone works together through scalable Hyrax workouts with modifications for every fitness level.',
    icon: '\ud83c\udfde\ufe0f',
  },
  {
    title: 'Hyrax Challenge',
    desc: 'A scored, competitive event with timed workouts, leaderboards, and individual or team rankings. Athletes push through signature Hyrax formats and earn placement across difficulty tiers from Pup to Iron Dassie.',
    icon: '\ud83c\udfc6',
  },
  {
    title: 'Gym Takeover',
    desc: 'Partner with us to run a branded Hyrax session at your facility. We provide the programming, warm-up and bask protocols, and branded materials. Your coaches lead the session with full support from the Hyrax team.',
    icon: '\ud83c\udfcb\ufe0f',
  },
  {
    title: 'Corporate Wellness',
    desc: 'Team-building fitness events designed for companies and organizations. Scalable workouts that bring coworkers together, build camaraderie, and introduce functional fitness in an approachable, non-intimidating format.',
    icon: '\ud83c\udfe2',
  },
];

const whatYouGet = [
  'Ready-to-run event formats for groups of any size',
  'Official Hyrax Fitness branding and promotional materials',
  'Scalable workout programming with beginner through elite modifications',
  'Warm-up and bask (cooldown) protocols built into every event',
  'Scoring templates, timing tools, and digital leaderboards',
  'Post-event analytics and participant summaries',
  'Dedicated support from the Hyrax team before, during, and after your event',
  'Access to the Hyrax exercise and workout library for event programming',
];

export default function Events() {
  const { data } = useContent('programs');
  const d = data || {};

  return (
    <div className="events-page">
      {/* Hero */}
      <section className="events-hero">
        <LazyImage
          src="/img/events-hero-bg.jpg"
          alt="Hyrax Fitness event with athletes competing outdoors"
          className="events-hero-bg"
        />
        <div className="events-hero-overlay" />
        <div className="events-hero-content">
          <ScrollReveal>
            <h1>{d.eventsHeading || 'Hyrax Fitness Events'}</h1>
            <p className="events-hero-sub">
              {d.eventsSubheading || 'Bring the Hyrax system to your community with branded events and competitions.'}
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* What is a Hyrax Event? */}
      <section className="events-intro">
        <div className="wrap">
          <ScrollReveal>
            <div className="sectionHead">
              <div>
                <h2>What is a Hyrax Event?</h2>
                <p className="muted">Community-driven fitness built on the Hyrax Method</p>
              </div>
              <span className="pill">{d.eventsPill || 'Host or Compete'}</span>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="events-intro-body">
              <p>
                A Hyrax Event is a structured fitness experience built around the same training philosophy that powers our platform. Every event uses signature Hyrax workouts - scrambles, hauls, forages, and bolts - scaled to work for any group, any size, and any fitness level. Events are designed to be run by gym owners, coaches, community organizers, or corporate teams with full support from the Hyrax team.
              </p>
              <p>
                Whether it is a casual Saturday morning in a park or a fully scored competition with leaderboards and tiers, the format adapts to your goals. The Hyrax warm-up and bask protocols are built into every event to ensure participants train smart, recover properly, and leave feeling accomplished rather than destroyed.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Event Formats */}
      <section className="events-formats">
        <div className="wrap">
          <ScrollReveal>
            <div className="sectionHead">
              <div>
                <h2>Event Formats</h2>
                <p className="muted">Four flexible formats to fit any audience and venue</p>
              </div>
              <span className="pill">Formats</span>
            </div>
          </ScrollReveal>

          <div className="events-formats-grid">
            {eventFormats.map((fmt, i) => (
              <ScrollReveal key={i} delay={i * 0.08}>
                <div className="events-format-card">
                  <span className="events-format-icon" aria-hidden="true">{fmt.icon}</span>
                  <h3>{fmt.title}</h3>
                  <p>{fmt.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Host Your Own Event */}
      <section className="events-host">
        <div className="wrap">
          <ScrollReveal>
            <div className="sectionHead">
              <div>
                <h2>{d.eventsTitle || 'Host Your Own Hyrax Event'}</h2>
                <p className="muted">Everything you need to bring Hyrax to your community</p>
              </div>
              <span className="pill">Get Started</span>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="events-host-band">
              <div className="events-host-content">
                <p>
                  {d.eventsBody || 'Whether you run a gym, coach a team, or organize community fitness days, you can bring the Hyrax experience to your crew. We provide the programming, branding, and support so you can focus on your athletes.'}
                </p>
                <p>
                  Getting started is straightforward. Reach out to our events team, tell us about your venue and audience, and we will work with you to select the right format and build a custom event plan. From a 20-person gym session to a 200-person outdoor competition, the Hyrax system scales to fit.
                </p>
              </div>
              <LazyImage
                src="/img/events-hero-bg.jpg"
                alt="Hyrax Fitness event with athletes competing outdoors"
                className="events-host-image"
              />
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* What You Get */}
      <section className="events-benefits">
        <div className="wrap">
          <ScrollReveal>
            <div className="sectionHead">
              <div>
                <h2>What You Get</h2>
                <p className="muted">Full-service event support from start to finish</p>
              </div>
              <span className="pill">Included</span>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="events-benefits-grid">
              {(d.eventsList || whatYouGet).map((item, i) => (
                <div className="events-benefit-item" key={i}>
                  <span className="events-benefit-check" aria-hidden="true">&#10003;</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="events-promo-wrapper">
              <LazyImage src="/img/events-promo.jpg" alt="Hyrax Fitness Event" className="events-promo-img" />
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="events-cta">
        <div className="wrap">
          <ScrollReveal>
            <div className="events-cta-inner">
              <h2>Ready to Bring Hyrax to Your Community?</h2>
              <p>
                {d.eventsNote || 'Interested in hosting or want to find an event near you? Reach out and we will help you get started.'}
              </p>
              <a
                className="btn primary events-cta-btn"
                href={'mailto:' + (d.eventsEmail || 'events@hyraxfitness.com')}
              >
                Contact Us
              </a>
              <span className="events-cta-email">{d.eventsEmail || 'events@hyraxfitness.com'}</span>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
