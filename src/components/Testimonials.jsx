import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import ScrollReveal from './ScrollReveal';
import './Testimonials.css';

const quotes = [
  {
    avatar: '/img/avatar-athlete-1-128x128.jpg',
    name: 'Outdoor athlete',
    role: 'Trail runner',
    text: 'The scramble and carry work made my legs and lungs tougher without the usual long slog.',
  },
  {
    avatar: '/img/avatar-athlete-2-128x128.jpg',
    name: 'Busy parent',
    role: '3 sessions per week',
    text: 'Fast sessions, simple structure. I feel athletic again and the recovery rituals keep me consistent.',
  },
  {
    avatar: '/img/avatar-athlete-3-128x128.jpg',
    name: 'Strength focused',
    role: 'Carries enthusiast',
    text: 'The vigilance freezes are sneaky hard. I recover faster between efforts and my grip is way up.',
  },
];

export default function Testimonials() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section id="testimonials">
      <div className="wrap">
        <ScrollReveal>
          <div className="sectionHead">
            <div>
              <h2>What Everyone's Saying</h2>
            </div>
          </div>
        </ScrollReveal>

        <div className="quotes" ref={ref} aria-label="Testimonials">
          {quotes.map((q, i) => (
            <motion.article
              className="quote"
              key={q.name}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              <div className="who">
                <img src={q.avatar} alt={`${q.name} avatar`} />
                <div>
                  <strong>{q.name}</strong>
                  <div className="muted small">{q.role}</div>
                </div>
              </div>
              <p>"{q.text}"</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
