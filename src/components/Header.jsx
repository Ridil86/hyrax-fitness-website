import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import './Header.css';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  const closeMenu = () => setMenuOpen(false);

  const handleSignOut = async () => {
    closeMenu();
    await signOut();
    navigate('/');
  };

  const navLinks = [
    { to: '/#method', label: 'Method' },
    { to: '/programs', label: 'Programs' },
    { to: '/gallery', label: 'Gallery' },
    { to: '/faq', label: 'FAQ' },
    { to: '/workouts', label: 'Workouts' },
  ];

  // Add Portal link for authenticated users
  if (isAuthenticated) {
    navLinks.push({ to: '/portal', label: 'Portal' });
  }

  // Add Admin link for admin users
  if (isAdmin) {
    navLinks.push({ to: '/admin', label: 'Admin' });
  }

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
              {isAuthenticated ? (
                <button className="btn ghost" onClick={handleSignOut}>Sign Out</button>
              ) : (
                <Link className="btn primary" to="/login">Sign In</Link>
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
                  {isAuthenticated ? (
                    <button className="btn ghost" onClick={handleSignOut}>Sign Out</button>
                  ) : (
                    <Link className="btn primary" to="/login" onClick={closeMenu}>Sign In</Link>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
