import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { createAccount } from '../api/signup';
import { createProfile } from '../api/profile';
import GoogleIcon from '../components/GoogleIcon';
import './intake-wizard.css';

const TOTAL_STEPS = 3;

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

function ProgressBar({ step }) {
  return (
    <div className="wizard-progress">
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className={`wizard-progress-step ${
            s < step ? 'done' : s === step ? 'active' : ''
          }`}
        />
      ))}
      <span className="wizard-step-label">
        {step <= TOTAL_STEPS ? `${step} of ${TOTAL_STEPS}` : ''}
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function IntakeWizard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, signInWithGoogle, getIdToken, loading: authLoading } = useAuth();

  // Detect if this is a Google user coming back from OAuth (step 3 only)
  const isGoogleUser = searchParams.get('google') === '1';

  const [step, setStep] = useState(isGoogleUser ? 3 : 1);
  const [direction, setDirection] = useState(1);
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [email, setEmail] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If Google user lands here but is not authenticated yet, wait for auth
  useEffect(() => {
    if (isGoogleUser && !authLoading && !isAuthenticated) {
      // Not authenticated - redirect to home (auth may have failed)
      navigate('/', { replace: true });
    }
  }, [isGoogleUser, authLoading, isAuthenticated, navigate]);

  const goNext = () => {
    setDirection(1);
    setStep((s) => s + 1);
    setError('');
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => s - 1);
    setError('');
  };

  const handleGoogleSignIn = () => {
    sessionStorage.setItem('hyrax-google-intent', 'signup');
    signInWithGoogle();
  };

  const handleSubmit = async () => {
    if (!termsAccepted || !privacyAccepted) {
      setError('Please accept both the Terms of Use and Privacy Policy.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      if (isGoogleUser) {
        // Google user: create profile via authenticated endpoint
        const token = await getIdToken();
        await createProfile(token, {
          termsAccepted: true,
          privacyAccepted: true,
        });
        // Navigate to portal
        navigate('/portal', { replace: true });
      } else {
        // Normal user: create account via public signup endpoint
        await createAccount({
          givenName,
          familyName,
          email,
          termsAccepted: true,
          privacyAccepted: true,
        });
        setDirection(1);
        setStep(4); // success step
      }
    } catch (err) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const canProceedStep1 = givenName.trim() && familyName.trim();
  const canProceedStep2 = email.trim() && email.includes('@');

  return (
    <section className="wizard-page">
      <div className="wizard-card">
        {step <= TOTAL_STEPS && <ProgressBar step={step} />}

        <AnimatePresence mode="wait" custom={direction}>
          {step === 1 && (
            <motion.div
              key="step1"
              className="wizard-step"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <h2>What is your name?</h2>
              <p className="wizard-subtitle">
                Let us know who you are so we can personalize your experience.
              </p>

              <div className="wizard-name-row">
                <div className="wizard-field">
                  <label htmlFor="wizard-given">First Name</label>
                  <input
                    id="wizard-given"
                    type="text"
                    value={givenName}
                    onChange={(e) => setGivenName(e.target.value)}
                    placeholder="First name"
                    autoFocus
                  />
                </div>
                <div className="wizard-field">
                  <label htmlFor="wizard-family">Last Name</label>
                  <input
                    id="wizard-family"
                    type="text"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div className="wizard-actions">
                <button
                  className="btn primary"
                  onClick={goNext}
                  disabled={!canProceedStep1}
                >
                  Next
                </button>
              </div>

              <div className="wizard-divider">
                <span>or</span>
              </div>

              <button
                type="button"
                className="google-btn"
                onClick={handleGoogleSignIn}
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              className="wizard-step"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <h2>What is your email?</h2>
              <p className="wizard-subtitle">
                We will use this to create your account and send you a welcome email.
              </p>

              <div className="wizard-field">
                <label htmlFor="wizard-email">Email Address</label>
                <input
                  id="wizard-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                />
              </div>

              <div className="wizard-actions">
                <button className="btn wizard-back" onClick={goBack}>
                  Back
                </button>
                <button
                  className="btn primary"
                  onClick={goNext}
                  disabled={!canProceedStep2}
                >
                  Next
                </button>
              </div>

              <div className="wizard-divider">
                <span>or</span>
              </div>

              <button
                type="button"
                className="google-btn"
                onClick={handleGoogleSignIn}
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              className="wizard-step"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <h2>Almost there!</h2>
              <p className="wizard-subtitle">
                Please review and accept our policies to {isGoogleUser ? 'continue' : 'create your account'}.
              </p>

              {error && <div className="wizard-error">{error}</div>}

              <label className="wizard-checkbox">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                <span>
                  I agree to the{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer">
                    Terms of Use
                  </a>
                </span>
              </label>

              <label className="wizard-checkbox">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                />
                <span>
                  I agree to the{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer">
                    Privacy Policy
                  </a>
                </span>
              </label>

              <div className="wizard-actions">
                {!isGoogleUser && (
                  <button
                    className="btn wizard-back"
                    onClick={goBack}
                    disabled={submitting}
                  >
                    Back
                  </button>
                )}
                <button
                  className="btn primary"
                  onClick={handleSubmit}
                  disabled={submitting || !termsAccepted || !privacyAccepted}
                >
                  {submitting
                    ? (isGoogleUser ? 'Setting up...' : 'Creating Account...')
                    : (isGoogleUser ? 'Accept & Continue' : 'Create My Account')}
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              className="wizard-step wizard-success"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <div className="wizard-success-icon">
                <CheckIcon />
              </div>
              <h2>Account created!</h2>
              <p>
                We sent a welcome email to{' '}
                <span className="wizard-email-highlight">{email}</span> with a
                link to set up your password.
              </p>
              <p>Check your inbox to get started.</p>
              <Link to="/login" className="wizard-success-link">
                Already set up? Sign In
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
