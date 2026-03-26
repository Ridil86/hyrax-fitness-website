import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../hooks/useCart';
import CartDrawer from './CartDrawer';
import './Header.css';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const { isAuthenticated, isAdmin } = useAuth();
  const { cartCount } = useCart();
  const location = useLocation();
  const closeCart = useCallback(() => setCartOpen(false), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMenuOpen(false); }, [location]);

  const closeMenu = () => setMenuOpen(false);

  const navLinks = [
    { to: '/#method', label: 'Method' },
    { to: '/about', label: 'About' },
    { to: '/events', label: 'Events' },
    { to: '/programs', label: 'Programs' },
    { to: '/merch', label: 'Merch' },
    { to: '/faq', label: 'FAQ' },
  ];

  return (
    <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
      <div className="wrap">
        <div className="nav">
          <Link className="brand" to="/" aria-label="Hyrax Fitness home">
            <img src="/img/hyrax-fitness-logo-512x512.png" alt="Hyrax Fitness logo" />
            <div className="name">
              <strong>HYRAX FITNESS</strong>
              <span>Scramble. Haul. Bolt. Recover.</span>
            </div>
          </Link>

          <button
            className="menuBtn"
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span className={`menuIcon ${menuOpen ? 'open' : ''}`} aria-hidden="true">
              <span className="dash" />
              <span className="dash" />
              <span className="dash" />
            </span>
          </button>

          <div className="menuPanel desktop">
            <nav className="links" aria-label="Primary">
              {navLinks.map(link => (
                <Link key={link.to} to={link.to}>{link.label}</Link>
              ))}
            </nav>
            <div className="cta">
              <button
                className="cart-btn"
                onClick={() => setCartOpen(true)}
                aria-label={`Cart (${cartCount} items)`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
              </button>
              {isAuthenticated ? (
                <>
                  {isAdmin && <Link className="btn ghost" to="/admin">Admin</Link>}
                  <Link className="btn primary" to="/portal">My Account</Link>
                </>
              ) : (
                <>
                  <Link className="btn ghost" to="/login">Sign In</Link>
                  <Link className="btn primary" to="/get-started">Get Started Free</Link>
                </>
              )}
            </div>
          </div>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                className="menuPanel mobile"
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <nav className="links" aria-label="Primary">
                  {navLinks.map(link => (
                    <Link key={link.to} to={link.to} onClick={closeMenu}>{link.label}</Link>
                  ))}
                </nav>
                <div className="cta">
                  <button
                    className="cart-btn"
                    onClick={() => { closeMenu(); setCartOpen(true); }}
                    aria-label={`Cart (${cartCount} items)`}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                    {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
                  </button>
                  {isAuthenticated ? (
                    <>
                      {isAdmin && <Link className="btn ghost" to="/admin" onClick={closeMenu}>Admin</Link>}
                      <Link className="btn primary" to="/portal" onClick={closeMenu}>My Account</Link>
                    </>
                  ) : (
                    <>
                      <Link className="btn ghost" to="/login" onClick={closeMenu}>Sign In</Link>
                      <Link className="btn primary" to="/get-started" onClick={closeMenu}>Get Started Free</Link>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <CartDrawer open={cartOpen} onClose={closeCart} />
    </header>
  );
}
