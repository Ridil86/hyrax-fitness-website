import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './Header.css';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  const navLinks = [
    { href: '#method', label: 'Method' },
    { href: '#workouts', label: 'Workouts' },
    { href: '#programs', label: 'Programs' },
    { href: '#gallery', label: 'Gallery' },
    { href: '#faq', label: 'FAQ' },
  ];

  return (
    <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
      <div className="wrap">
        <div className="nav">
          <a className="brand" href="#top" aria-label="Hyrax Fitness home">
            <img src="/img/hyrax-fitness-logo-512x512.png" alt="Hyrax Fitness logo" />
            <div className="name">
              <strong>HYRAX FITNESS</strong>
              <span>Scramble. Haul. Bolt. Recover.</span>
            </div>
          </a>

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
                <a key={link.href} href={link.href}>{link.label}</a>
              ))}
            </nav>
            <div className="cta">
              <a className="btn ghost" href="#programs">See programs</a>
              <a className="btn primary" href="#get-started">Get the starter plan</a>
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
                    <a key={link.href} href={link.href} onClick={closeMenu}>{link.label}</a>
                  ))}
                </nav>
                <div className="cta">
                  <a className="btn ghost" href="#programs" onClick={closeMenu}>See programs</a>
                  <a className="btn primary" href="#get-started" onClick={closeMenu}>Get the starter plan</a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
