import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchEmailPreview, sendTestEmail } from '../../api/email-preview';
import './admin.css';
import './email-preview.css';

const EMAIL_TYPES = [
  { value: 'verification', label: 'Verification Code' },
  { value: 'invitation', label: 'Admin Invitation' },
  { value: 'welcome', label: 'Welcome (Intake Wizard)' },
  { value: 'forgot-password', label: 'Forgot Password' },
  { value: 'subscription-confirmation', label: 'Subscription Confirmation' },
  { value: 'subscription-change', label: 'Subscription Change' },
  { value: 'subscription-cancelled', label: 'Subscription Cancelled' },
  { value: 'payment-failed', label: 'Payment Failed' },
  { value: 'support-reply', label: 'Support Ticket Reply' },
  { value: 'trial-expiring', label: 'Trial Expiring Soon' },
  { value: 'trial-expired', label: 'Trial Expired' },
];

export default function EmailPreview() {
  const { getIdToken, user } = useAuth();
  const [selectedType, setSelectedType] = useState('verification');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // Default recipient to admin's email
  useEffect(() => {
    if (user?.signInDetails?.loginId) {
      setRecipientEmail(user.signInDetails.loginId);
    }
  }, [user]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const token = await getIdToken();
      const result = await fetchEmailPreview(selectedType, token);
      setPreviewHtml(result.html);
      setPreviewSubject(result.subject);
    } catch (err) {
      setPreviewHtml('');
      setPreviewSubject('');
      setStatusMsg({ type: 'error', text: `Failed to load preview: ${err.message}` });
    } finally {
      setLoading(false);
    }
  }, [getIdToken, selectedType]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const handleSend = async () => {
    if (!recipientEmail || sending) return;
    setSending(true);
    setStatusMsg(null);
    try {
      const token = await getIdToken();
      const result = await sendTestEmail(selectedType, recipientEmail, token);
      setStatusMsg({ type: 'success', text: `Test email sent to ${result.recipientEmail}` });
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to send test email' });
    } finally {
      setSending(false);
    }
  };

  const handleCopyHtml = () => {
    if (previewHtml) {
      navigator.clipboard.writeText(previewHtml);
      setStatusMsg({ type: 'success', text: 'HTML copied to clipboard' });
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1>Email Preview</h1>
        <p>Preview and send test copies of all platform emails. Verify styling across email clients.</p>
      </div>

      <div className="email-preview-controls">
        <div className="email-preview-field">
          <label htmlFor="email-type">Email Template</label>
          <select
            id="email-type"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            {EMAIL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="email-preview-field">
          <label htmlFor="recipient-email">Send To</label>
          <input
            id="recipient-email"
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="recipient@example.com"
          />
        </div>

        <div className="email-preview-actions">
          <button
            className="email-preview-copy-btn"
            onClick={handleCopyHtml}
            disabled={!previewHtml}
          >
            Copy HTML
          </button>
          <button
            className="email-preview-send-btn"
            onClick={handleSend}
            disabled={sending || !recipientEmail}
          >
            {sending ? 'Sending...' : 'Send Test Email'}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className={`email-preview-status ${statusMsg.type}`}>
          {statusMsg.text}
        </div>
      )}

      {previewSubject && (
        <div className="email-preview-subject">
          <strong>Subject:</strong>{previewSubject}
        </div>
      )}

      {loading ? (
        <div className="email-preview-loading">Loading preview...</div>
      ) : previewHtml ? (
        <div className="email-preview-iframe-container">
          <iframe
            className="email-preview-iframe"
            srcDoc={previewHtml}
            sandbox=""
            title="Email preview"
          />
        </div>
      ) : null}
    </div>
  );
}
