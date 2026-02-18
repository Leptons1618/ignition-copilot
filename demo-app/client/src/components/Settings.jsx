import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings, Server, Brain, FolderCog, Palette, Save, RotateCcw, CheckCircle2,
  XCircle, Loader2, Eye, EyeOff, TestTube2, ExternalLink,
} from 'lucide-react';
import { getServiceConfig, updateServiceConfig, testServiceConnections } from '../api.js';
import { useTheme } from '../lib/theme.jsx';
import { useNotifications } from '../lib/notifications.jsx';

const MAX_URL_LENGTH = 500;
const MAX_FIELD_LENGTH = 200;

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
  const { theme, themeId, switchTheme, themes } = useTheme();
  const notifications = useNotifications();
  const [config, setConfig] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState({});

  const loadConfig = useCallback(async () => {
    try {
      const data = await getServiceConfig();
      setConfig(data);
      setDirty(false);
      setErrors({});
    } catch (err) {
      notifications.error('Failed to load settings: ' + err.message);
    }
  }, [notifications]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const updateField = (field, value) => {
    const sanitized = sanitize(value);
    setConfig(prev => ({ ...prev, [field]: sanitized }));
    setDirty(true);

    // Validate URLs
    if (field === 'ollamaUrl' || field === 'ignitionUrl') {
      if (sanitized && !isValidUrl(sanitized)) {
        setErrors(prev => ({ ...prev, [field]: 'Invalid URL format (must be http:// or https://)' }));
      } else {
        setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
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
      if (allOk) notifications.success('All connections successful!');
      else notifications.warning('Some connections failed. Check results below.');
    } catch (err) {
      notifications.error('Connection test failed: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  if (!config) {
    return (
      <div className="h-full flex items-center justify-center t-bg">
        <Loader2 size={24} className="animate-spin t-accent" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto t-bg">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center t-accent-soft">
              <Settings size={20} className="t-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold t-text">Settings</h1>
              <p className="text-sm t-text-m">Configure services, connections, and appearance</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={testConnections}
              disabled={testing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer t-info-soft t-info"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <TestTube2 size={14} />}
              Test
            </button>
            <button
              onClick={loadConfig}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer t-surface t-text-2"
            >
              <RotateCcw size={14} />
              Reset
            </button>
            <button
              onClick={save}
              disabled={!dirty || saving || Object.keys(errors).length > 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 cursor-pointer ${dirty ? 't-accent-bg text-white' : 't-surface t-text-m'}`}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
          </div>
        </div>

        {/* Test Results */}
        {testResults && (
          <div className="rounded-xl border p-4 animate-slide-up t-surface t-border-s">
            <h3 className="text-sm font-semibold mb-3 t-text">Connection Test Results</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(testResults).map(([service, result]) => (
                <div key={service} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${result.connected ? 't-ok-soft' : 't-err-soft'}`}>
                  {result.connected
                    ? <CheckCircle2 size={16} className="t-ok" />
                    : <XCircle size={16} className="t-err" />}
                  <div>
                    <div className="text-sm font-medium capitalize t-text">{service}</div>
                    <div className="text-xs t-text-m">
                      {result.connected ? `Status ${result.status}` : result.error || 'Failed'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Appearance Section */}
        <Section icon={Palette} title="Appearance">
          <div>
            <label className="text-sm font-medium block mb-2 t-text-2">Theme</label>
            <div className="grid grid-cols-3 gap-3">
              {Object.values(themes).map(t => (
                <button
                  key={t.id}
                  onClick={() => switchTheme(t.id)}
                  className={`relative rounded-xl p-3 border-2 transition-all text-left cursor-pointer ${themeId === t.id ? 't-accent-border' : 't-border-s'}`}
                  style={{ background: t.colors.bg }}
                >
                  <div className="flex gap-1.5 mb-2">
                    {[t.colors.accent, t.colors.success, t.colors.warning, t.colors.error, t.colors.info].map((c, i) => (
                      <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="text-sm font-medium" style={{ color: t.colors.text }}>{t.label}</div>
                  {themeId === t.id && (
                    <CheckCircle2 size={16} className="absolute top-2 right-2 t-accent" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* LLM / Ollama Section */}
        <Section icon={Brain} title="LLM Service (Ollama)">
          <SettingField
            label="Ollama URL"
            value={config.ollamaUrl}
            onChange={v => updateField('ollamaUrl', v)}
            placeholder="http://localhost:11434"
            error={errors.ollamaUrl}
          />
        </Section>

        {/* Ignition Gateway Section */}
        <Section icon={Server} title="Ignition Gateway">
          <SettingField
            label="Gateway URL"
            value={config.ignitionUrl}
            onChange={v => updateField('ignitionUrl', v)}
            placeholder="http://localhost:8088"
            error={errors.ignitionUrl}
          />
          <SettingField
            label="Project Name"
            value={config.ignitionProject}
            onChange={v => updateField('ignitionProject', v)}
            placeholder="ignition-copilot"
          />
          <div className="grid grid-cols-2 gap-3">
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

        {/* Environment Info */}
        <Section icon={FolderCog} title="Environment">
          <div className="rounded-lg p-3 text-xs space-y-1 t-bg t-text-m">
            <div className="flex items-center justify-between">
              <span>Server API</span>
              <code className="font-mono px-2 py-0.5 rounded t-surface t-text-2">
                http://localhost:3001
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span>Config file</span>
              <code className="font-mono px-2 py-0.5 rounded t-surface t-text-2">
                data/service-config.json
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span>Theme</span>
              <code className="font-mono px-2 py-0.5 rounded t-surface t-text-2">
                {themeId}
              </code>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border p-5 space-y-4 t-surface t-border-s">
      <div className="flex items-center gap-2">
        <Icon size={16} className="t-accent" />
        <h2 className="text-sm font-semibold t-text">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function SettingField({ label, value, onChange, placeholder, error, type = 'text' }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1.5 t-text-m">{label}</label>
      <input
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
