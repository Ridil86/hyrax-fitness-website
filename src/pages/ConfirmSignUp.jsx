import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './auth.css';

export default function ConfirmSignUp() {
  const { confirmSignUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const passedEmail = location.state?.email || '';

  const [email, setEmail] = useState(passedEmail);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await confirmSignUp(email, code);
      navigate('/login', { state: { confirmed: true } });
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Verify Email</h2>
        <p className="auth-subtitle">
          Enter the 6-digit code sent to your email.
        </p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          {!passedEmail && (
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
              />
            </div>
          )}
          <div className="auth-field">
            <label htmlFor="code">Verification Code</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              className="auth-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              required
              autoFocus={!!passedEmail}
              autoComplete="one-time-code"
            />
          </div>
          <button
            className="auth-submit"
            type="submit"
            disabled={submitting || code.length !== 6}
          >
            {submitting ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>
        <p className="auth-links">
          Already verified? <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
