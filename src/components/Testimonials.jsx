import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import ScrollReveal from './ScrollReveal';
import './Testimonials.css';

const quotes = [
  {
    avatar: '/img/avatar-athlete-1-128x128.jpg',
    name: 'Monica S.',
    role: 'Sentinel',
    text: 'I used to train at CrossFit but the cardio was just too much. I wasn\'t able to gain muscle because I was burning so many calories and didn\'t have the proper nutritional guidance. Ever since starting Hyrax everything has changed. I\'m stronger, healthier, and feel like I have more energy than ever.',
  },
  {
    avatar: '/img/avatar-athlete-2-128x128.jpg',
    name: 'Priya K.',
    role: 'Rock Runner',
    text: 'I travel for work three weeks out of the month and could never stick to a program. Hyrax sessions are short enough to fit into a hotel gym or a park near the airport. The customized routines adjust to whatever equipment I have access to that week.',
  },
  {
    avatar: '/img/avatar-athlete-3-128x128.jpg',
    name: 'James R.',
    role: 'Sentinel',
    text: 'The diet plan alone was worth the upgrade. I was eating well but not eating right for how I train. Within a few weeks my recovery improved and I stopped hitting that afternoon wall. The personal trainer adjustments each week keep things fresh too.',
  },
  /*
  {
    avatar: '/img/avatar-athlete-1-128x128.jpg',
    name: 'Derek T.',
    role: 'Rock Runner',
    text: 'I\'m 52 and was starting to feel like the gym wasn\'t built for me anymore. The Hyrax method gave me a system I can scale to my joints without feeling like I\'m going easy. My benchmark numbers keep climbing and I actually look forward to training days.',
  },
  {
    avatar: '/img/avatar-athlete-2-128x128.jpg',
    name: 'Sara L.',
    role: 'Pup',
    text: 'Started with Pup just to see what it was about. The movement tutorials made everything click and I felt confident enough to try a full session on my own after the first week. Already planning to move up to Rock Runner next month.',
  },
  {
    avatar: '/img/avatar-athlete-3-128x128.jpg',
    name: 'Marcus W.',
    role: 'Sentinel',
    text: 'Former rugby player, bad knees, and a decade of excuses. Hyrax gave me sled pushes and carries instead of running and box jumps. Six months in I\'m lighter, my knees feel better than they have in years, and I\'m hitting benchmarks I didn\'t think were realistic.',
  },
  */
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
