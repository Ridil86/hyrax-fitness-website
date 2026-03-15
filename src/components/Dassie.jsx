import ScrollReveal from './ScrollReveal';
import LazyImage from './LazyImage';
import './Dassie.css';

const traits = [
  {
    icon: '🐘',
    title: 'Closest Cousin to the Elephant',
    text: 'Despite its compact size, the rock hyrax shares more DNA with the African elephant than almost any other living mammal. Raw power runs in the bloodline.',
  },
  {
    icon: '🧗',
    title: 'Built for the Vertical',
    text: 'Rubbery, sweat-moistened pads on its feet give the hyrax suction-like grip on sheer rock. It scales cliffs that would stop animals ten times its size.',
  },
  {
    icon: '⚡',
    title: 'Agile Under Pressure',
    text: 'Explosive leaps, tight direction changes, and acrobatic scrambles across loose stone. The hyrax moves with precision and speed when it counts.',
  },
  {
    icon: '🧘',
    title: 'Calm and Composed',
    text: 'Between bursts of activity, the hyrax baskes on warm rock with a steady pulse and relaxed posture. Recovery is not optional. It is part of the system.',
  },
];

export default function Dassie() {
  return (
    <section id="dassie" className="dassie-section">
      <div className="wrap">
        <ScrollReveal>
          <div className="sectionHead">
            <div>
              <h2>Why the Hyrax?</h2>
              <p className="muted">
                The rock hyrax, known as "the dassie" in South Africa, is one of nature's most
                underestimated athletes. Small but mighty, it is the blueprint behind everything we train.
              </p>
            </div>
            <span className="pill">The Dassie</span>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="dassie-hero-band">
            <LazyImage
              src="/img/the-dassie-1024x576.jpg"
              alt="Rock hyrax perched on a sun-warmed outcrop"
              className="dassie-hero-img"
            />
            <div className="dassie-hero-overlay" />
            <div className="dassie-hero-content">
              <h3>Power in a Small Package</h3>
              <p>
                The rock hyrax is the closest living relative of the elephant, one of the most
                powerful animals on the planet. But where the elephant relies on sheer mass,
                the hyrax trades size for agility. It can scale near-vertical cliff faces,
                launch across gaps in loose rock, and perform acrobatic feats that seem
                impossible for a creature built on the same genetic foundation as a
                five-ton heavyweight.
              </p>
              <p>
                And when the burst is over, it does something most athletes forget to do.
                It stops. It finds a warm ledge, lowers its heart rate, and recovers
                completely before the next effort. Calm, cool, composed. That balance
                between explosive output and deliberate rest is the core of Hyrax Fitness.
              </p>
            </div>
          </div>
        </ScrollReveal>

        <div className="dassie-traits">
          {traits.map((t, i) => (
            <ScrollReveal key={i} delay={i * 0.08}>
              <div className="dassie-trait">
                <span className="dassie-trait-icon" aria-hidden="true">{t.icon}</span>
                <div>
                  <strong>{t.title}</strong>
                  <p className="muted">{t.text}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
