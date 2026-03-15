import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

const variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

export default function ScrollReveal({
  children,
  className = '',
  delay = 0,
  duration = 0.6,
  as = 'div',
  ...props
}) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const Component = motion.create(as);

  return (
    <Component
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={variants}
      transition={{ duration, delay, ease: 'easeOut' }}
      {...props}
    >
      {children}
    </Component>
  );
}
