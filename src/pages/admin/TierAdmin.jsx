import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchTiers, updateTier, updateComparisonFeatures } from '../../api/tiers';
import { uploadFile } from '../../api/upload';
import './tier-admin.css';

export default function TierAdmin() {
  const { getIdToken } = useAuth();
  const [tiers, setTiers] = useState([]);
  const [comparisonFeatures, setComparisonFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [error, setError] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Comparison editor state
  const [editingComparison, setEditingComparison] = useState(false);
  const [compEditData, setCompEditData] = useState([]);
  const [savingComparison, setSavingComparison] = useState(false);

  const fileInputRef = useRef(null);

  const loadTiers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchTiers();
      if (result && !Array.isArray(result) && result.tiers) {
        setTiers(result.tiers);
        setComparisonFeatures(result.comparisonFeatures || []);
      } else {
        const items = Array.isArray(result) ? result : result.Items || [];
        setTiers(items);
      }
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
      logoUrl: tier.logoUrl || '',
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

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setError(null);
    try {
      const token = await getIdToken();
      const { publicUrl } = await uploadFile(file, token);
      updateField('logoUrl', publicUrl);
    } catch (err) {
      setError(err.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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

      const payload = {
        name: editData.name,
        description: editData.description,
        features: editData.features.filter((f) => f.trim()),
        logoUrl: editData.logoUrl,
      };

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

  // ── Comparison Editor ──
  const startEditingComparison = () => {
    setEditingComparison(true);
    setCompEditData(JSON.parse(JSON.stringify(comparisonFeatures)));
    setSaveMsg('');
    setError(null);
  };

  const cancelEditingComparison = () => {
    setEditingComparison(false);
    setCompEditData([]);
  };

  const updateCompItem = (catIdx, itemIdx, field, value) => {
    setCompEditData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[catIdx].items[itemIdx][field] = value;
      return next;
    });
  };

  const addCompItem = (catIdx) => {
    setCompEditData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[catIdx].items.push({ name: '', detail: '', pup: false, runner: false, sentinel: false });
      return next;
    });
  };

  const removeCompItem = (catIdx, itemIdx) => {
    setCompEditData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[catIdx].items.splice(itemIdx, 1);
      return next;
    });
  };

  const addCompCategory = () => {
    setCompEditData((prev) => [...prev, { category: '', items: [] }]);
  };

  const updateCompCategory = (catIdx, value) => {
    setCompEditData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[catIdx].category = value;
      return next;
    });
  };

  const removeCompCategory = (catIdx) => {
    setCompEditData((prev) => prev.filter((_, i) => i !== catIdx));
  };

  const handleSaveComparison = async () => {
    setSavingComparison(true);
    setError(null);
    setSaveMsg('');
    try {
      const token = await getIdToken();
      await updateComparisonFeatures(token, compEditData);
      setSaveMsg('Comparison features updated!');
      setEditingComparison(false);
      await loadTiers();
      setTimeout(() => setSaveMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to update comparison features');
    } finally {
      setSavingComparison(false);
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1>Tier Management</h1>
        <p>Edit subscription tier names, prices, features, and logos</p>
      </div>

      {saveMsg && <div className="tier-message tier-message-success">{saveMsg}</div>}
      {error && <div className="tier-message tier-message-error">{error}</div>}

      {loading ? (
        <div className="tier-loading">
          <div className="section-spinner" />
          <p>Loading tiers...</p>
        </div>
      ) : (
        <>
          <div className="tier-cards">
            {tiers.map((tier) => {
              const isEditing = editingId === tier.id;

              return (
                <div
                  key={tier.id}
                  className={`tier-admin-card ${isEditing ? 'editing' : ''}`}
                >
                  <div className="tier-card-header">
                    <div className="tier-card-logo">
                      {tier.logoUrl ? (
                        <img src={tier.logoUrl} alt={`${tier.name} logo`} />
                      ) : (
                        <div className="tier-card-logo-placeholder">
                          {tier.name?.[0] || '?'}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3>{tier.name}</h3>
                      <span className="tier-card-level">Level {tier.level}</span>
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
                        <label>Logo</label>
                        <div className="tier-logo-edit">
                          {editData.logoUrl && (
                            <img
                              src={editData.logoUrl}
                              alt="Current logo"
                              className="tier-logo-preview"
                            />
                          )}
                          <div className="tier-logo-actions">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              style={{ display: 'none' }}
                            />
                            <button
                              type="button"
                              className="btn ghost small"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadingLogo}
                            >
                              {uploadingLogo ? 'Uploading...' : 'Upload New Logo'}
                            </button>
                            {editData.logoUrl && (
                              <input
                                type="text"
                                value={editData.logoUrl}
                                onChange={(e) => updateField('logoUrl', e.target.value)}
                                placeholder="Logo URL"
                                className="tier-logo-url-input"
                              />
                            )}
                          </div>
                        </div>
                      </div>

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
                          onChange={(e) => updateField('description', e.target.value)}
                        />
                      </div>

                      <div className="content-field">
                        <label>
                          Price (cents){' '}
                          <span className="tier-price-hint">e.g. 500 = $5.00</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={editData.priceInCents}
                          onChange={(e) =>
                            updateField('priceInCents', parseInt(e.target.value, 10) || 0)
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
                          <span className="tier-stripe-label">Stripe Product:</span>
                          <code>{tier.stripeProductId}</code>
                        </div>
                      )}

                      <div className="tier-edit-actions">
                        <button className="btn primary small" onClick={handleSave} disabled={saving}>
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button className="btn ghost small" onClick={cancelEditing} disabled={saving}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="tier-card-body">
                      {tier.description && <p className="tier-card-desc">{tier.description}</p>}

                      {tier.features && tier.features.length > 0 && (
                        <ul className="tier-card-features">
                          {tier.features.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      )}

                      {tier.stripeProductId && (
                        <div className="tier-stripe-info">
                          <span className="tier-stripe-label">Stripe:</span>
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

          {/* Comparison Features Editor */}
          <div className="tier-comparison-section">
            <div className="tier-comparison-header">
              <div>
                <h2>Compare Plans</h2>
                <p className="muted">Manage the feature comparison table shown on the Programs page</p>
              </div>
              {!editingComparison && (
                <button className="btn ghost small" onClick={startEditingComparison}>
                  Edit Comparison
                </button>
              )}
            </div>

            {editingComparison ? (
              <div className="tier-comparison-editor">
                {compEditData.map((cat, catIdx) => (
                  <div key={catIdx} className="comp-category-card">
                    <div className="comp-category-header">
                      <input
                        type="text"
                        value={cat.category}
                        onChange={(e) => updateCompCategory(catIdx, e.target.value)}
                        placeholder="Category name"
                        className="comp-category-input"
                      />
                      <button
                        type="button"
                        className="content-remove-btn"
                        onClick={() => removeCompCategory(catIdx)}
                        title="Remove category"
                      >
                        &times;
                      </button>
                    </div>

                    {cat.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="comp-item-row">
                        <div className="comp-item-fields">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateCompItem(catIdx, itemIdx, 'name', e.target.value)}
                            placeholder="Feature name"
                          />
                          <textarea
                            rows={2}
                            value={item.detail}
                            onChange={(e) => updateCompItem(catIdx, itemIdx, 'detail', e.target.value)}
                            placeholder="Feature detail"
                          />
                          <div className="comp-item-toggles">
                            <label>
                              <input
                                type="checkbox"
                                checked={item.pup === true}
                                onChange={(e) => updateCompItem(catIdx, itemIdx, 'pup', e.target.checked)}
                              />
                              Pup
                            </label>
                            <label className="comp-limited-label">
                              <input
                                type="checkbox"
                                checked={item.pup === 'limited'}
                                onChange={(e) => updateCompItem(catIdx, itemIdx, 'pup', e.target.checked ? 'limited' : false)}
                              />
                              Limited
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                checked={item.runner === true}
                                onChange={(e) => updateCompItem(catIdx, itemIdx, 'runner', e.target.checked)}
                              />
                              Runner
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                checked={item.sentinel === true}
                                onChange={(e) => updateCompItem(catIdx, itemIdx, 'sentinel', e.target.checked)}
                              />
                              Dassie
                            </label>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="content-remove-btn"
                          onClick={() => removeCompItem(catIdx, itemIdx)}
                          title="Remove item"
                        >
                          &times;
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      className="btn ghost small"
                      onClick={() => addCompItem(catIdx)}
                      style={{ marginTop: 8 }}
                    >
                      + Add Feature
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  className="btn ghost small"
                  onClick={addCompCategory}
                  style={{ marginTop: 12 }}
                >
                  + Add Category
                </button>

                <div className="tier-edit-actions">
                  <button
                    className="btn primary small"
                    onClick={handleSaveComparison}
                    disabled={savingComparison}
                  >
                    {savingComparison ? 'Saving...' : 'Save Comparison'}
                  </button>
                  <button
                    className="btn ghost small"
                    onClick={cancelEditingComparison}
                    disabled={savingComparison}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="tier-comparison-preview">
                {comparisonFeatures.length === 0 ? (
                  <p className="muted">No comparison features configured. Click Edit to add them.</p>
                ) : (
                  comparisonFeatures.map((cat, i) => (
                    <div key={i} className="comp-preview-category">
                      <h4>{cat.category}</h4>
                      <ul>
                        {cat.items.map((item, j) => (
                          <li key={j}>
                            <strong>{item.name}</strong>
                            <span className="comp-preview-tiers">
                              Pup: {item.pup === 'limited' ? 'Limited' : item.pup ? '\u2713' : '\u2014'}
                              {' \u00B7 '}Runner: {item.runner ? '\u2713' : '\u2014'}
                              {' \u00B7 '}Dassie: {item.sentinel ? '\u2713' : '\u2014'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
