import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTiers } from '../../hooks/useTiers';
import {
  fetchSubscription,
  createCheckoutSession,
  createPortalSession,
  cancelSubscription,
} from '../../api/subscription';
import { motion } from 'framer-motion';
import { trackSubscriptionUpgrade } from '../../utils/analytics';
import { trialDaysRemaining } from '../../utils/tiers';
import './portal-subscription.css';

function tierClass(name) {
  if (!name) return 'pup';
  const t = name.toLowerCase();
  if (t.includes('iron') || t.includes('dassie')) return 'iron-dassie';
  if (t.includes('runner') || t.includes('rock')) return 'rock-runner';
  return 'pup';
}

function formatDate(iso) {
  if (!iso) return '--';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function PortalSubscription() {
  const { getIdToken, userTier, trialActive, trialEndsAt, refreshTier } = useAuth();
  const { tiers, loading: tiersLoading } = useTiers();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // tierId being processed
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const upgradeTierRef = useRef(null);

  const loadSubscription = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (token) {
        const result = await fetchSubscription(token);
        setSubscription(result.subscription);
      }
    } catch (err) {
      console.error('Failed to load subscription:', err);
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  // Handle return from Stripe Checkout
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success') {
      setSuccessMsg('Your subscription has been activated! Welcome aboard.');
      loadSubscription();
      // Poll refreshTier to catch webhook update (arrives within 1-5s typically)
      let attempts = 0;
      const maxAttempts = 5;
      const pollTier = () => {
        if (attempts >= maxAttempts) return;
        attempts++;
        if (refreshTier) refreshTier();
        loadSubscription();
        if (attempts < maxAttempts) {
          setTimeout(pollTier, 2000);
        }
      };
      // Start polling after a short initial delay for webhook to arrive
      setTimeout(pollTier, 1500);
      // Clean up URL
      setSearchParams({}, { replace: true });
      setTimeout(() => setSuccessMsg(''), 10000);
    } else if (status === 'cancelled') {
      setError('Checkout was cancelled. No changes were made.');
      setSearchParams({}, { replace: true });
      setTimeout(() => setError(null), 5000);
    }
  }, [searchParams, setSearchParams, refreshTier, loadSubscription]);

  const handleUpgrade = useCallback(async (tierId) => {
    setActionLoading(tierId);
    setError(null);
    try {
      const selectedTier = tiers.find((t) => t.id === tierId);
      trackSubscriptionUpgrade(userTier || 'Pup', selectedTier?.name || tierId);
      const token = await getIdToken();
      const result = await createCheckoutSession(token, tierId);

      if (result.url) {
        // Redirect to Stripe Checkout
        window.location.href = result.url;
      } else if (result.updated) {
        // Subscription was updated inline (plan switch)
        setSuccessMsg('Your plan has been updated!');
        if (refreshTier) refreshTier();
        await loadSubscription();
        setTimeout(() => setSuccessMsg(''), 5000);
      }
    } catch (err) {
      setError(err.message || 'Failed to start checkout. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }, [getIdToken, refreshTier, loadSubscription, tiers, userTier]);

  // Handle pending upgrade from /programs page
  useEffect(() => {
    const upgradeTierId = searchParams.get('upgradeTier');
    if (upgradeTierId && !loading && !tiersLoading) {
      upgradeTierRef.current = upgradeTierId;
      // Clean up URL param
      setSearchParams({}, { replace: true });
      // Auto-trigger upgrade for the requested tier
      handleUpgrade(upgradeTierId);
    }
  }, [searchParams, setSearchParams, loading, tiersLoading, handleUpgrade]);

  const handleCancel = async () => {
    setActionLoading('cancel');
    setError(null);
    try {
      const token = await getIdToken();
      const result = await cancelSubscription(token);
      setSuccessMsg(
        `Your subscription will be cancelled on ${formatDate(result.effectiveAt)}. You'll keep your current access until then.`
      );
      setShowCancelConfirm(false);
      await loadSubscription();
      setTimeout(() => setSuccessMsg(''), 10000);
    } catch (err) {
      setError(err.message || 'Failed to cancel subscription.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setActionLoading('portal');
    setError(null);
    try {
      const token = await getIdToken();
      const result = await createPortalSession(token);
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      setError(err.message || 'Failed to open billing portal.');
    } finally {
      setActionLoading(null);
    }
  };

  // Determine current tier level for comparison
  const currentTierLevel = tiers.find(
    (t) => t.name === userTier || t.id === subscription?.tierId
  )?.level || 1;

  const currentTierData = tiers.find((t) => t.name === userTier);

  const isActive =
    subscription?.status === 'active' && !subscription?.cancelAtPeriodEnd;
  const isCancelling =
    subscription?.status === 'active' && subscription?.cancelAtPeriodEnd;

  if (loading || tiersLoading) {
    return (
      <div>
        <div className="portal-header">
          <h1>Subscription</h1>
          <p>Loading your subscription details...</p>
        </div>
        <div className="portal-skeleton">
          <div className="portal-skeleton-block" />
          <div className="portal-skeleton-block short" />
        </div>
      </div>
    );
  }

  return (
    <div className="portal-subscription">
      <div className="portal-header">
        <h1>Subscription</h1>
        <p>Manage your Hyrax Fitness plan</p>
      </div>

      {/* Messages */}
      {successMsg && (
        <motion.div
          className="sub-message sub-message-success"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {successMsg}
        </motion.div>
      )}
      {error && (
        <motion.div
          className="sub-message sub-message-error"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {error}
        </motion.div>
      )}

      {/* Current Plan Card */}
      <div className="portal-card sub-current-plan">
        <h3>Current Plan</h3>
        <div className="sub-current-info">
          {currentTierData?.logoUrl && (
            <img
              src={currentTierData.logoUrl}
              alt={`${userTier} logo`}
              className="sub-current-logo"
            />
          )}
          <div className="sub-current-info-text">
            <span className={`portal-tier ${tierClass(userTier)}`}>
              {userTier || 'Pup'}
            </span>
            {isActive && (
              <span className="sub-status sub-status-active">Active</span>
            )}
            {isCancelling && (
              <span className="sub-status sub-status-cancelling">
                Cancelling
              </span>
            )}
            {!subscription && (
              <span className="sub-status sub-status-free">Free Plan</span>
            )}
          </div>
        </div>

        {/* Current plan features */}
        {currentTierData?.features && currentTierData.features.length > 0 && (
          <div className="sub-current-features">
            <div className="sub-current-price">
              {currentTierData.priceInCents === 0
                ? 'Free'
                : `$${(currentTierData.priceInCents / 100).toFixed(0)}/mo`}
            </div>
            <ul className="sub-tier-features">
              {currentTierData.features.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        {subscription && subscription.status === 'active' && (
          <div className="sub-current-details">
            {subscription.tier && (
              <div className="sub-detail-row">
                <span className="sub-detail-label">Monthly Cost</span>
                <span className="sub-detail-value">
                  {subscription.tier.price}
                </span>
              </div>
            )}
            <div className="sub-detail-row">
              <span className="sub-detail-label">
                {isCancelling ? 'Access Until' : 'Next Billing'}
              </span>
              <span className="sub-detail-value">
                {formatDate(subscription.currentPeriodEnd)}
              </span>
            </div>
          </div>
        )}

        {isCancelling && (
          <p className="sub-cancelling-notice">
            Your subscription is set to cancel at the end of the current billing
            period. You'll retain access to your current tier until then.
          </p>
        )}

        {/* Manage Billing button for active subscribers */}
        {subscription?.stripeSubscriptionId && (
          <div className="sub-current-actions">
            <button
              className="btn ghost small"
              onClick={handleManageBilling}
              disabled={actionLoading === 'portal'}
            >
              {actionLoading === 'portal'
                ? 'Opening...'
                : 'Manage Billing & Invoices'}
            </button>
          </div>
        )}
      </div>

      {/* Trial Info */}
      {trialActive && (() => {
        const daysLeft = trialDaysRemaining({ trialEndsAt });
        const endDate = trialEndsAt
          ? new Date(trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : '';
        const isUrgent = daysLeft <= 2;
        return (
          <div className={`portal-card sub-trial-card${isUrgent ? ' sub-trial-urgent' : ''}`}>
            <div className="sub-trial-header">
              <span style={{ fontSize: '1.4rem' }}>{isUrgent ? '\u23F3' : '\u2B50'}</span>
              <div>
                <h3 style={{ margin: 0 }}>
                  Free Trial {' \u2014 '}
                  {daysLeft === 0 ? 'Last day!' : daysLeft === 1 ? '1 day remaining' : `${daysLeft} days remaining`}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '.9rem', color: 'var(--rock)' }}>
                  You have full access to all Iron Dassie features until {endDate}.
                  {userTier === 'Pup'
                    ? ' Subscribe to a plan below to keep access after your trial ends.'
                    : ` You're subscribed to ${userTier}, but your trial gives you Iron Dassie access until it expires.`}
                </p>
              </div>
            </div>
            {userTier === 'Pup' && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--paper)', borderRadius: 'calc(var(--radius) - 4px)', fontSize: '.88rem', color: 'var(--earth)' }}>
                <strong>When your trial ends:</strong> You'll revert to the free Pup plan and lose access to Custom Routines, Nutrition Plans, Personal Coach, Benchmarks, and Progress Tracking.
              </div>
            )}
          </div>
        );
      })()}

      {/* Available Plans */}
      <div className="portal-card">
        <h3>Available Plans</h3>
        <div className="sub-tiers-grid">
          {tiers.map((tier) => {
            const isCurrent = tier.level === currentTierLevel;
            const isUpgrade = tier.level > currentTierLevel;
            const isDowngrade = tier.level < currentTierLevel;
            const isFree = tier.priceInCents === 0;

            return (
              <motion.div
                key={tier.id}
                className={`sub-tier-card ${isCurrent ? 'current' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (tier.sortOrder - 1) * 0.1 }}
              >
                {isCurrent && (
                  <div className="sub-tier-current-badge">Current Plan</div>
                )}

                <div className="sub-tier-header">
                  {tier.logoUrl && (
                    <img
                      src={tier.logoUrl}
                      alt={`${tier.name} logo`}
                      className="sub-tier-logo"
                    />
                  )}
                  <h4>{tier.name}</h4>
                  <div className="sub-tier-price">
                    {isFree ? (
                      <span className="sub-tier-amount">Free</span>
                    ) : (
                      <>
                        <span className="sub-tier-amount">
                          ${(tier.priceInCents / 100).toFixed(0)}
                        </span>
                        <span className="sub-tier-interval">/mo</span>
                      </>
                    )}
                  </div>
                </div>

                {tier.description && (
                  <p className="sub-tier-desc">{tier.description}</p>
                )}

                {tier.features && tier.features.length > 0 && (
                  <ul className="sub-tier-features">
                    {tier.features.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                )}

                <div className="sub-tier-action">
                  {isCurrent ? (
                    <span className="sub-tier-active-label">
                      &#10003; Your Plan
                    </span>
                  ) : isUpgrade ? (
                    <button
                      className="btn primary"
                      onClick={() => handleUpgrade(tier.id)}
                      disabled={!!actionLoading}
                    >
                      {actionLoading === tier.id
                        ? 'Processing...'
                        : `Upgrade to ${tier.name}`}
                    </button>
                  ) : isDowngrade && isFree ? (
                    // Downgrade to free = cancel subscription
                    showCancelConfirm ? (
                      <div className="sub-cancel-confirm">
                        <p>
                          Are you sure? You'll keep access until the end of your
                          billing period.
                        </p>
                        <div className="sub-cancel-actions">
                          <button
                            className="btn small"
                            style={{ color: '#dc2626' }}
                            onClick={handleCancel}
                            disabled={actionLoading === 'cancel'}
                          >
                            {actionLoading === 'cancel'
                              ? 'Cancelling...'
                              : 'Yes, Cancel'}
                          </button>
                          <button
                            className="btn ghost small"
                            onClick={() => setShowCancelConfirm(false)}
                          >
                            Keep Plan
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="btn ghost"
                        onClick={() => setShowCancelConfirm(true)}
                        disabled={!!actionLoading || isCancelling}
                      >
                        {isCancelling
                          ? 'Already Cancelling'
                          : `Downgrade to ${tier.name}`}
                      </button>
                    )
                  ) : isDowngrade ? (
                    <button
                      className="btn ghost"
                      onClick={() => handleUpgrade(tier.id)}
                      disabled={!!actionLoading}
                    >
                      {actionLoading === tier.id
                        ? 'Processing...'
                        : `Switch to ${tier.name}`}
                    </button>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Help link */}
      <div className="sub-help">
        <p>
          Questions about plans?{' '}
          <Link to="/faq">Check our FAQ</Link> or email{' '}
          <a href="mailto:support@hyraxfitness.com">support@hyraxfitness.com</a>
        </p>
      </div>
    </div>
  );
}
