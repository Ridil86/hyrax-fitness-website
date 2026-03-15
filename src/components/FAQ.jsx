import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ScrollReveal from './ScrollReveal';
import './FAQ.css';

const faqs = [
  {
    q: 'Do I need a gym?',
    a: 'No. You can run Hyrax Fitness outdoors with stairs, a backpack, and space for short sprints. In a gym, sleds, kettlebells, and sandbags are excellent upgrades.',
  },
  {
    q: 'Is this more cardio or strength?',
    a: 'Both, but structured around power and muscular endurance rather than long steady cardio. Carries and climbs build strength while bolt intervals build repeatable speed.',
  },
  {
    q: 'How do I progress?',
    a: 'Increase one knob at a time: rounds, load, step height, crawl distance, density, or rest reduction. Keep movement quality high and finish sessions with a calm cooldown.',
  },
  {
    q: 'What if I have knee or impact limitations?',
    a: 'Use bike sprints, sled pushes, incline walking, and step ups with controlled cadence. Keep bolts short and rests generous until joints adapt.',
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
              <h2>FAQ</h2>
              <p className="muted">Simple answers make quick decisions.</p>
            </div>
          </div>
        </ScrollReveal>

        <div className="faq-list">
          {faqs.map((faq, i) => (
            <ScrollReveal key={i} delay={i * 0.08}>
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
