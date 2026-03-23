import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { previewRoutinePrompts, generateDailyWorkout } from '../../api/routine';
import { previewNutritionPrompts, generateDailyNutrition } from '../../api/nutrition';
import { previewChatPrompts, sendChatMessage } from '../../api/chat';
import './admin.css';

const TABS = [
  { key: 'routine', label: 'Routines' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'chat', label: 'AI Coach' },
];

// Haiku 4.5 pricing ($ per million tokens)
const INPUT_COST_PER_M = 0.80;
const OUTPUT_COST_PER_M = 4.00;
const EST_OUTPUT_TOKENS = { routine: 2000, nutrition: 2000, chat: 500 };
const CONTEXT_WINDOW = 200000;

function formatCost(tokens, ratePerM) {
  return (tokens * ratePerM / 1_000_000).toFixed(4);
}

function StatChip({ label, value, highlight }) {
  return (
    <div>
      <span style={{ fontSize: '.76rem', color: 'var(--rock)', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: highlight ? 'var(--sunset)' : 'var(--ink)' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function TokenBudgetBar({ tokens }) {
  const pct = Math.min((tokens / CONTEXT_WINDOW) * 100, 100);
  const color = pct < 25 ? '#22c55e' : pct < 50 ? '#eab308' : '#ef4444';
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.76rem', color: 'var(--rock)', marginBottom: 4 }}>
        <span>Token Budget ({tokens.toLocaleString()} / {CONTEXT_WINDOW.toLocaleString()})</span>
        <span style={{ fontWeight: 700, color }}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: 8, background: '#f3f0ea', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function CostEstimate({ inputTokens, outputTokens, actual }) {
  const inCost = formatCost(inputTokens, INPUT_COST_PER_M);
  const outCost = formatCost(outputTokens, OUTPUT_COST_PER_M);
  const total = (parseFloat(inCost) + parseFloat(outCost)).toFixed(4);
  return (
    <div style={{
      background: 'rgba(242,133,1,0.06)', borderRadius: 10, padding: '10px 16px',
      fontSize: '.82rem', color: 'var(--earth)', marginTop: 8,
    }}>
      <strong>Cost Estimate (Haiku 4.5):</strong>{' '}
      ${inCost} input + ${outCost} output = <strong>${total}</strong>
      {actual && (
        <span style={{ marginLeft: 12, color: 'var(--sunset)' }}>
          Actual: ${formatCost(actual.inputTokens, INPUT_COST_PER_M)} in + ${formatCost(actual.outputTokens, OUTPUT_COST_PER_M)} out = ${(parseFloat(formatCost(actual.inputTokens, INPUT_COST_PER_M)) + parseFloat(formatCost(actual.outputTokens, OUTPUT_COST_PER_M))).toFixed(4)}
        </span>
      )}
    </div>
  );
}

function PromptSizeBreakdown({ systemLen, userLen }) {
  const sysTokens = Math.ceil(systemLen / 4);
  const usrTokens = Math.ceil(userLen / 4);
  return (
    <div style={{ display: 'flex', gap: 24, fontSize: '.82rem', color: 'var(--rock)', marginTop: 8 }}>
      <span>System: {systemLen.toLocaleString()} chars (~{sysTokens.toLocaleString()} tokens)</span>
      {userLen > 0 && <span>User: {userLen.toLocaleString()} chars (~{usrTokens.toLocaleString()} tokens)</span>}
      <span style={{ fontWeight: 600 }}>Total: {(systemLen + userLen).toLocaleString()} chars (~{(sysTokens + usrTokens).toLocaleString()} tokens)</span>
    </div>
  );
}

function ResponseValidation({ activeTab, genResult }) {
  if (!genResult) return null;
  const checks = [];

  if (activeTab === 'routine') {
    try {
      const parsed = typeof genResult === 'string' ? JSON.parse(genResult) : genResult;
      checks.push({ label: 'Valid JSON', pass: true });
      checks.push({ label: 'Has dailyWorkout or title', pass: !!(parsed.dailyWorkout || parsed.title) });
      const exData = parsed.dailyWorkout?.exercises || parsed.exercises;
      checks.push({ label: 'Has exercises array', pass: Array.isArray(exData) && exData.length > 0 });
    } catch {
      checks.push({ label: 'Valid JSON', pass: false });
    }
  } else if (activeTab === 'nutrition') {
    try {
      const parsed = typeof genResult === 'string' ? JSON.parse(genResult) : genResult;
      checks.push({ label: 'Valid JSON', pass: true });
      checks.push({ label: 'Has dailyNutrition or title', pass: !!(parsed.dailyNutrition || parsed.title) });
      const meals = parsed.dailyNutrition?.meals || parsed.meals;
      checks.push({ label: 'Has meals array', pass: Array.isArray(meals) && meals.length > 0 });
    } catch {
      checks.push({ label: 'Valid JSON', pass: false });
    }
  } else if (activeTab === 'chat') {
    const resp = genResult.response || genResult;
    checks.push({ label: 'Non-empty response', pass: typeof resp === 'string' && resp.length > 0 });
    checks.push({ label: 'No em-dashes', pass: typeof resp === 'string' && !resp.includes('\u2014') && !resp.includes('\u2013') });
  }

  return (
    <div style={{ display: 'flex', gap: 12, fontSize: '.82rem', marginTop: 8 }}>
      {checks.map((c, i) => (
        <span key={i} style={{ color: c.pass ? '#22c55e' : '#ef4444' }}>
          {c.pass ? '\u2713' : '\u2717'} {c.label}
        </span>
      ))}
    </div>
  );
}

export default function RoutineDebug() {
  const { getIdToken } = useAuth();
  const [activeTab, setActiveTab] = useState('routine');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [genResult, setGenResult] = useState(null);
  const [error, setError] = useState(null);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setPreview(null);
    setGenResult(null);
    setError(null);
  };

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const token = await getIdToken();
      let data;
      if (activeTab === 'routine') data = await previewRoutinePrompts(token);
      else if (activeTab === 'nutrition') data = await previewNutritionPrompts(token);
      else data = await previewChatPrompts(token);
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
      let data;
      if (activeTab === 'routine') {
        data = await generateDailyWorkout(token);
      } else if (activeTab === 'nutrition') {
        data = await generateDailyNutrition(token);
      } else {
        data = await sendChatMessage(token, '[Admin Debug] Summarize my current training status and suggest what I should focus on today.');
      }
      setGenResult(data);
    } catch (err) {
      setError(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const estTokens = preview?.estimatedTokens || 0;
  const actualUsage = genResult?.tokenUsage || genResult?.usage || null;
  const systemLen = preview?.systemPrompt?.length || 0;
  const userLen = preview?.userPrompt?.length || 0;

  // Build context stats from preview response (generalized)
  const contextStats = preview?.contextStats || preview?.catalogStats || null;

  return (
    <div>
      <div className="admin-page-header">
        <h1>AI Debug Tool</h1>
        <p>Preview prompts, test generation, and analyze token costs across all AI systems</p>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(27,18,10,0.04)',
        borderRadius: 12, padding: 4, width: 'fit-content',
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            style={{
              padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: '.88rem', fontWeight: 600, transition: 'all 0.2s',
              background: activeTab === t.key ? 'var(--sunset)' : 'transparent',
              color: activeTab === t.key ? '#fff' : 'var(--rock)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button className="btn primary" onClick={handlePreview} disabled={loading || generating}>
          {loading ? 'Loading...' : 'Preview Prompts'}
        </button>
        <button className="btn" onClick={handleGenerate} disabled={loading || generating}>
          {generating ? 'Generating...' : activeTab === 'chat' ? 'Send Test Message' : 'Send to Bedrock'}
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
          {/* Stats Bar */}
          <div style={{
            background: '#fff', borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-soft)', padding: '16px 24px',
          }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <StatChip label="Est. Tokens" value={`~${estTokens.toLocaleString()}`} highlight />
              {contextStats && Object.entries(contextStats).map(([key, val]) => {
                if (typeof val === 'boolean') return <StatChip key={key} label={key.replace(/([A-Z])/g, ' $1').trim()} value={val ? 'Yes' : 'No'} />;
                if (typeof val === 'number') return <StatChip key={key} label={key.replace(/([A-Z])/g, ' $1').trim()} value={val} />;
                if (typeof val === 'string') return <StatChip key={key} label={key.replace(/([A-Z])/g, ' $1').trim()} value={val} />;
                return null;
              })}
            </div>

            <TokenBudgetBar tokens={estTokens} />
            <CostEstimate
              inputTokens={estTokens}
              outputTokens={EST_OUTPUT_TOKENS[activeTab]}
              actual={actualUsage}
            />
            <PromptSizeBreakdown systemLen={systemLen} userLen={userLen} />
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
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>
              User Prompt {activeTab === 'chat' && <span style={{ fontSize: '.82rem', color: 'var(--rock)', fontWeight: 400 }}>(varies per message)</span>}
            </h3>
            <pre style={{
              background: 'rgba(27,18,10,.03)', padding: 16, borderRadius: 10,
              fontSize: '.76rem', lineHeight: 1.5, whiteSpace: 'pre-wrap',
              wordBreak: 'break-word', maxHeight: 500, overflow: 'auto',
              color: activeTab === 'chat' ? 'var(--rock)' : 'inherit',
              fontStyle: activeTab === 'chat' ? 'italic' : 'normal',
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
          <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>
            {activeTab === 'chat' ? 'Coach Response' : 'Bedrock Response'}
          </h3>
          {(genResult.tokenUsage || genResult.usage) && (
            <p style={{ margin: '0 0 4px', fontSize: '.82rem', color: 'var(--rock)' }}>
              Input: {(genResult.tokenUsage?.inputTokens || genResult.usage?.input_tokens || 0).toLocaleString()} tokens | Output: {(genResult.tokenUsage?.outputTokens || genResult.usage?.output_tokens || 0).toLocaleString()} tokens
            </p>
          )}
          <ResponseValidation activeTab={activeTab} genResult={genResult} />
          {preview && (
            <CostEstimate
              inputTokens={genResult.tokenUsage?.inputTokens || genResult.usage?.input_tokens || estTokens}
              outputTokens={genResult.tokenUsage?.outputTokens || genResult.usage?.output_tokens || EST_OUTPUT_TOKENS[activeTab]}
            />
          )}
          <pre style={{
            background: 'rgba(27,18,10,.03)', padding: 16, borderRadius: 10,
            fontSize: '.76rem', lineHeight: 1.5, whiteSpace: 'pre-wrap',
            wordBreak: 'break-word', maxHeight: 600, overflow: 'auto', marginTop: 12,
          }}>
            {activeTab === 'chat'
              ? (genResult.response || JSON.stringify(genResult, null, 2))
              : JSON.stringify(genResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
