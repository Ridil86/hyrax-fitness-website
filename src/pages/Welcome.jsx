import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './auth.css';

export default function Welcome() {
  const [searchParams] = useSearchParams();
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const email = searchParams.get('email') || '';
  const code = searchParams.get('code') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phase, setPhase] = useState('loading'); // loading | set-password | error | expired
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const signInAttempted = useRef(false);

  // Auto sign-in with temp password on mount
  useEffect(() => {
    if (signInAttempted.current) return;
    signInAttempted.current = true;

    if (!email || !code) {
      setPhase('error');
      setError('Invalid link. Please check your email and try again.');
      return;
    }

    (async () => {
      try {
        const result = await signIn(email, code);

        if (
          result.nextStep?.signInStep ===
          'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED'
        ) {
          setPhase('set-password');
        } else if (result.nextStep?.signInStep === 'DONE') {
          // Already set password somehow, go to portal
          navigate('/portal', { replace: true });
        } else {
          setPhase('set-password');
        }
      } catch (err) {
        console.error('Welcome sign-in error:', err);
        const msg = err.message || '';
        if (
          msg.includes('expired') ||
          msg.includes('Incorrect') ||
          msg.includes('NotAuthorizedException')
        ) {
          setPhase('expired');
        } else {
          setPhase('error');
          setError(msg || 'Failed to verify your account link.');
        }
      }
    })();
  }, [email, code, signIn, navigate]);

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);

    try {
      const { confirmSignIn } = await import('aws-amplify/auth');
      const result = await confirmSignIn({ challengeResponse: newPassword });
      if (result.isSignedIn) {
        // Full page reload to refresh auth state, then go to portal
        window.location.href = '/portal';
      }
    } catch (err) {
      setError(err.message || 'Failed to set password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (phase === 'loading') {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="section-spinner" style={{ margin: '20px auto' }} />
          <p style={{ color: 'var(--rock)', margin: 0 }}>
            Verifying your account...
          </p>
        </div>
      </div>
    );
  }

  // Expired link
  if (phase === 'expired') {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <h2>Link Expired</h2>
          <p className="auth-subtitle">
            This welcome link has expired or has already been used. Please
            contact us if you need a new one.
          </p>
          <Link to="/login" className="btn primary" style={{ marginTop: 12 }}>
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  // Error state
  if (phase === 'error') {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <h2>Something Went Wrong</h2>
          <p className="auth-subtitle">
            {error || 'We could not verify your account link.'}
          </p>
          <Link to="/login" className="btn primary" style={{ marginTop: 12 }}>
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  // Set password form
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Set Your Password</h2>
        <p className="auth-subtitle">
          Welcome to Hyrax Fitness! Choose a password to complete your account
          setup.
        </p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSetPassword}>
          <div className="auth-field">
            <label htmlFor="newPassword">Password</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Create a password"
              required
              autoFocus
              autoComplete="new-password"
            />
            <p className="auth-hint">
              At least 8 characters with uppercase, lowercase, and a number.
            </p>
          </div>
          <div className="auth-field">
            <label htmlFor="confirmNewPassword">Confirm Password</label>
            <input
              id="confirmNewPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              autoComplete="new-password"
            />
          </div>
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Setting Password...' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
