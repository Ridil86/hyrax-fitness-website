import ScrollReveal from './ScrollReveal';
import LazyImage from './LazyImage';
import './GetStarted.css';

export default function GetStarted() {
  return (
    <section id="get-started">
      <div className="wrap">
        <ScrollReveal>
          <div className="ctaBand">
            <div className="inner">
              <div>
                <span className="pill">Start here</span>
                <h2 style={{ margin: '12px 0 10px' }}>Find your training path</h2>
                <p className="muted" style={{ margin: '0 0 6px' }}>
                  Take a quick assessment to discover your ideal Hyrax program.
                  We&rsquo;ll ask about your fitness background, goals, and preferences,
                  then build a plan that fits your life. It only takes about 2 minutes. 
                  No commitment, no credit card required.
                </p>
                <a className="btn primary" href="#get-started">Get Started</a>
              </div>

              <LazyImage
                src="/img/cta-sunset-training-1200x900.jpg"
                alt="Training at sunset near rocks"
                className="cta-image"
                style={{ borderRadius: 22 }}
              />
            </div>
          </div>
        </ScrollReveal>

        <div style={{ height: 18 }} />

        <ScrollReveal>
          <div className="grid2">
            <div className="card">
              <div className="cardPad">
                <strong>Need a class format?</strong>
                <LazyImage
                  className="cardImage"
                  src="/img/short-class-promo-800x600.jpg"
                  alt="Short class format promo"
                />
                <p className="muted" style={{ margin: '8px 0 0' }}>
                  Run a 45 minute Hyrax class with a short bask warmup, one scramble block, one haul block, and a bolt finisher.
                </p>
              </div>
            </div>
            <div className="card">
              <div className="cardPad">
                <strong>Want an event?</strong>
                <LazyImage
                  className="cardImage"
                  src="/img/hyrax-event-hosting-800x600.jpg"
                  alt="Hyrax event hosting"
                />
                <p className="muted" style={{ margin: '8px 0 0' }}>
                  Use the Outcrop Challenge as a repeatable test day, then scale loads and density by tier.
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
