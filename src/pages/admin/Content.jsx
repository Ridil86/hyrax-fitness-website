import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchContent, updateContent } from '../../api/content';
import { uploadFile } from '../../api/upload';
import './admin.css';
import './content-admin.css';

const SECTIONS = [
  { key: 'hero', label: 'Hero' },
  { key: 'dassie', label: 'Dassie' },
  { key: 'method', label: 'Method' },
  { key: 'workouts', label: 'Workouts' },
  { key: 'programs', label: 'Programs' },
  { key: 'testimonials', label: 'Testimonials' },
  { key: 'getstarted', label: 'Get Started' },
];

export default function Content() {
  const { getIdToken } = useAuth();
  const [activeTab, setActiveTab] = useState('hero');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveMsg, setSaveMsg] = useState('');

  const loadSection = useCallback(async (section) => {
    setLoading(true);
    setError(null);
    setSaveMsg('');
    try {
      const result = await fetchContent(section);
      setData(result.data || result);
    } catch (err) {
      setError(err.message || 'Failed to load content');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSection(activeTab);
  }, [activeTab, loadSection]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    setError(null);
    try {
      const token = await getIdToken();
      await updateContent(activeTab, data, token);
      setSaveMsg('Saved successfully');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (path, file) => {
    try {
      const token = await getIdToken();
      const { publicUrl } = await uploadFile(file, token);
      updateNestedValue(path, publicUrl);
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    }
  };

  // Utility to update a value at a dot-separated path in the data object
  const updateNestedValue = (path, value) => {
    setData((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = copy;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = isNaN(keys[i]) ? keys[i] : parseInt(keys[i]);
        obj = obj[k];
      }
      const lastKey = isNaN(keys[keys.length - 1])
        ? keys[keys.length - 1]
        : parseInt(keys[keys.length - 1]);
      obj[lastKey] = value;
      return copy;
    });
  };

  const updateField = (path) => (e) => {
    updateNestedValue(path, e.target.value);
  };

  // Add item to an array field
  const addArrayItem = (path, template) => {
    setData((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = copy;
      for (const k of keys) {
        obj = obj[isNaN(k) ? k : parseInt(k)];
      }
      obj.push(typeof template === 'function' ? template() : { ...template });
      return copy;
    });
  };

  // Remove item from an array field
  const removeArrayItem = (path, index) => {
    setData((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = copy;
      for (const k of keys) {
        obj = obj[isNaN(k) ? k : parseInt(k)];
      }
      obj.splice(index, 1);
      return copy;
    });
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1>Content CMS</h1>
        <p>Edit text, images, and data for each section of the site</p>
      </div>

      <div className="content-tabs">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            className={`content-tab ${activeTab === s.key ? 'active' : ''}`}
            onClick={() => setActiveTab(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="faq-admin-error" style={{ marginTop: 12 }}>
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {saveMsg && <div className="content-save-msg">{saveMsg}</div>}

      {loading ? (
        <div className="faq-admin-loading">Loading content...</div>
      ) : !data ? (
        <div className="admin-placeholder">
          <h3>No data found for this section</h3>
          <p>Run the seed script to populate content.</p>
        </div>
      ) : (
        <div className="content-editor">
          {activeTab === 'hero' && (
            <HeroEditor data={data} updateField={updateField} />
          )}
          {activeTab === 'dassie' && (
            <DassieEditor
              data={data}
              updateField={updateField}
              addArrayItem={addArrayItem}
              removeArrayItem={removeArrayItem}
            />
          )}
          {activeTab === 'method' && (
            <MethodEditor
              data={data}
              updateField={updateField}
              addArrayItem={addArrayItem}
              removeArrayItem={removeArrayItem}
              onImageUpload={handleImageUpload}
            />
          )}
          {activeTab === 'workouts' && (
            <WorkoutsEditor
              data={data}
              updateField={updateField}
              removeArrayItem={removeArrayItem}
              onImageUpload={handleImageUpload}
            />
          )}
          {activeTab === 'programs' && (
            <ProgramsEditor
              data={data}
              updateField={updateField}
            />
          )}
          {activeTab === 'testimonials' && (
            <TestimonialsEditor
              data={data}
              updateField={updateField}
              addArrayItem={addArrayItem}
              removeArrayItem={removeArrayItem}
              onImageUpload={handleImageUpload}
            />
          )}
          {activeTab === 'getstarted' && (
            <GetStartedEditor data={data} updateField={updateField} />
          )}

          <div className="content-save-bar">
            <button
              className="btn primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Section Editors ── */

function FieldGroup({ label, children }) {
  return (
    <div className="content-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function HeroEditor({ data, updateField }) {
  return (
    <>
      <FieldGroup label="Headline">
        <input value={data.headline || ''} onChange={updateField('headline')} />
      </FieldGroup>
      <FieldGroup label="Lead (Bold)">
        <textarea value={data.leadStrong || ''} onChange={updateField('leadStrong')} rows={2} />
      </FieldGroup>
      <FieldGroup label="Lead (Sub)">
        <textarea value={data.leadSub || ''} onChange={updateField('leadSub')} rows={2} />
      </FieldGroup>
      <FieldGroup label="CTA Text">
        <input value={data.ctaText || ''} onChange={updateField('ctaText')} />
      </FieldGroup>
      <h3 className="content-subhead">Stats</h3>
      {(data.stats || []).map((stat, i) => (
        <div key={i} className="content-inline-group">
          <FieldGroup label={`Stat ${i + 1} Value`}>
            <input value={stat.value || ''} onChange={updateField(`stats.${i}.value`)} />
          </FieldGroup>
          <FieldGroup label={`Stat ${i + 1} Label`}>
            <input value={stat.label || ''} onChange={updateField(`stats.${i}.label`)} />
          </FieldGroup>
        </div>
      ))}
    </>
  );
}

function DassieEditor({ data, updateField, addArrayItem, removeArrayItem }) {
  return (
    <>
      <FieldGroup label="Heading">
        <input value={data.heading || ''} onChange={updateField('heading')} />
      </FieldGroup>
      <FieldGroup label="Subheading">
        <textarea value={data.subheading || ''} onChange={updateField('subheading')} rows={3} />
      </FieldGroup>
      <FieldGroup label="Hero Title">
        <input value={data.heroTitle || ''} onChange={updateField('heroTitle')} />
      </FieldGroup>
      <FieldGroup label="Hero Body (paragraphs)">
        {(data.heroBody || []).map((p, i) => (
          <textarea
            key={i}
            value={p}
            onChange={updateField(`heroBody.${i}`)}
            rows={3}
            style={{ marginBottom: 8 }}
          />
        ))}
      </FieldGroup>
      <h3 className="content-subhead">Traits</h3>
      {(data.traits || []).map((trait, i) => (
        <div key={i} className="content-card">
          <div className="content-card-header">
            <strong>Trait {i + 1}</strong>
            <button className="content-remove-btn" onClick={() => removeArrayItem('traits', i)}>Remove</button>
          </div>
          <FieldGroup label="Icon (emoji)">
            <input value={trait.icon || ''} onChange={updateField(`traits.${i}.icon`)} />
          </FieldGroup>
          <FieldGroup label="Title">
            <input value={trait.title || ''} onChange={updateField(`traits.${i}.title`)} />
          </FieldGroup>
          <FieldGroup label="Text">
            <textarea value={trait.text || ''} onChange={updateField(`traits.${i}.text`)} rows={2} />
          </FieldGroup>
        </div>
      ))}
      <button
        className="btn ghost content-add-btn"
        onClick={() => addArrayItem('traits', { icon: '', title: '', text: '' })}
      >
        + Add Trait
      </button>
    </>
  );
}

function MethodEditor({ data, updateField, addArrayItem, removeArrayItem, onImageUpload }) {
  return (
    <>
      <FieldGroup label="Heading">
        <input value={data.heading || ''} onChange={updateField('heading')} />
      </FieldGroup>
      <FieldGroup label="Subheading">
        <textarea value={data.subheading || ''} onChange={updateField('subheading')} rows={2} />
      </FieldGroup>
      <h3 className="content-subhead">Modules</h3>
      {(data.modules || []).map((mod, i) => (
        <div key={i} className="content-card">
          <div className="content-card-header">
            <strong>Module {i + 1}: {mod.name}</strong>
            <button className="content-remove-btn" onClick={() => removeArrayItem('modules', i)}>Remove</button>
          </div>
          <FieldGroup label="Name">
            <input value={mod.name || ''} onChange={updateField(`modules.${i}.name`)} />
          </FieldGroup>
          <FieldGroup label="Description">
            <textarea value={mod.desc || ''} onChange={updateField(`modules.${i}.desc`)} rows={2} />
          </FieldGroup>
          <FieldGroup label="Image Path">
            <input value={mod.img || ''} onChange={updateField(`modules.${i}.img`)} />
            <ImageUploadBtn onUpload={(file) => onImageUpload(`modules.${i}.img`, file)} />
          </FieldGroup>
          <FieldGroup label="Alt Text">
            <input value={mod.alt || ''} onChange={updateField(`modules.${i}.alt`)} />
          </FieldGroup>
        </div>
      ))}
      <h3 className="content-subhead">Key Points</h3>
      {(data.bullets || []).map((bullet, i) => (
        <div key={i} className="content-inline-group">
          <FieldGroup label={`Point ${i + 1}`}>
            <input value={bullet} onChange={updateField(`bullets.${i}`)} />
          </FieldGroup>
          <button className="content-remove-btn" onClick={() => removeArrayItem('bullets', i)}>Remove</button>
        </div>
      ))}
      <button
        className="btn ghost content-add-btn"
        onClick={() => addArrayItem('bullets', () => '')}
      >
        + Add Point
      </button>
    </>
  );
}

function WorkoutsEditor({ data, updateField, removeArrayItem, onImageUpload }) {
  return (
    <>
      <FieldGroup label="Heading">
        <input value={data.heading || ''} onChange={updateField('heading')} />
      </FieldGroup>
      <h3 className="content-subhead">Workouts</h3>
      {(data.workouts || []).map((w, i) => (
        <div key={i} className="content-card">
          <div className="content-card-header">
            <strong>Workout {i + 1}: {w.name}</strong>
            <button className="content-remove-btn" onClick={() => removeArrayItem('workouts', i)}>Remove</button>
          </div>
          <FieldGroup label="Name">
            <input value={w.name || ''} onChange={updateField(`workouts.${i}.name`)} />
          </FieldGroup>
          <FieldGroup label="Description">
            <textarea value={w.desc || ''} onChange={updateField(`workouts.${i}.desc`)} rows={2} />
          </FieldGroup>
          <FieldGroup label="Image Path">
            <input value={w.img || ''} onChange={updateField(`workouts.${i}.img`)} />
            <ImageUploadBtn onUpload={(file) => onImageUpload(`workouts.${i}.img`, file)} />
          </FieldGroup>
        </div>
      ))}
      <h3 className="content-subhead">Outcrop Challenge</h3>
      <FieldGroup label="Challenge Heading">
        <input value={data.challengeHeading || ''} onChange={updateField('challengeHeading')} />
      </FieldGroup>
      <FieldGroup label="Challenge Body">
        <textarea value={data.challengeBody || ''} onChange={updateField('challengeBody')} rows={2} />
      </FieldGroup>
      <FieldGroup label="Round Details (one per line)">
        {(data.roundDetails || []).map((r, i) => (
          <input key={i} value={r} onChange={updateField(`roundDetails.${i}`)} style={{ marginBottom: 4 }} />
        ))}
      </FieldGroup>
      <FieldGroup label="Score Details (one per line)">
        {(data.scoreDetails || []).map((s, i) => (
          <input key={i} value={s} onChange={updateField(`scoreDetails.${i}`)} style={{ marginBottom: 4 }} />
        ))}
      </FieldGroup>
    </>
  );
}

function ProgramsEditor({ data, updateField }) {
  return (
    <>
      <FieldGroup label="Heading">
        <input value={data.heading || ''} onChange={updateField('heading')} />
      </FieldGroup>
      <FieldGroup label="Subheading">
        <textarea value={data.subheading || ''} onChange={updateField('subheading')} rows={2} />
      </FieldGroup>
      <h3 className="content-subhead">Events Section</h3>
      <FieldGroup label="Events Heading">
        <input value={data.eventsHeading || ''} onChange={updateField('eventsHeading')} />
      </FieldGroup>
      <FieldGroup label="Events Title">
        <input value={data.eventsTitle || ''} onChange={updateField('eventsTitle')} />
      </FieldGroup>
      <FieldGroup label="Events Body">
        <textarea value={data.eventsBody || ''} onChange={updateField('eventsBody')} rows={3} />
      </FieldGroup>
      <FieldGroup label="Events Email">
        <input value={data.eventsEmail || ''} onChange={updateField('eventsEmail')} />
      </FieldGroup>
    </>
  );
}

function TestimonialsEditor({ data, updateField, addArrayItem, removeArrayItem, onImageUpload }) {
  return (
    <>
      <FieldGroup label="Section Heading">
        <input value={data.heading || ''} onChange={updateField('heading')} />
      </FieldGroup>
      <h3 className="content-subhead">Quotes</h3>
      {(data.quotes || []).map((q, i) => (
        <div key={i} className="content-card">
          <div className="content-card-header">
            <strong>{q.name || `Quote ${i + 1}`}</strong>
            <button className="content-remove-btn" onClick={() => removeArrayItem('quotes', i)}>Remove</button>
          </div>
          <FieldGroup label="Name">
            <input value={q.name || ''} onChange={updateField(`quotes.${i}.name`)} />
          </FieldGroup>
          <FieldGroup label="Role">
            <input value={q.role || ''} onChange={updateField(`quotes.${i}.role`)} />
          </FieldGroup>
          <FieldGroup label="Text">
            <textarea value={q.text || ''} onChange={updateField(`quotes.${i}.text`)} rows={3} />
          </FieldGroup>
          <FieldGroup label="Avatar Path">
            <input value={q.avatar || ''} onChange={updateField(`quotes.${i}.avatar`)} />
            <ImageUploadBtn onUpload={(file) => onImageUpload(`quotes.${i}.avatar`, file)} />
          </FieldGroup>
        </div>
      ))}
      <button
        className="btn ghost content-add-btn"
        onClick={() => addArrayItem('quotes', { name: '', role: '', text: '', avatar: '' })}
      >
        + Add Quote
      </button>
    </>
  );
}

function GetStartedEditor({ data, updateField }) {
  return (
    <>
      <FieldGroup label="Heading">
        <input value={data.heading || ''} onChange={updateField('heading')} />
      </FieldGroup>
      <FieldGroup label="Body">
        <textarea value={data.body || ''} onChange={updateField('body')} rows={3} />
      </FieldGroup>
      <FieldGroup label="CTA Text">
        <input value={data.ctaText || ''} onChange={updateField('ctaText')} />
      </FieldGroup>
      <h3 className="content-subhead">Class Format Card</h3>
      <FieldGroup label="Title">
        <input value={data.classFormatTitle || ''} onChange={updateField('classFormatTitle')} />
      </FieldGroup>
      <FieldGroup label="Body">
        <textarea value={data.classFormatBody || ''} onChange={updateField('classFormatBody')} rows={2} />
      </FieldGroup>
      <h3 className="content-subhead">Event Card</h3>
      <FieldGroup label="Title">
        <input value={data.eventCardTitle || ''} onChange={updateField('eventCardTitle')} />
      </FieldGroup>
      <FieldGroup label="Body">
        <textarea value={data.eventCardBody || ''} onChange={updateField('eventCardBody')} rows={2} />
      </FieldGroup>
    </>
  );
}

function ImageUploadBtn({ onUpload }) {
  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <label className="content-upload-btn">
      Upload Image
      <input type="file" accept="image/*" onChange={handleChange} hidden />
    </label>
  );
}
