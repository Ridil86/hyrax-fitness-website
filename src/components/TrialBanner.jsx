import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { trialDaysRemaining } from '../utils/tiers';
import './trial-banner.css';

/**
 * Trial banner shown on portal pages during active free trial.
 *
 * @param {Object} props
 * @param {boolean} [props.compact] - Use compact variant for feature pages
 * @param {string} [props.featureName] - Name of the feature being used (e.g. "Custom Routines")
 */
export default function TrialBanner({ compact = false, featureName }) {
  const { trialActive, trialEndsAt } = useAuth();

  if (!trialActive) return null;

  const daysLeft = trialDaysRemaining({ trialEndsAt });
  const isUrgent = daysLeft <= 2;
  const endDate = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : '';

  const className = [
    'trial-banner',
    compact && 'trial-banner--compact',
    isUrgent && 'trial-banner--urgent',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      <div className="trial-banner__body">
        <span className="trial-banner__icon" aria-hidden="true">
          {isUrgent ? '\u23F3' : '\u2B50'}
        </span>
        <div className="trial-banner__text">
          {compact && featureName ? (
            <>
              <strong>Free trial</strong> {' \u2014 '}
              {isUrgent
                ? `Your trial ends ${daysLeft === 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`}. Subscribe to keep using ${featureName}.`
                : `You're using ${featureName} as part of your free trial. ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining.`}
            </>
          ) : (
            <>
              <strong>
                Free trial {' \u2014 '}
                {daysLeft === 0
                  ? 'Last day!'
                  : daysLeft === 1
                    ? '1 day remaining'
                    : `${daysLeft} days remaining`}
              </strong>
              {isUrgent
                ? `Your trial ends ${endDate}. Subscribe now to keep full access to all features.`
                : 'You have full access to all features. Subscribe to keep access after your trial ends.'}
            </>
          )}
        </div>
      </div>
      <Link to="/portal/subscription" className="trial-banner__cta">
        Subscribe now &#8594;
      </Link>
    </div>
  );
}
