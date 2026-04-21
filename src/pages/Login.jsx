import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleIcon from '../components/GoogleIcon';
import './auth.css';

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [challengeState, setChallengeState] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleRedirecting, setGoogleRedirecting] = useState(false);

  const flash = location.state?.confirmed
    ? 'Email verified. You can now sign in.'
    : location.state?.passwordReset
    ? 'Password reset. Sign in with your new password.'
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const result = await signIn(email, password);

      if (result.nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
        navigate('/confirm', { state: { email } });
        return;
      }

      if (result.nextStep?.signInStep === 'DONE') {
        navigate('/portal');
        return;
      }

      // NEW_PASSWORD_REQUIRED challenge (admin-created users)
      if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        setChallengeState('NEW_PASSWORD');
        return;
      }
    } catch (err) {
      setError(err.message || 'Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const { confirmSignIn } = await import('aws-amplify/auth');
      const result = await confirmSignIn({ challengeResponse: newPassword });
      if (result.isSignedIn) {
        // Refresh auth state by reloading
        window.location.href = '/admin';
      }
    } catch (err) {
      setError(err.message || 'Failed to set new password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleClick = () => {
    sessionStorage.setItem('hyrax-google-intent', 'login');
    setGoogleRedirecting(true);
    signInWithGoogle();
  };

  // New password challenge form
  if (challengeState === 'NEW_PASSWORD') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h2>Set New Password</h2>
          <p className="auth-subtitle">Your account requires a new password.</p>
          {error && <div className="auth-error">{error}</div>}
          <form onSubmit={handleNewPassword}>
            <div className="auth-field">
              <label htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                autoFocus
              />
              <p className="auth-hint">
                At least 8 characters with uppercase, lowercase, and a number.
              </p>
            </div>
            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? 'Setting Password...' : 'Set Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Sign In</h2>
        <p className="auth-subtitle">Welcome back to Hyrax Fitness</p>
        {flash && <div className="auth-success">{flash}</div>}
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              autoFocus
            />
          </div>
          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
              autoComplete="current-password"
            />
          </div>
          <div className="auth-field-row">
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="auth-google-btn"
          onClick={handleGoogleClick}
          disabled={googleRedirecting || submitting}
        >
          <GoogleIcon />
          <span>{googleRedirecting ? 'Redirecting to Google...' : 'Login with Google'}</span>
        </button>

        <p className="auth-links">
          Don't have an account? <Link to="/get-started">Get Started</Link>
        </p>
      </div>
    </div>
  );
}
