import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { sendChatMessage, fetchChatHistory } from '../../api/chat';
import { hasTierAccess } from '../../utils/tiers';
import TrialBanner from '../../components/TrialBanner';
import './training-chat.css';

export default function TrainingChat() {
  const { getIdToken, effectiveTier } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const MAX_DAILY_MESSAGES = 20;
  const hasAccess = hasTierAccess(effectiveTier, 'Iron Dassie');

  // Count today's user messages for rate limit display
  const todayUserMessages = messages.filter((m) => {
    if (m.role !== 'user') return false;
    const msgDate = new Date(m.createdAt).toDateString();
    return msgDate === new Date().toDateString();
  }).length;
  const messagesRemaining = Math.max(0, MAX_DAILY_MESSAGES - todayUserMessages);
  const atLimit = messagesRemaining === 0;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await getIdToken();
        const data = await fetchChatHistory(token);
        if (!cancelled && data?.messages) {
          setMessages(data.messages);
        }
      } catch {
        // no history yet
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (hasAccess) load();
    else setLoading(false);
    return () => { cancelled = true; };
  }, [getIdToken, hasAccess]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    // Optimistically add user message
    setMessages((prev) => [...prev, { role: 'user', content: text, createdAt: new Date().toISOString() }]);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const token = await getIdToken();
      const data = await sendChatMessage(token, text);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response, createdAt: new Date().toISOString() },
      ]);
    } catch (err) {
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }, [input, sending, getIdToken]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="chat-loading">
        <div className="section-spinner" />
        <p>Loading Personal Coach...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div>
        <div className="admin-page-header">
          <h1>Personal Coach</h1>
          <p>Your personal training assistant</p>
        </div>
        <div className="chat-gate">
          <div className="chat-gate-icon">&#x1F916;</div>
          <h2>Iron Dassie Exclusive</h2>
          <p>The Personal Coach chat is available exclusively for Iron Dassie members. Get personalized advice on form, modifications, nutrition timing, and recovery.</p>
          <Link to="/portal/subscription" className="btn primary">View Plans</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="admin-page-header">
        <h1>Personal Coach</h1>
        <p>Ask about training, form, nutrition, or recovery</p>
      </div>

      <TrialBanner compact featureName="Personal Coach" />

      <div className="chat-messages">
        {messages.length === 0 && !sending && (
          <div className="chat-empty">
            <p>&#x1F44B; Hi! I&rsquo;m your Hyrax Fitness Personal Coach. Ask me anything about your training, form tips, modifications, nutrition timing, or recovery.</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-bubble ${msg.role}`}>
            <div className="chat-bubble-content">{msg.content}</div>
          </div>
        ))}
        {sending && (
          <div className="chat-bubble assistant">
            <div className="chat-bubble-content chat-typing">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && <div className="chat-error">{error}</div>}

      <div className="chat-rate-limit" style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--rock)', padding: '4px 0' }}>
        {atLimit
          ? 'Daily message limit reached. Resets tomorrow.'
          : `${messagesRemaining}/${MAX_DAILY_MESSAGES} messages remaining today`}
      </div>

      <div className="chat-input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={atLimit ? 'Daily limit reached' : 'Ask your Personal Coach...'}
          className="chat-input"
          rows={1}
          maxLength={2000}
          disabled={sending || atLimit}
        />
        <button
          className="btn primary chat-send-btn"
          onClick={handleSend}
          disabled={!input.trim() || sending || atLimit}
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
