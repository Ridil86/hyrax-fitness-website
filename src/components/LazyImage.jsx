import { useState } from 'react';
import { useInView } from 'react-intersection-observer';

export default function LazyImage({ src, alt, className = '', style = {}, ...props }) {
  const [loaded, setLoaded] = useState(false);
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: '200px' });

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      {inView && (
        <img
          src={src}
          alt={alt}
          className={`${className} lazy-img ${loaded ? 'loaded' : ''}`}
          onLoad={() => setLoaded(true)}
          {...props}
        />
      )}
    </div>
  );
}
