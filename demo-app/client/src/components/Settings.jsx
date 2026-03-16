import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings, Server, Brain, FolderCog, Palette, Save, RotateCcw, CheckCircle2,
  XCircle, Loader2, Eye, EyeOff, TestTube2, Sparkles, ArrowRight, Circle,
} from 'lucide-react';
import {
  getServiceConfig,
  updateServiceConfig,
  testServiceConnections,
  getSetupStatus,
  updateSetupChecklist,
  verifySetup,
} from '../api.js';
import { useTheme } from '../lib/theme.jsx';
import { useNotifications } from '../lib/notifications.jsx';

const MAX_URL_LENGTH = 500;
const MAX_FIELD_LENGTH = 200;
const LLM_PROVIDER_OPTIONS = [
  { value: 'none', label: 'Not Configured' },
  { value: 'ollama', label: 'Local LLM (Ollama)' },
  { value: 'openai', label: 'OpenAI API' },
  { value: 'google', label: 'Google Gemini API' },
  { value: 'anthropic', label: 'Anthropic API' },
  { value: 'openai-compatible', label: 'Other OpenAI-Compatible API' },
];

const LLM_BASE_URL_DEFAULTS = {
  none: '',
  ollama: 'http://localhost:11434',
  openai: 'https://api.openai.com',
  google: 'https://generativelanguage.googleapis.com',
  anthropic: 'https://api.anthropic.com',
  'openai-compatible': '',
};

function sanitize(val) {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, MAX_FIELD_LENGTH);
}

function isValidUrl(str) {
  if (!str) return true;
  try {
    const u = new URL(str);
    return ['http:', 'https:'].includes(u.protocol) && str.length <= MAX_URL_LENGTH;
  } catch {
    return false;
  }
}

export default function SettingsPage() {
  const { themeId, switchTheme, themes } = useTheme();
  const notifications = useNotifications();
  const [config, setConfig] = useState(null);
  const [setupStatus, setSetupStatus] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [errors, setErrors] = useState({});

  const loadSetupStatus = useCallback(async () => {
    try {
      const status = await getSetupStatus();
      setSetupStatus(status);
    } catch {
      setSetupStatus(null);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const data = await getServiceConfig();
      setConfig({
        ...data,
        llmProvider: data.llmProvider || 'none',
        llmBaseUrl: data.llmBaseUrl || '',
        llmApiKey: data.llmApiKey || '',
        llmModel: data.llmModel || '',
      });
      setDirty(false);
      setErrors({});
      await loadSetupStatus();
    } catch (err) {
      notifications.error('Failed to load settings: ' + err.message);
    }
  }, [loadSetupStatus, notifications]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const updateField = (field, value) => {
    const sanitized = sanitize(value);
    setConfig(prev => {
      const next = { ...prev, [field]: sanitized };
      if (field === 'llmProvider') {
        const nextDefault = LLM_BASE_URL_DEFAULTS[sanitized] || '';
        if (!prev.llmBaseUrl || prev.llmProvider === 'none') {
          next.llmBaseUrl = nextDefault;
        }
        if (sanitized === 'none') {
          next.llmBaseUrl = '';
          next.llmModel = '';
        }
      }
      if (field === 'llmBaseUrl' && (prev.llmProvider || 'none') === 'ollama') {
        next.ollamaUrl = sanitized;
      }
      return next;
    });
    setDirty(true);

    if (field === 'ignitionUrl' || field === 'llmBaseUrl') {
      if (sanitized && !isValidUrl(sanitized)) {
        setErrors(prev => ({ ...prev, [field]: 'Invalid URL format (must be http:// or https://)' }));
      } else {
        setErrors(prev => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    }
  };

  const save = async () => {
    if (Object.keys(errors).length > 0) {
      notifications.warning('Fix validation errors before saving.');
      return;
    }
    setSaving(true);
    try {
      await updateServiceConfig(config);
      setDirty(false);
      notifications.success('Settings saved successfully.');
      await loadSetupStatus();
    } catch (err) {
      notifications.error('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const testConnections = async () => {
    setTesting(true);
    setTestResults(null);
    try {
      const results = await testServiceConnections();
      setTestResults(results);
      const allOk = Object.values(results).every(r => r.connected);
      if (allOk) notifications.success('All connections successful.');
      else notifications.warning('Some connection checks failed.');
      await loadSetupStatus();
    } catch (err) {
      notifications.error('Connection test failed: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  const runSetupVerify = async () => {
    setTesting(true);
    try {
      const checks = await verifySetup();
      setTestResults(checks);
      await loadSetupStatus();
      if (checks?.llm?.connected && checks?.ignition?.connected) {
        notifications.success('Setup verification passed.');
      } else {
        notifications.warning('Verification completed with issues.');
      }
    } catch (err) {
      notifications.error('Verification failed: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  const setChecklist = async (key, value) => {
    try {
      await updateSetupChecklist({ [key]: value });
      await loadSetupStatus();
    } catch (err) {
      notifications.error(`Failed to update ${key}: ${err.message}`);
    }
  };

  if (!config) {
    return (
      <div className="h-full flex items-center justify-center t-bg">
        <Loader2 size={24} className="animate-spin t-accent" />
      </div>
    );
  }

  const provider = config.llmProvider || 'none';
  const hostedProvider = provider !== 'none' && provider !== 'ollama';

  return (
    <div className="h-full overflow-y-auto t-bg">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="rounded-2xl p-5 border t-border-s t-surface relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-20 t-accent-bg" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs t-accent-soft t-accent font-semibold mb-2">
                <Sparkles size={12} />
                Guided Setup
              </div>
              <h1 className="text-2xl font-bold t-text">System Configuration</h1>
              <p className="text-sm t-text-m mt-1">Configure your AI stack and verify each integration step-by-step.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={runSetupVerify}
                disabled={testing}
                data-testid="settings-verify-setup"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer t-info-soft t-info"
              >
                {testing ? <Loader2 size={14} className="animate-spin" /> : <TestTube2 size={14} />}
                Verify
              </button>
              <button
                onClick={loadConfig}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer t-surface t-text-2"
              >
                <RotateCcw size={14} />
                Reload
              </button>
              <button
                onClick={save}
                disabled={!dirty || saving || Object.keys(errors).length > 0}
                data-testid="settings-save"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 cursor-pointer ${dirty ? 't-accent-bg text-white' : 't-surface t-text-m'}`}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Section icon={Brain} title="Step 1: Choose LLM Mode">
              <div className="space-y-3">
                <label className="text-xs font-medium block t-text-m">Provider</label>
                <select
                  value={provider}
                  onChange={e => updateField('llmProvider', e.target.value)}
                  data-testid="settings-llm-provider"
                  className="w-full rounded-lg px-3 py-2 text-sm border transition-colors t-field-bg t-field-border t-field-fg"
                >
                  {LLM_PROVIDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {provider === 'none' && (
                <div className="rounded-lg p-3 t-warn-soft t-warn border t-warn-border text-sm">
                  LLM is currently not configured. Select Local or API provider to continue.
                </div>
              )}

              {provider === 'ollama' && (
                <SetupTrack
                  title="Local LLM Setup (Ollama)"
                  steps={[
                    'Install Ollama on your machine or run it in Docker profile local-llm.',
                    'Pull at least one model (example: ollama pull llama3.2:3b).',
                    'Set Ollama URL and model below, then click Verify.',
                  ]}
                />
              )}

              {hostedProvider && (
                <SetupTrack
                  title="API LLM Setup"
                  steps={[
                    'Create API key with your provider account.',
                    'Set provider base URL, API key, and a default model.',
                    'Click Verify to ensure model listing and auth work.',
                  ]}
                />
              )}

              {provider !== 'none' && (
                <>
                  <SettingField
                    label="LLM Base URL"
                    value={config.llmBaseUrl}
                    onChange={v => updateField('llmBaseUrl', v)}
                    placeholder={LLM_BASE_URL_DEFAULTS[provider] || 'https://api.example.com'}
                    error={errors.llmBaseUrl}
                    testId="settings-llm-base-url"
                  />
                  <SettingField
                    label="Default Model"
                    value={config.llmModel}
                    onChange={v => updateField('llmModel', v)}
                    placeholder={provider === 'ollama' ? 'llama3.2:3b' : 'gpt-4o-mini'}
                    testId="settings-llm-model"
                  />
                </>
              )}

              <div>
                <label className="text-xs font-medium block mb-1.5 t-text-m">API Key</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={config.llmApiKey || ''}
                    onChange={e => updateField('llmApiKey', e.target.value)}
                    data-testid="settings-llm-api-key"
                    placeholder={hostedProvider ? 'Enter provider API key' : 'Not required for local mode'}
                    className="w-full rounded-lg px-3 py-2 text-sm border transition-colors pr-9 t-field-bg t-field-border t-field-fg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 t-text-m cursor-pointer"
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </Section>

            <Section icon={Server} title="Step 2: Ignition Gateway">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SettingField
                  label="Gateway URL"
                  value={config.ignitionUrl}
                  onChange={v => updateField('ignitionUrl', v)}
                  placeholder="http://localhost:8088"
                  error={errors.ignitionUrl}
                />
                <SettingField
                  label="Project"
                  value={config.ignitionProject}
                  onChange={v => updateField('ignitionProject', v)}
                  placeholder="ignition-copilot"
                />
                <SettingField
                  label="Username"
                  value={config.ignitionUser}
                  onChange={v => updateField('ignitionUser', v)}
                  placeholder="admin"
                />
                <div>
                  <label className="text-xs font-medium block mb-1.5 t-text-m">Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={config.ignitionPass || ''}
                      onChange={e => updateField('ignitionPass', e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg px-3 py-2 text-sm border transition-colors pr-9 t-field-bg t-field-border t-field-fg"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 t-text-m cursor-pointer"
                    >
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </Section>

            <Section icon={FolderCog} title="Step 3: Manual Tasks">
              <ManualTask
                id="ignitionScriptsInstalled"
                title="Ignition WebDev Scripts Installed"
                description="Import/deploy required WebDev scripts in your Ignition project."
                checked={Boolean(setupStatus?.checklist?.ignitionScriptsInstalled)}
                onToggle={(v) => setChecklist('ignitionScriptsInstalled', v)}
              />
              <ManualTask
                id="mcpConfigured"
                title="MCP Server Configured"
                description="Set MCP config and verify credentials/endpoints from host environment."
                checked={Boolean(setupStatus?.checklist?.mcpConfigured)}
                onToggle={(v) => setChecklist('mcpConfigured', v)}
              />
            </Section>
          </div>

          <div className="space-y-6">
            <Section icon={ArrowRight} title="Setup Progress">
              <ProgressItem label="Provider selected" ok={provider !== 'none'} />
              <ProgressItem
                label="LLM configured"
                ok={Boolean(provider !== 'none' && config.llmBaseUrl && config.llmModel && (provider === 'ollama' || config.llmApiKey))}
              />
              <ProgressItem label="Manual scripts done" ok={Boolean(setupStatus?.checklist?.ignitionScriptsInstalled)} />
              <ProgressItem label="MCP configured" ok={Boolean(setupStatus?.checklist?.mcpConfigured)} />
            </Section>

            <Section icon={Palette} title="Theme">
              <div className="grid grid-cols-2 gap-2">
                {Object.values(themes).map(t => (
                  <button
                    key={t.id}
                    onClick={() => switchTheme(t.id)}
                    className={`relative rounded-xl p-3 border-2 text-left cursor-pointer ${themeId === t.id ? 't-accent-border' : 't-border-s'}`}
                    style={{ background: t.colors.bg }}
                  >
                    <div className="text-xs font-semibold" style={{ color: t.colors.text }}>{t.label}</div>
                    {themeId === t.id && <CheckCircle2 size={14} className="absolute top-2 right-2 t-accent" />}
                  </button>
                ))}
              </div>
            </Section>

            {testResults && (
              <Section icon={TestTube2} title="Verification Results">
                <div className="space-y-2">
                  {Object.entries(testResults).map(([service, result]) => (
                    <div key={service} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${result.connected ? 't-ok-soft' : 't-err-soft'}`}>
                      {result.connected ? <CheckCircle2 size={15} className="t-ok" /> : <XCircle size={15} className="t-err" />}
                      <div>
                        <div className="text-xs font-semibold capitalize t-text">{service}</div>
                        <div className="text-xs t-text-m">{result.connected ? `Status ${result.status}` : (result.error || 'Failed')}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={testConnections}
                  disabled={testing}
                  data-testid="settings-test-connections"
                  className="mt-3 w-full px-3 py-2 rounded-lg text-sm font-medium t-info-soft t-info cursor-pointer"
                >
                  {testing ? 'Testing...' : 'Run Connection Test'}
                </button>
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border p-5 space-y-4 t-surface t-border-s">
      <div className="flex items-center gap-2">
        <Icon size={16} className="t-accent" />
        <h2 className="text-sm font-semibold t-text">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function SetupTrack({ title, steps }) {
  return (
    <div className="rounded-xl border t-border-s p-3 space-y-2 t-bg">
      <div className="text-xs uppercase tracking-wide t-text-m font-semibold">{title}</div>
      {steps.map((step, i) => (
        <div key={step} className="flex items-start gap-2 text-sm t-text-2">
          <span className="mt-0.5"><Circle size={10} className="t-accent" /></span>
          <span><strong>Step {i + 1}.</strong> {step}</span>
        </div>
      ))}
    </div>
  );
}

function ProgressItem({ label, ok }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 size={14} className="t-ok" /> : <Circle size={14} className="t-text-m" />}
      <span className={ok ? 't-text' : 't-text-m'}>{label}</span>
    </div>
  );
}

function ManualTask({ id, title, description, checked, onToggle }) {
  return (
    <label className="flex items-start gap-3 rounded-xl p-3 border t-border-s t-bg cursor-pointer">
      <input data-testid={`settings-manual-${id}`} type="checkbox" checked={checked} onChange={e => onToggle(e.target.checked)} className="mt-1" />
      <div>
        <div className="text-sm font-semibold t-text">{title}</div>
        <div className="text-xs t-text-m mt-0.5">{description}</div>
      </div>
    </label>
  );
}

function SettingField({ label, value, onChange, placeholder, error, type = 'text', testId = undefined }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1.5 t-text-m">{label}</label>
      <input
        data-testid={testId}
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={MAX_URL_LENGTH}
        className={`w-full rounded-lg px-3 py-2 text-sm border transition-colors t-field-bg t-field-fg ${error ? 't-err-border' : 't-field-border'}`}
      />
      {error && <div className="text-xs mt-1 t-err">{error}</div>}
    </div>
  );
}
