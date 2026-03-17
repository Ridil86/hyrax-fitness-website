import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCookieConsent } from '../context/CookieConsentContext';
import './CookieConsent.css';

export default function CookieConsent() {
  const { showBanner, acceptCookies, rejectCookies } = useCookieConsent();

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          className="cookie-banner"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className="wrap">
            <div className="cookie-banner-inner">
              <div className="cookie-banner-text">
                <strong>We value your privacy</strong>
                <p>
                  We use cookies to enhance your experience, remember your preferences,
                  and improve our services. You can accept or reject non-essential cookies.
                  For more details, see our{' '}
                  <Link to="/cookie-policy">Cookie Policy</Link>,{' '}
                  <Link to="/privacy">Privacy Policy</Link>, and{' '}
                  <Link to="/terms">Terms of Use</Link>.
                </p>
              </div>
              <div className="cookie-banner-actions">
                <button className="btn primary" onClick={acceptCookies}>
                  Accept
                </button>
                <button className="btn ghost" onClick={rejectCookies}>
                  Reject
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
