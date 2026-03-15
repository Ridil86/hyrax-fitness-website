import { motion } from 'framer-motion';
import './Hero.css';

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } },
};

const stats = [
  { value: '30-45 min', label: 'Sessions' },
  { value: '5', label: 'Modules' },
  { value: '3 Tiers', label: 'Pup to Iron Dassie' },
];

export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-bg">
        <img
          src="/img/hero-hyrax-on-outcrop-1600x900.jpg"
          alt=""
          className="hero-bg-img"
        />
        <div className="hero-overlay" />
      </div>

      <div className="hero-wrap">
        <motion.div
          className="heroGrid"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="heroCard" variants={fadeUp}>
            <div className="inner">
              <div className="heroLayout">
                <motion.img
                  className="heroLogo"
                  src="/img/hyrax-fitness-logo-512x512.png"
                  alt="Hyrax Fitness logo"
                  variants={fadeUp}
                />
                <motion.h1 className="heroHeadline" variants={fadeUp}>
                  Train like a Hyrax
                </motion.h1>
                <motion.div className="heroPanel" variants={fadeUp}>
                  <p className="lead">
                    <span className="leadStrong">
                      Hyrax Fitness is a start-stop training system built around scrambling, hauling, short sprints, and recovery.
                    </span>
                    <span className="leadSub">
                      Train in the gym or outdoors without the long grindy cardio.
                    </span>
                  </p>
                  <div className="heroActions">
                    <a className="btn primary" href="#get-started">Get Started</a>
                  </div>
                </motion.div>

                <motion.div className="stats" variants={fadeUp}>
                  {stats.map((s, i) => (
                    <div className="stat" key={i}>
                      <strong>{s.value}</strong>
                      <span>{s.label}</span>
                    </div>
                  ))}
                </motion.div>
              </div>
            </div>
          </motion.div>

          <div className="heroBackdrop" aria-hidden="true">
            <img src="/img/hero-hyrax-on-outcrop-1600x900.jpg" alt="" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
