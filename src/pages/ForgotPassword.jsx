import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import { validatePassword } from '../utils/passwordPolicy';
import './auth.css';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [stage, setStage] = useState('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleRequest = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await resetPassword({ username: email });
      setStage('confirm');
    } catch (err) {
      setError(err.message || 'Failed to send reset code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const passwordIssue = validatePassword(newPassword);
    if (passwordIssue) {
      setError(passwordIssue);
      return;
    }

    setSubmitting(true);
    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword,
      });
      navigate('/login', { state: { passwordReset: true } });
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (stage === 'request') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h2>Reset Password</h2>
          <p className="auth-subtitle">
            Enter your email and we will send you a verification code.
          </p>
          {error && <div className="auth-error">{error}</div>}
          <form onSubmit={handleRequest}>
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
            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? 'Sending Code...' : 'Send Reset Code'}
            </button>
          </form>
          <p className="auth-links">
            Remembered it? <Link to="/login">Sign In</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Enter New Password</h2>
        <p className="auth-subtitle">
          We sent a 6-digit code to {email}. Enter it below along with your new password.
        </p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleConfirm}>
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
              autoFocus
              autoComplete="one-time-code"
            />
          </div>
          <div className="auth-field">
            <label htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Create a new password"
              required
              autoComplete="new-password"
            />
            <p className="auth-hint">
              At least 8 characters with uppercase, lowercase, and a number.
            </p>
          </div>
          <div className="auth-field">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
              required
              autoComplete="new-password"
            />
          </div>
          <button
            className="auth-submit"
            type="submit"
            disabled={submitting || code.length !== 6}
          >
            {submitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
        <p className="auth-links">
          <button
            type="button"
            className="auth-link-button"
            onClick={() => { setStage('request'); setCode(''); setError(''); }}
          >
            Use a different email
          </button>
        </p>
      </div>
    </div>
  );
}
