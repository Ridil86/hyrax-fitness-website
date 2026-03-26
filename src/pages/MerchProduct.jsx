import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { fetchProduct } from '../api/fourthwall';
import { useCart } from '../context/CartContext';
import CartDrawer from '../components/CartDrawer';
import './merch-product.css';

function formatPrice(unitPrice) {
  if (!unitPrice) return '';
  const { value, currency } = unitPrice;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(value);
}

export default function MerchProduct() {
  const { slug } = useParams();
  const { addItem, loading: cartLoading, checkout } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mainImage, setMainImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [openSections, setOpenSections] = useState({});
  const closeCartDrawer = useCallback(() => setCartDrawerOpen(false), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const data = await fetchProduct(slug);
        if (!cancelled) {
          setProduct(data);
          // Pre-select first available size and color
          const variants = data.variants || [];
          const sizes = [...new Set(variants.map(v => v.attributes?.size?.name).filter(Boolean))];
          const colors = [...new Set(variants.map(v => v.attributes?.color?.name).filter(Boolean))];
          if (sizes.length > 0) setSelectedSize(sizes[0]);
          if (colors.length > 0) setSelectedColor(colors[0]);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [slug]);

  const variants = useMemo(() => product?.variants || [], [product]);

  // Extract unique sizes and colors
  const sizes = useMemo(() => {
    return [...new Set(variants.map(v => v.attributes?.size?.name).filter(Boolean))];
  }, [variants]);

  const colors = useMemo(() => {
    const seen = new Map();
    variants.forEach(v => {
      const c = v.attributes?.color;
      if (c?.name && !seen.has(c.name)) seen.set(c.name, c.swatch || '#888');
    });
    return Array.from(seen.entries()).map(([name, swatch]) => ({ name, swatch }));
  }, [variants]);

  // Find the matching variant
  const selectedVariant = useMemo(() => {
    if (variants.length === 1) return variants[0];
    return variants.find(v => {
      const sizeMatch = !sizes.length || v.attributes?.size?.name === selectedSize;
      const colorMatch = !colors.length || v.attributes?.color?.name === selectedColor;
      return sizeMatch && colorMatch;
    }) || variants[0];
  }, [variants, selectedSize, selectedColor, sizes.length, colors.length]);

  const images = product?.images || selectedVariant?.images || [];
  const isSoldOut = product?.state?.type === 'SOLD_OUT';
  const variantOutOfStock = selectedVariant?.stock?.type === 'LIMITED' && !selectedVariant?.stock?.inStock;
  const isLimited = selectedVariant?.stock?.type === 'LIMITED' && selectedVariant?.stock?.inStock > 0;
  const canAdd = !isSoldOut && !variantOutOfStock && selectedVariant;

  const handleAdd = async () => {
    if (!canAdd || !selectedVariant) return;
    try {
      await addItem(selectedVariant.id, quantity);
      setAdded(true);
    } catch {
      // Could show error toast
    }
  };

  const toggleSection = (key) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="merch-product-page">
        <div className="merch-product-loading">Loading product...</div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="merch-product-page">
        <div className="merch-product-error">
          <p>Unable to load this product.</p>
          <Link to="/merch" className="merch-product-back">Back to Merch</Link>
        </div>
      </div>
    );
  }

  const additionalInfo = product.additionalInformation || [];

  return (
    <div className="merch-product-page">
      <Link to="/merch" className="merch-product-back">
        &larr; All Products
      </Link>

      <div className="merch-product-layout">
        {/* Gallery */}
        <div className="merch-gallery">
          <div className="merch-gallery-main">
            {images[mainImage] && (
              <img
                src={images[mainImage].url || images[mainImage].transformedUrl}
                alt={product.name}
              />
            )}
          </div>
          {images.length > 1 && (
            <div className="merch-gallery-thumbs">
              {images.map((img, i) => (
                <button
                  key={img.id || i}
                  className={`merch-thumb ${i === mainImage ? 'active' : ''}`}
                  onClick={() => setMainImage(i)}
                  aria-label={`View image ${i + 1}`}
                >
                  <img src={img.url || img.transformedUrl} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="merch-details">
          <h1 className="merch-product-name">{product.name}</h1>

          <div className="merch-product-price">
            {selectedVariant ? formatPrice(selectedVariant.unitPrice) : ''}
          </div>

          {product.description && (
            <div
              className="merch-product-description"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }}
            />
          )}

          {/* Size selector */}
          {sizes.length > 0 && (
            <div className="merch-variant-group">
              <span className="merch-variant-label">Size</span>
              <div className="merch-size-options">
                {sizes.map(size => (
                  <button
                    key={size}
                    className={`merch-size-btn ${selectedSize === size ? 'selected' : ''}`}
                    onClick={() => setSelectedSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color selector */}
          {colors.length > 0 && (
            <div className="merch-variant-group">
              <span className="merch-variant-label">
                Color{selectedColor ? `: ${selectedColor}` : ''}
              </span>
              <div className="merch-color-options">
                {colors.map(c => (
                  <button
                    key={c.name}
                    className={`merch-color-swatch ${selectedColor === c.name ? 'selected' : ''}`}
                    onClick={() => setSelectedColor(c.name)}
                    aria-label={c.name}
                    title={c.name}
                  >
                    <span
                      className="merch-color-swatch-inner"
                      style={{ background: c.swatch }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stock status */}
          {isSoldOut ? (
            <span className="merch-stock sold-out">Sold Out</span>
          ) : variantOutOfStock ? (
            <span className="merch-stock sold-out">This variant is out of stock</span>
          ) : isLimited ? (
            <span className="merch-stock limited">
              Only {selectedVariant.stock.inStock} left
            </span>
          ) : (
            <span className="merch-stock in-stock">In Stock</span>
          )}

          {/* Quantity + Add to Cart */}
          {canAdd && (
            <>
              <div className="merch-variant-group">
                <span className="merch-variant-label">Quantity</span>
                <div className="merch-quantity">
                  <button
                    className="merch-qty-btn"
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <span className="merch-qty-value">{quantity}</span>
                  <button
                    className="merch-qty-btn"
                    onClick={() => setQuantity(q => Math.min(10, q + 1))}
                    disabled={quantity >= 10}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                className="merch-add-btn"
                onClick={handleAdd}
                disabled={cartLoading}
              >
                {cartLoading ? 'Adding...' : 'Add to Cart'}
              </button>
            </>
          )}

          {!canAdd && (
            <button className="merch-add-btn" disabled>Sold Out</button>
          )}

          {added && (
            <div className="merch-post-add">
              <p className="merch-added-msg">Added to cart!</p>
              <div className="merch-post-add-actions">
                <button
                  className="merch-view-cart-btn"
                  onClick={() => setCartDrawerOpen(true)}
                >
                  View Cart
                </button>
                <button
                  className="merch-checkout-btn"
                  onClick={checkout}
                >
                  Checkout
                </button>
              </div>
            </div>
          )}

          {/* Additional info accordion */}
          {additionalInfo.length > 0 && (
            <div className="merch-info-sections">
              {additionalInfo.map((info) => (
                <div key={info.type}>
                  <button
                    className="merch-info-toggle"
                    onClick={() => toggleSection(info.type)}
                  >
                    {info.title}
                    <span className={`merch-info-arrow ${openSections[info.type] ? 'open' : ''}`}>
                      &#9660;
                    </span>
                  </button>
                  {openSections[info.type] && (
                    <div
                      className="merch-info-content"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(info.bodyHtml || '') }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <CartDrawer open={cartDrawerOpen} onClose={closeCartDrawer} />
    </div>
  );
}
