import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ScrollReveal from './ScrollReveal';
import './FAQ.css';

const faqs = [
  {
    q: 'What is Hyrax Fitness?',
    a: 'Hyrax Fitness is a start-stop training system inspired by the daily rhythm of the rock hyrax. It combines scrambling, hauling, short sprints, and active recovery into 30\u201345 minute sessions that build real-world strength and conditioning without long, monotonous cardio.',
  },
  {
    q: 'Who is this for?',
    a: 'Anyone who wants functional fitness without the treadmill grind. Whether you\u2019re a complete beginner or an experienced athlete, the Hyrax method scales to your level. The Pup tier is free and designed for newcomers, while Sentinel is built for those who want full coaching.',
  },
  {
    q: 'How do I get started?',
    a: 'Hit the Get Started button anywhere on the site. You\u2019ll answer a few quick questions about your fitness level, goals, and preferences. From there we\u2019ll recommend a tier and build you a personalized plan.',
  },
  {
    q: 'Do I need a gym?',
    a: 'No. You can run Hyrax Fitness outdoors with stairs, a backpack, and space for short sprints. In a gym, sleds, kettlebells, and sandbags are excellent upgrades \u2014 but the system works just as well in a park or your backyard.',
  },
  {
    q: 'Is this more cardio or strength?',
    a: 'Both, but structured around power and muscular endurance rather than long steady cardio. Carries and climbs build strength while bolt intervals build repeatable speed. You\u2019ll finish each session stronger, not just sweatier.',
  },
  {
    q: 'How do I progress?',
    a: 'Increase one variable at a time: rounds, load, step height, crawl distance, density, or rest reduction. Keep movement quality high and finish sessions with a calm cooldown. The Benchmark tracking in Rock Runner and Sentinel tiers helps you see exactly where you\u2019re improving.',
  },
  {
    q: 'What\u2019s the difference between Pup, Rock Runner, and Sentinel?',
    a: 'Pup is free and gives you access to the full workout video and PDF library \u2014 perfect for exploring the system. Rock Runner ($5/mo) adds customized workout routines and benchmark tracking for those ready to train with structure. Sentinel ($20/mo) is the full package: a digital personal trainer, customized workouts, diet plans, and priority support.',
  },
  {
    q: 'What if I have knee or impact limitations?',
    a: 'Use bike sprints, sled pushes, incline walking, and step ups with controlled cadence. Keep bolts short and rests generous until joints adapt. The system is designed to be modified \u2014 intensity matters more than specific movements.',
  },
  {
    q: 'How long are the workouts?',
    a: 'Most sessions run 30 to 45 minutes including warmup and cooldown. They\u2019re designed to be dense and efficient \u2014 every minute counts. No filler, no waiting around.',
  },
  {
    q: 'Can I cancel or change my plan anytime?',
    a: 'Yes. You can switch tiers or cancel at any time with no penalties or lock-in periods. Start with Pup for free and upgrade when you\u2019re ready.',
  },
];

function FAQItem({ q, a, isOpen, onToggle }) {
  return (
    <div className={`faq-item ${isOpen ? 'open' : ''}`} onClick={onToggle}>
      <button className="faq-summary" aria-expanded={isOpen}>
        <span>{q}</span>
        <motion.span
          className="faq-icon"
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          +
        </motion.span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="faq-answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <p>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <section id="faq">
      <div className="wrap">
        <ScrollReveal>
          <div className="sectionHead">
            <div>
              <h2>Frequently Asked Questions</h2>
              <p className="muted">Simple answers make quick decisions.</p>
            </div>
          </div>
        </ScrollReveal>

        <div className="faq-list">
          {faqs.map((faq, i) => (
            <ScrollReveal key={i} delay={i * 0.06}>
              <FAQItem
                q={faq.q}
                a={faq.a}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
