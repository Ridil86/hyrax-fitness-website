import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchTiers, updateTier } from '../../api/tiers';
import './tier-admin.css';

export default function TierAdmin() {
  const { getIdToken } = useAuth();
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [error, setError] = useState(null);

  const loadTiers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchTiers();
      setTiers(Array.isArray(result) ? result : result.Items || []);
    } catch (err) {
      console.error('Failed to load tiers:', err);
      setError(err.message || 'Failed to load tiers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTiers();
  }, [loadTiers]);

  const startEditing = (tier) => {
    setEditingId(tier.id);
    setEditData({
      name: tier.name || '',
      description: tier.description || '',
      priceInCents: tier.priceInCents || 0,
      features: [...(tier.features || [])],
    });
    setSaveMsg('');
    setError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData({});
  };

  const updateField = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const addFeature = () => {
    setEditData((prev) => ({
      ...prev,
      features: [...prev.features, ''],
    }));
  };

  const updateFeature = (index, value) => {
    setEditData((prev) => {
      const features = [...prev.features];
      features[index] = value;
      return { ...prev, features };
    });
  };

  const removeFeature = (index) => {
    setEditData((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveMsg('');

    try {
      const token = await getIdToken();
      const currentTier = tiers.find((t) => t.id === editingId);
      const priceChanged =
        currentTier && editData.priceInCents !== currentTier.priceInCents;

      // Build update payload
      const payload = {
        name: editData.name,
        description: editData.description,
        features: editData.features.filter((f) => f.trim()),
      };

      // Include price fields if changed
      if (priceChanged) {
        payload.priceInCents = editData.priceInCents;
        payload.price =
          editData.priceInCents === 0
            ? 'Free'
            : `$${(editData.priceInCents / 100).toFixed(0)}/mo`;
      }

      await updateTier(token, editingId, payload);

      setSaveMsg('Tier updated successfully!');
      setEditingId(null);
      await loadTiers();
      setTimeout(() => setSaveMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to update tier');
    } finally {
      setSaving(false);
    }
  };

  function tierLevelIcon(level) {
    if (level === 1) return '\u{1F43E}'; // paw
    if (level === 2) return '\u{1F3C3}'; // runner
    if (level === 3) return '\u{1F4AA}'; // flexed bicep
    return '\u2606';
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1>Tier Management</h1>
        <p>Edit subscription tier names, prices, and features</p>
      </div>

      {saveMsg && <div className="tier-message tier-message-success">{saveMsg}</div>}
      {error && <div className="tier-message tier-message-error">{error}</div>}

      {loading ? (
        <div className="tier-loading">
          <div className="section-spinner" />
          <p>Loading tiers...</p>
        </div>
      ) : (
        <div className="tier-cards">
          {tiers.map((tier) => {
            const isEditing = editingId === tier.id;

            return (
              <div
                key={tier.id}
                className={`tier-admin-card ${isEditing ? 'editing' : ''}`}
              >
                <div className="tier-card-header">
                  <span className="tier-card-icon">
                    {tierLevelIcon(tier.level)}
                  </span>
                  <div>
                    <h3>{tier.name}</h3>
                    <span className="tier-card-level">
                      Level {tier.level}
                    </span>
                  </div>
                  <span className="tier-card-price">
                    {tier.priceInCents === 0
                      ? 'Free'
                      : `$${(tier.priceInCents / 100).toFixed(0)}/mo`}
                  </span>
                </div>

                {isEditing ? (
                  <div className="tier-edit-form">
                    <div className="content-field">
                      <label>Name</label>
                      <input
                        type="text"
                        value={editData.name}
                        onChange={(e) => updateField('name', e.target.value)}
                      />
                    </div>

                    <div className="content-field">
                      <label>Description</label>
                      <textarea
                        rows={3}
                        value={editData.description}
                        onChange={(e) =>
                          updateField('description', e.target.value)
                        }
                      />
                    </div>

                    <div className="content-field">
                      <label>
                        Price (cents){' '}
                        <span className="tier-price-hint">
                          e.g. 500 = $5.00
                        </span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={editData.priceInCents}
                        onChange={(e) =>
                          updateField(
                            'priceInCents',
                            parseInt(e.target.value, 10) || 0
                          )
                        }
                      />
                      {editData.priceInCents !==
                        tiers.find((t) => t.id === editingId)?.priceInCents && (
                        <p className="tier-price-warning">
                          Changing the price creates a new Stripe Price. Existing
                          subscribers keep their current rate until they modify
                          their subscription.
                        </p>
                      )}
                    </div>

                    <div className="content-field">
                      <label>Features</label>
                      {editData.features.map((f, i) => (
                        <div key={i} className="tier-feature-row">
                          <input
                            type="text"
                            value={f}
                            placeholder="Feature description"
                            onChange={(e) => updateFeature(i, e.target.value)}
                          />
                          <button
                            type="button"
                            className="content-remove-btn"
                            onClick={() => removeFeature(i)}
                            title="Remove"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={addFeature}
                        style={{ marginTop: 8 }}
                      >
                        + Add Feature
                      </button>
                    </div>

                    {tier.stripeProductId && (
                      <div className="tier-stripe-info">
                        <span className="tier-stripe-label">
                          Stripe Product:
                        </span>
                        <code>{tier.stripeProductId}</code>
                      </div>
                    )}

                    <div className="tier-edit-actions">
                      <button
                        className="btn primary small"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        className="btn ghost small"
                        onClick={cancelEditing}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="tier-card-body">
                    {tier.description && (
                      <p className="tier-card-desc">{tier.description}</p>
                    )}

                    {tier.features && tier.features.length > 0 && (
                      <ul className="tier-card-features">
                        {tier.features.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    )}

                    {tier.stripeProductId && (
                      <div className="tier-stripe-info">
                        <span className="tier-stripe-label">
                          Stripe:
                        </span>
                        <code>{tier.stripeProductId}</code>
                      </div>
                    )}

                    <button
                      className="btn ghost small"
                      onClick={() => startEditing(tier)}
                      style={{ marginTop: 12 }}
                    >
                      Edit Tier
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
