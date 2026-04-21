import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ScrollReveal from '../components/ScrollReveal';
import { fetchProducts } from '../api/fourthwall';
import './merch.css';

function formatPrice(unitPrice) {
  if (!unitPrice) return '';
  const { value, currency } = unitPrice;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(value);
}

function SkeletonCard() {
  return (
    <div className="merch-card merch-skeleton">
      <div className="merch-card-image-wrap" />
      <div className="merch-card-info">
        <div className="merch-skeleton-line" />
        <div className="merch-skeleton-line short" />
      </div>
    </div>
  );
}

export default function Merch() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    async function load() {
      try {
        const data = await fetchProducts(0, 50);
        if (!cancelled) setProducts(data.results || []);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          console.error('Merch load failed', { status: err.status, message: err.message });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [retryKey]);

  const getImage = (product, index = 0) => {
    const img = product.images?.[index];
    return img?.url || img?.transformedUrl || '';
  };

  const getPrice = (product) => {
    const variant = product.variants?.[0];
    return variant?.unitPrice ? formatPrice(variant.unitPrice) : '';
  };

  const isSoldOut = (product) => product.state?.type === 'SOLD_OUT';

  return (
    <div className="merch-page">
      <ScrollReveal>
        <div className="merch-hero">
          <h1>Merch</h1>
          <p>Rep the colony. Gear built for hyrax-level grit.</p>
        </div>
      </ScrollReveal>

      {error && (
        <div className="merch-empty">
          <p>Unable to load products right now.</p>
          <button
            type="button"
            className="btn primary"
            onClick={() => setRetryKey((k) => k + 1)}
          >
            Try Again
          </button>
        </div>
      )}

      {!error && loading && (
        <div className="merch-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!error && !loading && products.length === 0 && (
        <div className="merch-empty">
          <p>New merch dropping soon. Stay tuned.</p>
        </div>
      )}

      {!error && !loading && products.length > 0 && (
        <div className="merch-grid">
          {products.map((product) => (
            <ScrollReveal key={product.id}>
              <Link to={`/merch/${product.slug}`} className="merch-card">
                <div className="merch-card-image-wrap">
                  {getImage(product) && (
                    <img
                      className="merch-card-img-primary"
                      src={getImage(product)}
                      alt={product.name}
                      loading="lazy"
                    />
                  )}
                  {getImage(product, 1) && (
                    <img
                      className="merch-card-img-hover"
                      src={getImage(product, 1)}
                      alt={`${product.name} alternate view`}
                      loading="lazy"
                    />
                  )}
                  {isSoldOut(product) && (
                    <span className="merch-sold-out-badge">Sold Out</span>
                  )}
                </div>
                <div className="merch-card-info">
                  <p className="merch-card-name">{product.name}</p>
                  <p className="merch-card-price">{getPrice(product)}</p>
                </div>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      )}
    </div>
  );
}
