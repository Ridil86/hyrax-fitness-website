import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import './HowItWorks.css';

const steps = [
  { num: '1', title: 'Sign up free', desc: 'Create your account in under a minute. No credit card required.' },
  { num: '2', title: 'Build your profile', desc: 'Tell us your goals, equipment, and schedule. We handle the rest.' },
  { num: '3', title: 'Start training', desc: 'Get your first custom workout and nutrition plan today.' },
];

export default function HowItWorks() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.15 });

  return (
    <section id="how-it-works" className="how-it-works">
      <div className="wrap">
        <div className="how-steps" ref={ref}>
          {steps.map((step, i) => (
            <motion.div
              className="how-step"
              key={step.num}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.12 }}
            >
              <div className="how-step-num">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
