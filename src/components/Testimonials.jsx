import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import ScrollReveal from './ScrollReveal';
import { useContent } from '../hooks/useContent';
import './Testimonials.css';

const fallbackQuotes = [
  { avatar: '/img/avatar-athlete-1-128x128.jpg', name: 'Monica S.', role: 'Iron Dassie', text: 'I used to train at CrossFit but the cardio was just too much. I wasn\'t able to gain muscle because I was burning so many calories and didn\'t have the proper nutritional guidance. Ever since starting Hyrax everything has changed. I\'m stronger, healthier, and feel like I have more energy than ever.' },
  { avatar: '/img/avatar-athlete-2-128x128.jpg', name: 'Priya K.', role: 'Rock Runner', text: 'I travel for work three weeks out of the month and could never stick to a program. Hyrax sessions are short enough to fit into a hotel gym or a park near the airport. The customized routines adjust to whatever equipment I have access to that week.' },
  { avatar: '/img/avatar-athlete-3-128x128.jpg', name: 'James R.', role: 'Iron Dassie', text: 'The diet plan alone was worth the upgrade. I was eating well but not eating right for how I train. Within a few weeks my recovery improved and I stopped hitting that afternoon wall. The personal trainer adjustments each week keep things fresh too.' },
];

export default function Testimonials() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const { data } = useContent('testimonials');
  const d = data || {};
  const quotes = d.quotes || fallbackQuotes;

  return (
    <section id="testimonials">
      <div className="wrap">
        <ScrollReveal>
          <div className="sectionHead">
            <div>
              <h2>{d.heading || "What Everyone's Saying"}</h2>
            </div>
          </div>
        </ScrollReveal>

        <div className="quotes" ref={ref} aria-label="Testimonials">
          {quotes.map((q, i) => (
            <motion.article
              className="quote"
              key={q.name || i}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
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
