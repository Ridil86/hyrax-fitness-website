import { createContext, useContext, useState, useCallback } from 'react';
import { logConsentEvent } from '../api/audit';

const CookieConsentContext = createContext(null);

const STORAGE_KEY = 'hyrax_cookie_consent';

export function CookieConsentProvider({ children }) {
  // null = no decision yet, 'accepted', 'rejected'
  const [consentStatus, setConsentStatus] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'accepted' ? 'accepted' : null;
    } catch {
      return null;
    }
  });
  const loading = false;

  const acceptCookies = useCallback(() => {
    setConsentStatus('accepted');
    try {
      localStorage.setItem(STORAGE_KEY, 'accepted');
    } catch {
      // Silently fail if localStorage is unavailable
    }
    // Fire-and-forget audit log
    logConsentEvent({
      eventType: 'COOKIE_ACCEPT',
      consentValue: 'accepted',
    }).catch(() => {});
  }, []);

  const rejectCookies = useCallback(() => {
    // In-memory only; no localStorage write
    setConsentStatus('rejected');
    // Fire-and-forget audit log
    logConsentEvent({
      eventType: 'COOKIE_REJECT',
      consentValue: 'rejected',
    }).catch(() => {});
  }, []);

  const value = {
    consentStatus,
    showBanner: !loading && consentStatus === null,
    hasConsented: consentStatus === 'accepted',
    acceptCookies,
    rejectCookies,
  };

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) {
    throw new Error('useCookieConsent must be used within CookieConsentProvider');
  }
  return ctx;
}
