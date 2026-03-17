import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchProfile } from '../api/profile';

/**
 * Invisible component rendered on the homepage.
 * After a Google OAuth redirect lands on `/`, this checks whether the
 * user has a DynamoDB profile and routes them accordingly:
 *   - Profile exists  -> /portal
 *   - No profile      -> /get-started?google=1  (wizard Step 3: terms)
 */
export default function GoogleOAuthHandler() {
  const { isAuthenticated, loading, getIdToken } = useAuth();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (loading || !isAuthenticated || handled.current) return;

    const intent = sessionStorage.getItem('hyrax-google-intent');
    if (!intent) return; // Not a Google OAuth redirect

    handled.current = true;
    sessionStorage.removeItem('hyrax-google-intent');

    (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;

        const profile = await fetchProfile(token);

        if (profile) {
          // Returning Google user - has profile, go to portal
          navigate('/portal', { replace: true });
        } else {
          // New Google user - needs to accept terms first
          navigate('/get-started?google=1', { replace: true });
        }
      } catch {
        // No profile found (404 or error) - send to terms step
        navigate('/get-started?google=1', { replace: true });
      }
    })();
  }, [isAuthenticated, loading, getIdToken, navigate]);

  return null; // Renders nothing
}
