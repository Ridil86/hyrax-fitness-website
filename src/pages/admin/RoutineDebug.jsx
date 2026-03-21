import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { previewRoutinePrompts, generateDailyWorkout } from '../../api/routine';
import './admin.css';

export default function RoutineDebug() {
  const { getIdToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [genResult, setGenResult] = useState(null);
  const [error, setError] = useState(null);

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const token = await getIdToken();
      const data = await previewRoutinePrompts(token);
      setPreview(data);
    } catch (err) {
      setError(err.message || 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setGenResult(null);
    try {
      const token = await getIdToken();
      const data = await generateDailyWorkout(token);
      setGenResult(data);
    } catch (err) {
      setError(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1>AI Routine Debug</h1>
        <p>Preview and test prompts sent to Bedrock (temporary debug tool)</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button className="btn primary" onClick={handlePreview} disabled={loading || generating}>
          {loading ? 'Loading...' : 'Preview Prompts'}
        </button>
        <button className="btn" onClick={handleGenerate} disabled={loading || generating}>
          {generating ? 'Generating...' : 'Send to Bedrock'}
        </button>
      </div>

      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
          padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: '.88rem',
        }}>
          {error}
        </div>
      )}

      {preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Stats bar */}
          <div style={{
            display: 'flex', gap: 16, flexWrap: 'wrap',
            background: '#fff', borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-soft)', padding: '16px 24px',
          }}>
            <div>
              <span style={{ fontSize: '.76rem', color: 'var(--rock)', textTransform: 'uppercase', fontWeight: 600 }}>Est. Tokens</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--sunset)' }}>~{(preview.estimatedTokens || 0).toLocaleString()}</div>
            </div>
            {preview.catalogStats && (
              <>
                <div>
                  <span style={{ fontSize: '.76rem', color: 'var(--rock)', textTransform: 'uppercase', fontWeight: 600 }}>Exercises</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{preview.catalogStats.exercises}</div>
                </div>
                <div>
                  <span style={{ fontSize: '.76rem', color: 'var(--rock)', textTransform: 'uppercase', fontWeight: 600 }}>Workouts</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{preview.catalogStats.workouts}</div>
                </div>
                <div>
                  <span style={{ fontSize: '.76rem', color: 'var(--rock)', textTransform: 'uppercase', fontWeight: 600 }}>Equipment</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{preview.catalogStats.equipment}</div>
                </div>
              </>
            )}
            {preview.contextStats && (
              <>
                <div>
                  <span style={{ fontSize: '.76rem', color: 'var(--rock)', textTransform: 'uppercase', fontWeight: 600 }}>User Logs</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{preview.contextStats.recentLogs}</div>
                </div>
                <div>
                  <span style={{ fontSize: '.76rem', color: 'var(--rock)', textTransform: 'uppercase', fontWeight: 600 }}>Prior Routines</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{preview.contextStats.recentDailyWorkouts}</div>
                </div>
              </>
            )}
          </div>

          {/* System Prompt */}
          <div style={{
            background: '#fff', borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-soft)', padding: 24,
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>System Prompt</h3>
            <pre style={{
              background: 'rgba(27,18,10,.03)', padding: 16, borderRadius: 10,
              fontSize: '.76rem', lineHeight: 1.5, whiteSpace: 'pre-wrap',
              wordBreak: 'break-word', maxHeight: 500, overflow: 'auto',
            }}>
              {preview.systemPrompt}
            </pre>
          </div>

          {/* User Prompt */}
          <div style={{
            background: '#fff', borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-soft)', padding: 24,
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>User Prompt</h3>
            <pre style={{
              background: 'rgba(27,18,10,.03)', padding: 16, borderRadius: 10,
              fontSize: '.76rem', lineHeight: 1.5, whiteSpace: 'pre-wrap',
              wordBreak: 'break-word', maxHeight: 500, overflow: 'auto',
            }}>
              {preview.userPrompt}
            </pre>
          </div>
        </div>
      )}

      {genResult && (
        <div style={{
          background: '#fff', borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-soft)', padding: 24, marginTop: 20,
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Bedrock Response</h3>
          {genResult.tokenUsage && (
            <p style={{ margin: '0 0 12px', fontSize: '.82rem', color: 'var(--rock)' }}>
              Input: {genResult.tokenUsage.inputTokens?.toLocaleString()} tokens | Output: {genResult.tokenUsage.outputTokens?.toLocaleString()} tokens
            </p>
          )}
          <pre style={{
            background: 'rgba(27,18,10,.03)', padding: 16, borderRadius: 10,
            fontSize: '.76rem', lineHeight: 1.5, whiteSpace: 'pre-wrap',
            wordBreak: 'break-word', maxHeight: 600, overflow: 'auto',
          }}>
            {JSON.stringify(genResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
