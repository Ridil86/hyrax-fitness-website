import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import './cart-drawer.css';

function formatPrice(unitPrice) {
  if (!unitPrice) return '';
  const { value, currency } = unitPrice;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(value / 100);
}

export default function CartDrawer({ open, onClose }) {
  const { cart, cartCount, loading, updateQuantity, removeItem, checkout } = useCart();

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const items = cart?.items || [];

  const subtotal = items.reduce((sum, item) => {
    const price = item.variant?.unitPrice?.value || 0;
    return sum + price * item.quantity;
  }, 0);

  const currency = items[0]?.variant?.unitPrice?.currency || 'USD';

  const formatSubtotal = () =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(subtotal / 100);

  return (
    <>
      <div className="cart-backdrop" onClick={onClose} />
      <div className="cart-drawer" role="dialog" aria-label="Shopping cart">
        <div className="cart-drawer-header">
          <h2>Cart ({cartCount})</h2>
          <button className="cart-drawer-close" onClick={onClose} aria-label="Close cart">
            &times;
          </button>
        </div>

        {items.length === 0 ? (
          <div className="cart-empty">
            <p>Your cart is empty</p>
            <Link to="/merch" onClick={onClose}>Browse Merch</Link>
          </div>
        ) : (
          <>
            <div className="cart-drawer-items">
              {items.map((item) => {
                const img = item.variant?.images?.[0] || item.product?.images?.[0];
                const variantName = item.variant?.name;
                return (
                  <div key={item.variant?.id} className="cart-item">
                    <div className="cart-item-image">
                      {img && <img src={img.url || img.transformedUrl} alt="" />}
                    </div>
                    <div className="cart-item-details">
                      <p className="cart-item-name">{item.product?.name || 'Product'}</p>
                      {variantName && (
                        <p className="cart-item-variant">{variantName}</p>
                      )}
                      <div className="cart-item-bottom">
                        <span className="cart-item-price">
                          {formatPrice(item.variant?.unitPrice)}
                        </span>
                        <div className="cart-item-qty">
                          <button
                            onClick={() => updateQuantity(item.variant?.id, item.quantity - 1)}
                            disabled={loading || item.quantity <= 1}
                            aria-label="Decrease"
                          >
                            -
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.variant?.id, item.quantity + 1)}
                            disabled={loading || item.quantity >= 10}
                            aria-label="Increase"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <button
                        className="cart-item-remove"
                        onClick={() => removeItem(item.variant?.id)}
                        disabled={loading}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="cart-drawer-footer">
              <div className="cart-subtotal">
                <span className="cart-subtotal-label">Subtotal</span>
                <span className="cart-subtotal-value">{formatSubtotal()}</span>
              </div>
              <button
                className="cart-checkout-btn"
                onClick={checkout}
                disabled={loading || items.length === 0}
              >
                Checkout
              </button>
              <button className="cart-continue" onClick={onClose}>
                Continue Shopping
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
