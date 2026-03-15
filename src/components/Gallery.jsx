import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import ScrollReveal from './ScrollReveal';
import LazyImage from './LazyImage';
import './Gallery.css';

const images = {
  left: [
    { src: '/img/gallery-sunrise-outcrop-1400x1600.jpg', alt: 'Sunrise over rocky terrain', tall: true },
    { src: '/img/gallery-crawl-training-1400x900.jpg', alt: 'Crawl training outdoors' },
  ],
  right: [
    { src: '/img/gallery-sled-push-1200x900.jpg', alt: 'Sled push training' },
    { src: '/img/gallery-farmer-carry-1200x900.jpg', alt: 'Farmer carry close-up' },
    { src: '/img/gallery-group-session-1200x900.jpg', alt: 'Group training session outdoors' },
  ],
};

export default function Gallery() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.05 });

  return (
    <section id="gallery">
      <div className="wrap">
        <ScrollReveal>
          <div className="sectionHead">
            <div>
              <h2>The Hyrax Vibe</h2>
            </div>
          </div>
        </ScrollReveal>

        <div className="gallery" ref={ref} aria-label="Gallery">
          <div className="left">
            {images.left.map((img, i) => (
              <motion.div
                className={`gImg ${img.tall ? 'tall' : ''}`}
                key={img.src}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.6, delay: i * 0.1 }}
              >
                <LazyImage src={img.src} alt={img.alt} style={{ width: '100%', height: '100%' }} />
              </motion.div>
            ))}
          </div>
          <div className="right">
            {images.right.map((img, i) => (
              <motion.div
                className="gImg"
                key={img.src}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.6, delay: (i + 2) * 0.1 }}
              >
                <LazyImage src={img.src} alt={img.alt} style={{ width: '100%', height: '100%' }} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
