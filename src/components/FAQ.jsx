import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ScrollReveal from './ScrollReveal';
import { useFaq } from '../hooks/useFaq';
import './FAQ.css';

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

function FAQSkeleton() {
  return (
    <div className="faq-list">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="faq-skeleton-item">
          <div className="faq-skeleton-line" style={{ width: `${50 + i * 8}%` }} />
        </div>
      ))}
    </div>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);
  const { faqs, loading, error, refresh } = useFaq();

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

        {loading ? (
          <FAQSkeleton />
        ) : error ? (
          <div className="faq-error">
            <p>Unable to load FAQ. Please try again.</p>
            <button className="btn primary" onClick={refresh}>Retry</button>
          </div>
        ) : (
          <div className="faq-list">
            {faqs.map((faq, i) => (
              <ScrollReveal key={faq.id || faq.sk || i} delay={i * 0.06}>
                <FAQItem
                  q={faq.q}
                  a={faq.a}
                  isOpen={openIndex === i}
                  onToggle={() => setOpenIndex(openIndex === i ? null : i)}
                />
              </ScrollReveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
