import ScrollReveal from '../components/ScrollReveal';
import LazyImage from '../components/LazyImage';
import { useContent } from '../hooks/useContent';
import '../components/Dassie.css';
import './about.css';

const fallbackTraits = [
  { icon: '\ud83d\udc18', title: 'Closest Cousin to the Elephant', text: 'Despite its compact size, the rock hyrax shares more DNA with the African elephant than almost any other living mammal. Raw power runs in the bloodline.' },
  { icon: '\ud83e\uddd7', title: 'Built for the Vertical', text: 'Rubbery, sweat-moistened pads on its feet give the hyrax suction-like grip on sheer rock. It scales cliffs that would stop animals ten times its size.' },
  { icon: '\u26a1', title: 'Agile Under Pressure', text: 'Explosive leaps, tight direction changes, and acrobatic scrambles across loose stone. The hyrax moves with precision and speed when it counts.' },
  { icon: '\ud83e\uddd8', title: 'Calm and Composed', text: 'Between bursts of activity, the hyrax baskes on warm rock with a steady pulse and relaxed posture. Recovery is not optional. It is part of the system.' },
];

export default function About() {
  const { data } = useContent('dassie');
  const d = data || {};
  const traits = d.traits || fallbackTraits;

  return (
    <div className="about-page">
      {/* Hero Banner + Mission */}
      <section className="about-hero">
        <LazyImage
          src="/img/the-dassie-1024x576.jpg"
          alt="Rock hyrax perched on a sun-warmed outcrop"
          className="about-hero-bg"
        />
        <div className="about-hero-overlay" />
        <img
          src="/img/hyrax-fitness-logo-512x512.png"
          alt=""
          className="about-hero-watermark"
          aria-hidden="true"
        />
        <div className="about-hero-content">
          <ScrollReveal>
            <h1>About Hyrax Fitness</h1>
            <p className="about-hero-sub">Where nature's most underestimated athlete meets cutting-edge AI</p>
            <div className="about-hero-mission">
              <p>
                Hyrax Fitness exists to make elite-level training accessible to everyone. By combining a training philosophy rooted in nature with AI-powered personalization, we deliver programs that adapt to each individual - their goals, their equipment, their schedule, and their body. Whether you are training in a fully equipped gym, your living room, or a park, the Hyrax Method meets you where you are and grows with you as you progress.
              </p>
              <p>
                No gatekeeping. No gimmicks. Just smart, effective training designed by experts and delivered by technology that learns what works for you.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Why the Hyrax? - moved from landing page */}
      <section className="dassie-section about-dassie">
        <div className="wrap">
          <ScrollReveal>
            <div className="sectionHead">
              <div>
                <h2>{d.heading || 'Why the Hyrax?'}</h2>
                <p className="muted">
                  {d.subheading || 'The rock hyrax, known as "the dassie" in South Africa, is one of nature\'s most underestimated athletes. Small but mighty, it is the blueprint behind everything we train.'}
                </p>
              </div>
              <span className="pill">{d.pill || 'The Dassie'}</span>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="dassie-hero-band">
              <LazyImage
                src="/img/the-dassie-1024x576.jpg"
                alt="Rock hyrax perched on a sun-warmed outcrop"
                className="dassie-hero-img"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              />
              <div className="dassie-hero-overlay" />
              <div className="dassie-hero-content">
                <h3>{d.heroTitle || 'Power in a Small Package'}</h3>
                {(d.heroBody || [
                  'The rock hyrax is the closest living relative of the elephant, one of the most powerful animals on the planet. But where the elephant relies on sheer mass, the hyrax trades size for agility. It can scale near-vertical cliff faces, launch across gaps in loose rock, and perform acrobatic feats that seem impossible for a creature built on the same genetic foundation as a five-ton heavyweight.',
                  'And when the burst is over, it does something most athletes forget to do. It stops. It finds a warm ledge, lowers its heart rate, and recovers completely before the next effort. Calm, cool, composed. That balance between explosive output and deliberate rest is the core of Hyrax Fitness.',
                ]).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
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

      {/* Our Story */}
      <section className="about-story">
        <div className="wrap">
          <ScrollReveal>
            <div className="sectionHead">
              <div>
                <h2>Our Story</h2>
                <p className="muted">How a chance encounter in South Africa changed everything</p>
              </div>
              <span className="pill">Origins</span>
            </div>
          </ScrollReveal>

          <div className="about-story-grid">
            <ScrollReveal>
              <div className="about-story-card about-founder">
                <h3>Kristian Millirons</h3>
                <p className="about-founder-title">Founder &amp; Creator of the Hyrax Fitness Method</p>
                <p>
                  As a tech entrepreneur, former rock climber, and lifelong fitness enthusiast, Kristian spent years searching for a training philosophy that combined raw functional strength with intelligent recovery. The answer came from an unlikely source during time spent in South Africa.
                </p>
                <p>
                  Watching the "dassie", also known as the rock hyrax, navigate sheer cliff faces and mountainous terrain with effortless agility left a lasting impression. These small, unassuming animals scaled surfaces that would challenge experienced climbers, yet between bursts of explosive movement they remained perfectly calm and composed. It was the embodiment of everything Kristian believed training should be: powerful when it matters, deliberate in recovery, and accessible regardless of size or starting point.
                </p>
                <p>
                  That observation became the seed of Hyrax Fitness. By combining the training philosophy inspired by the dassie with the power of artificial intelligence, Kristian built a system that creates truly personalized programs for anyone, anywhere, at any fitness level. No cookie-cutter routines. No one-size-fits-all plans. Every workout and nutrition plan is built around the individual, adapting as they grow.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* The Science Behind the Method */}
      <section className="about-science">
        <div className="wrap">
          <ScrollReveal>
            <div className="sectionHead">
              <div>
                <h2>The Science Behind the Method</h2>
                <p className="muted">Built to the highest standards in sports science and rehabilitation</p>
              </div>
              <span className="pill">Science</span>
            </div>
          </ScrollReveal>

          <div className="about-story-grid">
            <ScrollReveal>
              <div className="about-story-card about-founder">
                <h3>Dr. Jennifer Hunnicutt</h3>
                <p className="about-founder-title">Program Design Advisor &amp; Sports Science Expert</p>
                <p>
                  Dr. Jennifer Hunnicutt is a certified Athletic Trainer with a PhD in Health and Rehabilitation Sciences. She worked alongside Kristian to design the Hyrax Fitness program to meet the highest standards in exercise science, injury prevention, and athletic performance.
                </p>
                <p>
                  Her career spans some of the most demanding environments in professional sports. She has worked with Olympians at the United States Olympic Training Center in Colorado Springs, with professional athletes in the NBA, and has authored protocols currently in use across professional boxing and MMA. Her expertise ensures that every element of the Hyrax Fitness Method is grounded in evidence-based practice.
                </p>
                <p>
                  As a popular social media health, fitness, and travel influencer known as <a href="https://www.instagram.com/drjennytravels" target="_blank" rel="noopener noreferrer">@drjennytravels</a>, Dr. Hunnicutt has also been featured in and contributed to many of the instructional and demonstration videos available on the Hyrax Fitness platform, bringing her hands-on expertise directly to users.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

    </div>
  );
}
