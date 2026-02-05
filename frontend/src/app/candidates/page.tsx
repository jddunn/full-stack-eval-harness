'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  Bot,
  Globe,
  Play,
  Loader2,
  GitBranch,
} from 'lucide-react';
import { candidatesApi, presetsApi, CandidatePreset } from '@/lib/api';
import type { Candidate, CandidateRunnerType } from '@/lib/types';

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [presets, setPresets] = useState<CandidatePreset[]>([]);
  const [showPresets, setShowPresets] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<{ output: string; latencyMs: number; error?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formRunnerType, setFormRunnerType] = useState<CandidateRunnerType>('llm_prompt');
  const [formSystemPrompt, setFormSystemPrompt] = useState('');
  const [formUserTemplate, setFormUserTemplate] = useState('');
  // Model config fields (structured instead of raw JSON)
  const [formProvider, setFormProvider] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formTemperature, setFormTemperature] = useState('');
  const [formMaxTokens, setFormMaxTokens] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  // HTTP endpoint fields
  const [formEndpointUrl, setFormEndpointUrl] = useState('');
  const [formEndpointMethod, setFormEndpointMethod] = useState('POST');
  const [formEndpointHeaders, setFormEndpointHeaders] = useState('');
  const [formEndpointBody, setFormEndpointBody] = useState('');

  const loadCandidates = async () => {
    try {
      const data = await candidatesApi.list();
      setCandidates(data);
    } catch (error) {
      console.error('Failed to load candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPresets = async () => {
    try {
      const data = await presetsApi.getCandidatePresets();
      setPresets(data);
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  };

  useEffect(() => {
    loadCandidates();
    loadPresets();
  }, []);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormRunnerType('llm_prompt');
    setFormSystemPrompt('');
    setFormUserTemplate('');
    setFormProvider('');
    setFormModel('');
    setFormTemperature('');
    setFormMaxTokens('');
    setFormApiKey('');
    setFormBaseUrl('');
    setFormEndpointUrl('');
    setFormEndpointMethod('POST');
    setFormEndpointHeaders('');
    setFormEndpointBody('');
    setEditingId(null);
  };

  const openEdit = (candidate: Candidate) => {
    setFormName(candidate.name);
    setFormDescription(candidate.description || '');
    setFormRunnerType(candidate.runnerType);
    setFormSystemPrompt(candidate.systemPrompt || '');
    setFormUserTemplate(candidate.userPromptTemplate || '');
    setFormProvider(candidate.modelConfig?.provider || '');
    setFormModel(candidate.modelConfig?.model || '');
    setFormTemperature(candidate.modelConfig?.temperature !== undefined ? String(candidate.modelConfig.temperature) : '');
    setFormMaxTokens(candidate.modelConfig?.maxTokens !== undefined ? String(candidate.modelConfig.maxTokens) : '');
    setFormApiKey(candidate.modelConfig?.apiKey || '');
    setFormBaseUrl(candidate.modelConfig?.baseUrl || '');
    setFormEndpointUrl(candidate.endpointUrl || '');
    setFormEndpointMethod(candidate.endpointMethod || 'POST');
    setFormEndpointHeaders(
      candidate.endpointHeaders ? JSON.stringify(candidate.endpointHeaders, null, 2) : ''
    );
    setFormEndpointBody(candidate.endpointBodyTemplate || '');
    setEditingId(candidate.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    const data: any = {
      name: formName,
      description: formDescription || undefined,
      runnerType: formRunnerType,
    };

    if (formRunnerType === 'llm_prompt') {
      data.systemPrompt = formSystemPrompt || undefined;
      data.userPromptTemplate = formUserTemplate || undefined;
      // Build modelConfig from structured fields (only include non-empty values)
      const modelConfig: Record<string, unknown> = {};
      if (formProvider) modelConfig.provider = formProvider;
      if (formModel) modelConfig.model = formModel;
      if (formTemperature !== '') modelConfig.temperature = parseFloat(formTemperature);
      if (formMaxTokens !== '') modelConfig.maxTokens = parseInt(formMaxTokens, 10);
      if (formApiKey) modelConfig.apiKey = formApiKey;
      if (formBaseUrl) modelConfig.baseUrl = formBaseUrl;
      if (Object.keys(modelConfig).length > 0) {
        data.modelConfig = modelConfig;
      }
    } else {
      data.endpointUrl = formEndpointUrl || undefined;
      data.endpointMethod = formEndpointMethod || undefined;
      data.endpointBodyTemplate = formEndpointBody || undefined;
      if (formEndpointHeaders) {
        try {
          data.endpointHeaders = JSON.parse(formEndpointHeaders);
        } catch {
          alert('Invalid JSON in endpoint headers');
          return;
        }
      }
    }

    try {
      if (editingId) {
        await candidatesApi.update(editingId, data);
      } else {
        await candidatesApi.create(data);
      }
      setShowForm(false);
      resetForm();
      loadCandidates();
    } catch (error) {
      console.error('Failed to save candidate:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this candidate?')) return;
    try {
      await candidatesApi.delete(id);
      loadCandidates();
    } catch (error) {
      console.error('Failed to delete candidate:', error);
    }
  };

  const handleLoadPreset = async (presetId: string) => {
    try {
      await presetsApi.loadCandidatePreset(presetId);
      setShowPresets(false);
      loadCandidates();
    } catch (error) {
      console.error('Failed to load preset:', error);
    }
  };

  const handleTest = async (candidate: Candidate) => {
    if (!testInput.trim()) return;
    setTestResult(null);
    try {
      const result = await candidatesApi.test(candidate.id, { input: testInput });
      setTestResult(result);
    } catch (error) {
      setTestResult({
        output: '',
        latencyMs: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Candidates</h1>
          <p className="text-sm text-muted-foreground">
            Define how to produce outputs for test cases — LLM prompts or HTTP endpoints.
          </p>
        </div>
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="btn-secondary flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Load Preset
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Candidate
          </button>

          {/* Preset dropdown */}
          {showPresets && (
            <div className="absolute right-0 top-full mt-2 w-80 card p-2 z-50 shadow-xl max-h-96 overflow-y-auto">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleLoadPreset(preset.id)}
                  className="w-full text-left p-3 hover:bg-muted/50 transition-colors"
                  style={{ borderRadius: 'var(--radius)' }}
                >
                  <div className="flex items-center gap-2">
                    {preset.runnerType === 'llm_prompt' ? (
                      <Bot className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{preset.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{preset.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Candidate list */}
      {candidates.length === 0 ? (
        <div className="card p-12 text-center">
          <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No candidates yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create a candidate to define how outputs are generated for test cases.
          </p>
          <div className="flex justify-center gap-2">
            <button onClick={() => setShowPresets(true)} className="btn-secondary">
              Load Preset
            </button>
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="btn-primary"
            >
              Create Candidate
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {candidates.map((candidate) => (
            <div key={candidate.id} className="card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {candidate.runnerType === 'llm_prompt' ? (
                    <Bot className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Globe className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <h3 className="text-sm font-medium">{candidate.name}</h3>
                    {candidate.description && (
                      <p className="text-xs text-muted-foreground">{candidate.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (testingId === candidate.id) {
                        setTestingId(null);
                        setTestResult(null);
                      } else {
                        setTestingId(candidate.id);
                        setTestInput('');
                        setTestResult(null);
                      }
                    }}
                    className="btn-ghost p-2"
                    title="Test candidate"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button onClick={() => openEdit(candidate)} className="btn-ghost p-2">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(candidate.id)}
                    className="btn-ghost p-2 hover:text-error"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="badge bg-muted text-muted-foreground">
                  {candidate.runnerType === 'llm_prompt' ? 'LLM Prompt' : 'HTTP Endpoint'}
                </span>
                {candidate.parentId && (
                  <span className="badge bg-muted text-muted-foreground flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    variant
                  </span>
                )}
                {candidate.modelConfig?.provider && (
                  <span className="badge bg-muted text-muted-foreground">
                    {candidate.modelConfig.provider}
                  </span>
                )}
                {candidate.modelConfig?.model && (
                  <span className="badge bg-muted text-muted-foreground">
                    {candidate.modelConfig.model}
                  </span>
                )}
                {candidate.modelConfig?.temperature !== undefined && (
                  <span className="badge bg-muted text-muted-foreground">
                    temp: {candidate.modelConfig.temperature}
                  </span>
                )}
              </div>

              {/* Preview */}
              {candidate.runnerType === 'llm_prompt' && candidate.userPromptTemplate && (
                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded font-mono overflow-hidden">
                  <span className="opacity-50">Template:</span>{' '}
                  {candidate.userPromptTemplate.substring(0, 120)}
                  {candidate.userPromptTemplate.length > 120 && '...'}
                </div>
              )}

              {candidate.runnerType === 'http_endpoint' && candidate.endpointUrl && (
                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded font-mono">
                  <span className="opacity-50">{candidate.endpointMethod || 'POST'}</span>{' '}
                  {candidate.endpointUrl}
                </div>
              )}

              {/* Test panel */}
              {testingId === candidate.id && (
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      placeholder="Enter test input..."
                      className="input flex-1"
                      onKeyDown={(e) => e.key === 'Enter' && handleTest(candidate)}
                    />
                    <button
                      onClick={() => handleTest(candidate)}
                      className="btn-primary"
                      disabled={!testInput.trim()}
                    >
                      Run
                    </button>
                  </div>
                  {testResult && (
                    <div
                      className={`text-xs p-2 rounded ${testResult.error ? 'bg-red-500/10 text-red-500' : 'bg-muted'}`}
                    >
                      {testResult.error ? (
                        <p>Error: {testResult.error}</p>
                      ) : (
                        <>
                          <p className="font-mono whitespace-pre-wrap">{testResult.output}</p>
                          <p className="text-muted-foreground mt-1">{testResult.latencyMs}ms</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <h2 className="text-lg font-semibold">
              {editingId ? 'Edit Candidate' : 'New Candidate'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Q&A Basic"
                  className="input w-full mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What does this candidate do?"
                  className="input w-full mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Runner Type</label>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => setFormRunnerType('llm_prompt')}
                    className={`flex-1 p-3 border text-sm font-medium transition-all ${
                      formRunnerType === 'llm_prompt'
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-border hover:border-foreground/50'
                    }`}
                    style={{ borderRadius: 'var(--radius)' }}
                  >
                    <Bot className="h-4 w-4 mx-auto mb-1" />
                    LLM Prompt
                  </button>
                  <button
                    onClick={() => setFormRunnerType('http_endpoint')}
                    className={`flex-1 p-3 border text-sm font-medium transition-all ${
                      formRunnerType === 'http_endpoint'
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-border hover:border-foreground/50'
                    }`}
                    style={{ borderRadius: 'var(--radius)' }}
                  >
                    <Globe className="h-4 w-4 mx-auto mb-1" />
                    HTTP Endpoint
                  </button>
                </div>
              </div>

              {/* LLM Prompt fields */}
              {formRunnerType === 'llm_prompt' && (
                <>
                  <div>
                    <label className="text-sm font-medium">System Prompt</label>
                    <textarea
                      value={formSystemPrompt}
                      onChange={(e) => setFormSystemPrompt(e.target.value)}
                      placeholder="You are a helpful assistant..."
                      className="input w-full mt-1 min-h-[80px] resize-y"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      User Prompt Template
                      <span className="text-muted-foreground font-normal ml-2">
                        {'Use {{input}}, {{context}}, {{metadata.*}}'}
                      </span>
                    </label>
                    <textarea
                      value={formUserTemplate}
                      onChange={(e) => setFormUserTemplate(e.target.value)}
                      placeholder={'{{input}}'}
                      className="input w-full mt-1 min-h-[80px] resize-y font-mono text-sm"
                    />
                  </div>
                  <div className="border border-border p-4 space-y-3" style={{ borderRadius: 'var(--radius)' }}>
                    <label className="text-sm font-medium">
                      Model Config
                      <span className="text-muted-foreground font-normal ml-2">
                        Override global settings per candidate
                      </span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Provider</label>
                        <select
                          value={formProvider}
                          onChange={(e) => setFormProvider(e.target.value)}
                          className="input w-full mt-1"
                        >
                          <option value="">(use global default)</option>
                          <option value="openai">OpenAI</option>
                          <option value="anthropic">Anthropic</option>
                          <option value="ollama">Ollama</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Model</label>
                        <input
                          type="text"
                          value={formModel}
                          onChange={(e) => setFormModel(e.target.value)}
                          placeholder={
                            formProvider === 'anthropic' ? 'claude-sonnet-4-5-20250929'
                            : formProvider === 'ollama' ? 'llama3:8b'
                            : 'gpt-4o-mini'
                          }
                          className="input w-full mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Temperature</label>
                        <input
                          type="number"
                          value={formTemperature}
                          onChange={(e) => setFormTemperature(e.target.value)}
                          placeholder="0.7"
                          min="0"
                          max="2"
                          step="0.1"
                          className="input w-full mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Max Tokens</label>
                        <input
                          type="number"
                          value={formMaxTokens}
                          onChange={(e) => setFormMaxTokens(e.target.value)}
                          placeholder="1024"
                          min="1"
                          className="input w-full mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">API Key (override)</label>
                      <input
                        type="password"
                        value={formApiKey}
                        onChange={(e) => setFormApiKey(e.target.value)}
                        placeholder="Leave empty to use global key"
                        className="input w-full mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Base URL (override)</label>
                      <input
                        type="text"
                        value={formBaseUrl}
                        onChange={(e) => setFormBaseUrl(e.target.value)}
                        placeholder={formProvider === 'ollama' ? 'http://localhost:11434' : 'Leave empty for default'}
                        className="input w-full mt-1"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* HTTP Endpoint fields */}
              {formRunnerType === 'http_endpoint' && (
                <>
                  <div>
                    <label className="text-sm font-medium">Endpoint URL</label>
                    <input
                      type="text"
                      value={formEndpointUrl}
                      onChange={(e) => setFormEndpointUrl(e.target.value)}
                      placeholder="http://localhost:8080/api/predict"
                      className="input w-full mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Method</label>
                    <select
                      value={formEndpointMethod}
                      onChange={(e) => setFormEndpointMethod(e.target.value)}
                      className="input w-full mt-1"
                    >
                      <option value="POST">POST</option>
                      <option value="GET">GET</option>
                      <option value="PUT">PUT</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      Headers
                      <span className="text-muted-foreground font-normal ml-2">JSON (optional)</span>
                    </label>
                    <textarea
                      value={formEndpointHeaders}
                      onChange={(e) => setFormEndpointHeaders(e.target.value)}
                      placeholder={'{"Authorization": "Bearer ..."}'}
                      className="input w-full mt-1 min-h-[60px] resize-y font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      Body Template
                      <span className="text-muted-foreground font-normal ml-2">
                        {'Use {{input}}, {{context}}'}
                      </span>
                    </label>
                    <textarea
                      value={formEndpointBody}
                      onChange={(e) => setFormEndpointBody(e.target.value)}
                      placeholder={'{"input": "{{input}}", "context": "{{context}}"}'}
                      className="input w-full mt-1 min-h-[80px] resize-y font-mono text-sm"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="btn-primary"
                disabled={!formName.trim()}
              >
                {editingId ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
