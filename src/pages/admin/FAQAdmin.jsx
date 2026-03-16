import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchFaqs, createFaq, updateFaq, deleteFaq, reorderFaqs } from '../../api/faq';
import './admin.css';
import './faq-admin.css';

export default function FAQAdmin() {
  const { getIdToken } = useAuth();
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editQ, setEditQ] = useState('');
  const [editA, setEditA] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newQ, setNewQ] = useState('');
  const [newA, setNewA] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const loadFaqs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchFaqs();
      setFaqs(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(err.message || 'Failed to load FAQ items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFaqs(); }, [loadFaqs]);

  const handleAdd = async () => {
    if (!newQ.trim() || !newA.trim()) return;
    setSaving(true);
    try {
      const token = await getIdToken();
      await createFaq({ q: newQ.trim(), a: newA.trim() }, token);
      setNewQ('');
      setNewA('');
      setShowAdd(false);
      await loadFaqs();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (faq) => {
    setEditingId(faq.id);
    setEditQ(faq.q);
    setEditA(faq.a);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditQ('');
    setEditA('');
  };

  const handleUpdate = async () => {
    if (!editQ.trim() || !editA.trim()) return;
    setSaving(true);
    try {
      const token = await getIdToken();
      await updateFaq(editingId, { q: editQ.trim(), a: editA.trim() }, token);
      cancelEdit();
      await loadFaqs();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setSaving(true);
    try {
      const token = await getIdToken();
      await deleteFaq(id, token);
      setDeleteConfirm(null);
      await loadFaqs();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const moveItem = async (index, direction) => {
    const newFaqs = [...faqs];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= newFaqs.length) return;

    [newFaqs[index], newFaqs[swapIndex]] = [newFaqs[swapIndex], newFaqs[index]];

    const reorderItems = newFaqs.map((faq, i) => ({
      id: faq.id,
      sortOrder: i + 1,
    }));

    setFaqs(newFaqs);
    setSaving(true);
    try {
      const token = await getIdToken();
      await reorderFaqs(reorderItems, token);
    } catch (err) {
      setError(err.message);
      await loadFaqs();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1>FAQ Manager</h1>
        <p>Add, edit, reorder, and remove frequently asked questions</p>
      </div>

      {error && (
        <div className="faq-admin-error">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {saving && <div className="faq-admin-saving">Saving...</div>}

      <div className="faq-admin-actions">
        <button
          className="btn primary"
          onClick={() => setShowAdd(!showAdd)}
          disabled={saving}
        >
          {showAdd ? 'Cancel' : '+ Add FAQ'}
        </button>
        <span className="faq-admin-count">{faqs.length} items</span>
      </div>

      {showAdd && (
        <div className="faq-admin-form">
          <label>
            Question
            <input
              type="text"
              value={newQ}
              onChange={(e) => setNewQ(e.target.value)}
              placeholder="What is..."
            />
          </label>
          <label>
            Answer
            <textarea
              value={newA}
              onChange={(e) => setNewA(e.target.value)}
              placeholder="The answer..."
              rows={4}
            />
          </label>
          <div className="faq-admin-form-actions">
            <button className="btn primary" onClick={handleAdd} disabled={saving || !newQ.trim() || !newA.trim()}>
              Save
            </button>
            <button className="btn ghost" onClick={() => { setShowAdd(false); setNewQ(''); setNewA(''); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="faq-admin-loading">Loading FAQ items...</div>
      ) : faqs.length === 0 ? (
        <div className="admin-placeholder">
          <div className="admin-placeholder-icon">?</div>
          <h3>No FAQ items yet</h3>
          <p>Click "+ Add FAQ" to create your first question and answer.</p>
        </div>
      ) : (
        <div className="faq-admin-list">
          {faqs.map((faq, index) => (
            <div key={faq.id || faq.sk} className={`faq-admin-item ${editingId === faq.id ? 'editing' : ''}`}>
              {editingId === faq.id ? (
                <div className="faq-admin-edit">
                  <label>
                    Question
                    <input
                      type="text"
                      value={editQ}
                      onChange={(e) => setEditQ(e.target.value)}
                    />
                  </label>
                  <label>
                    Answer
                    <textarea
                      value={editA}
                      onChange={(e) => setEditA(e.target.value)}
                      rows={4}
                    />
                  </label>
                  <div className="faq-admin-form-actions">
                    <button className="btn primary" onClick={handleUpdate} disabled={saving}>
                      Update
                    </button>
                    <button className="btn ghost" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="faq-admin-item-content" onClick={() => startEdit(faq)}>
                    <span className="faq-admin-order">{index + 1}</span>
                    <div>
                      <strong>{faq.q}</strong>
                      <p className="faq-admin-answer">{faq.a}</p>
                    </div>
                  </div>
                  <div className="faq-admin-item-actions">
                    <button
                      className="faq-move-btn"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0 || saving}
                      title="Move up"
                      aria-label="Move up"
                    >
                      &#9650;
                    </button>
                    <button
                      className="faq-move-btn"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === faqs.length - 1 || saving}
                      title="Move down"
                      aria-label="Move down"
                    >
                      &#9660;
                    </button>
                    <button
                      className="faq-edit-btn"
                      onClick={() => startEdit(faq)}
                      title="Edit"
                    >
                      Edit
                    </button>
                    {deleteConfirm === faq.id ? (
                      <span className="faq-delete-confirm">
                        Delete?
                        <button className="faq-delete-yes" onClick={() => handleDelete(faq.id)}>Yes</button>
                        <button className="faq-delete-no" onClick={() => setDeleteConfirm(null)}>No</button>
                      </span>
                    ) : (
                      <button
                        className="faq-delete-btn"
                        onClick={() => setDeleteConfirm(faq.id)}
                        title="Delete"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
