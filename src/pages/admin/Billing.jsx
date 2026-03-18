import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchBillingStats,
  fetchSubscriptions,
  fetchPayments,
} from '../../api/billing';
import './billing-admin.css';

function formatCurrency(amountInCents, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format((amountInCents || 0) / 100);
}

function formatDate(iso) {
  if (!iso) return '--';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function statusBadgeClass(status) {
  switch (status) {
    case 'active':
      return 'billing-badge active';
    case 'succeeded':
      return 'billing-badge succeeded';
    case 'cancelling':
      return 'billing-badge cancelling';
    case 'cancelled':
      return 'billing-badge cancelled';
    case 'failed':
      return 'billing-badge failed';
    default:
      return 'billing-badge';
  }
}

export default function Billing() {
  const { getIdToken } = useAuth();
  const [tab, setTab] = useState('subscriptions');
  const [stats, setStats] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) return;

      const [statsResult, subsResult, paysResult] = await Promise.all([
        fetchBillingStats(token),
        fetchSubscriptions(token),
        fetchPayments(token),
      ]);

      setStats(statsResult);
      setSubscriptions(subsResult.subscriptions || []);
      setPayments(paysResult.payments || []);
    } catch (err) {
      console.error('Failed to load billing data:', err);
      setError(err.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div>
      <div className="admin-page-header">
        <h1>Billing</h1>
        <p>Manage subscriptions, payments, and revenue</p>
      </div>

      {error && <div className="billing-error">{error}</div>}

      {/* Stats */}
      {stats && (
        <div className="admin-stats">
          <div className="admin-stat-card">
            <span className="admin-stat-label">Active Subscribers</span>
            <span className="admin-stat-value">{stats.activeSubscribers}</span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-label">MRR</span>
            <span className="admin-stat-value">
              ${(stats.mrr || 0).toFixed(2)}
            </span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-label">Revenue This Month</span>
            <span className="admin-stat-value">
              ${(stats.revenueThisMonth || 0).toFixed(2)}
            </span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-label">Cancelling</span>
            <span className="admin-stat-value">
              {stats.cancellingSubscribers}
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="billing-tabs">
        <button
          className={`billing-tab ${tab === 'subscriptions' ? 'active' : ''}`}
          onClick={() => setTab('subscriptions')}
        >
          Subscriptions ({subscriptions.length})
        </button>
        <button
          className={`billing-tab ${tab === 'payments' ? 'active' : ''}`}
          onClick={() => setTab('payments')}
        >
          Payments ({payments.length})
        </button>
      </div>

      {loading ? (
        <div className="billing-loading">
          <div className="section-spinner" />
          <p>Loading billing data...</p>
        </div>
      ) : tab === 'subscriptions' ? (
        <div className="billing-table-wrap">
          {subscriptions.length === 0 ? (
            <div className="billing-empty">
              <p>No subscriptions yet.</p>
            </div>
          ) : (
            <table className="billing-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Tier</th>
                  <th>Status</th>
                  <th>Next Billing</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub, i) => {
                  const displayStatus = sub.cancelAtPeriodEnd
                    ? 'cancelling'
                    : sub.status;
                  return (
                    <tr key={sub.userSub || i}>
                      <td>
                        {[sub.givenName, sub.familyName]
                          .filter(Boolean)
                          .join(' ') || '--'}
                      </td>
                      <td>{sub.email}</td>
                      <td>{sub.tierId || '--'}</td>
                      <td>
                        <span className={statusBadgeClass(displayStatus)}>
                          {displayStatus}
                        </span>
                      </td>
                      <td>{formatDate(sub.currentPeriodEnd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="billing-table-wrap">
          {payments.length === 0 ? (
            <div className="billing-empty">
              <p>No payments recorded yet.</p>
            </div>
          ) : (
            <table className="billing-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Tier</th>
                  <th>Status</th>
                  <th>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((pay, i) => (
                  <tr key={pay.stripeInvoiceId || i}>
                    <td>{formatDate(pay.paidAt || pay.createdAt)}</td>
                    <td>{pay.email || '--'}</td>
                    <td>{formatCurrency(pay.amount, pay.currency)}</td>
                    <td>{pay.tierName || '--'}</td>
                    <td>
                      <span className={statusBadgeClass(pay.status)}>
                        {pay.status}
                      </span>
                    </td>
                    <td>
                      {pay.invoiceUrl ? (
                        <a
                          href={pay.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="billing-invoice-link"
                        >
                          View
                        </a>
                      ) : (
                        '--'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
