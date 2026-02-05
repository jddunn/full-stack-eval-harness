'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Sparkles, Info } from 'lucide-react';
import { gradersApi, presetsApi, type GraderPreset } from '@/lib/api';
import type { Grader, GraderType } from '@/lib/types';

const GRADER_TYPES: { value: GraderType; label: string; description: string }[] = [
  {
    value: 'exact-match',
    label: 'Exact Match',
    description: 'Output must match expected string exactly',
  },
  {
    value: 'llm-judge',
    label: 'LLM Judge',
    description: 'Uses an LLM with your rubric to judge pass/fail',
  },
  {
    value: 'semantic-similarity',
    label: 'Semantic Similarity',
    description: 'Compares embeddings using cosine similarity',
  },
  {
    value: 'faithfulness',
    label: 'Faithfulness',
    description: 'Checks if output is faithful to provided context (RAGAS-inspired)',
  },
  {
    value: 'contains',
    label: 'Contains',
    description: 'Checks if output contains required substrings',
  },
  {
    value: 'regex',
    label: 'Regex Match',
    description: 'Checks if output matches a regular expression pattern',
  },
  {
    value: 'json-schema',
    label: 'JSON Schema',
    description: 'Validates output is valid JSON matching a schema',
  },
  {
    value: 'answer-relevancy',
    label: 'Answer Relevancy',
    description: 'Measures if the answer is relevant to the question (RAGAS-inspired)',
  },
  {
    value: 'context-relevancy',
    label: 'Context Relevancy',
    description: 'Measures if retrieved context is relevant to the question (RAGAS-inspired)',
  },
];

function Tooltip({ text }: { text: string }) {
  return (
    <div className="group relative inline-block">
      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-foreground text-background text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 max-w-xs text-center">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
      </div>
    </div>
  );
}

export default function GradersPage() {
  const [graders, setGraders] = useState<Grader[]>([]);
  const [presets, setPresets] = useState<GraderPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [editingGrader, setEditingGrader] = useState<Grader | null>(null);
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'exact-match' as GraderType,
    rubric: '',
  });

  useEffect(() => {
    loadGraders();
    loadPresets();
  }, []);

  async function loadGraders() {
    try {
      const data = await gradersApi.list();
      setGraders(data);
    } catch (error) {
      console.error('Failed to load graders:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPresets() {
    try {
      const data = await presetsApi.getGraderPresets();
      setPresets(data);
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  }

  async function loadPreset(preset: GraderPreset) {
    setLoadingPreset(preset.id);
    try {
      await presetsApi.loadGraderPreset(preset.id);
      await loadGraders();
      setShowPresets(false);
    } catch (error) {
      console.error('Failed to load preset:', error);
    } finally {
      setLoadingPreset(null);
    }
  }

  function openForm(grader?: Grader) {
    if (grader) {
      setEditingGrader(grader);
      setFormData({
        name: grader.name,
        description: grader.description || '',
        type: grader.type,
        rubric: grader.rubric || '',
      });
    } else {
      setEditingGrader(null);
      setFormData({
        name: '',
        description: '',
        type: 'exact-match',
        rubric: '',
      });
    }
    setShowForm(true);
  }

  async function saveGrader() {
    if (!formData.name.trim()) return;

    try {
      if (editingGrader) {
        await gradersApi.update(editingGrader.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          rubric: formData.rubric.trim() || undefined,
        });
      } else {
        await gradersApi.create({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          type: formData.type,
          rubric: formData.rubric.trim() || undefined,
        });
      }
      setShowForm(false);
      setEditingGrader(null);
      loadGraders();
    } catch (error) {
      console.error('Failed to save grader:', error);
    }
  }

  async function deleteGrader(id: string) {
    if (!confirm('Delete this grader?')) return;

    try {
      await gradersApi.delete(id);
      loadGraders();
    } catch (error) {
      console.error('Failed to delete grader:', error);
    }
  }

  const needsRubric = formData.type === 'llm-judge';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Graders</h1>
          <p className="text-muted-foreground mt-1">
            Define evaluation criteria for your test cases
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <button onClick={() => setShowPresets(!showPresets)} className="btn-secondary">
              <Sparkles className="h-4 w-4 mr-2" />
              Load Preset
            </button>

            {showPresets && (
              <div className="absolute right-0 mt-2 w-80 card p-2 z-50 shadow-xl max-h-96 overflow-y-auto">
                <div className="text-xs text-muted-foreground px-2 py-1 mb-1">
                  Quick-load pre-configured graders
                </div>
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => loadPreset(preset)}
                    disabled={loadingPreset === preset.id}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{preset.name}</span>
                      <Tooltip text={preset.tooltip} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => openForm()} className="btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            New Grader
          </button>
        </div>
      </div>

      {graders.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-muted-foreground">No graders yet</p>
          <div className="flex gap-2 justify-center mt-4">
            <button onClick={() => setShowPresets(true)} className="btn-secondary">
              <Sparkles className="h-4 w-4 mr-2" />
              Load a preset
            </button>
            <button onClick={() => openForm()} className="btn-secondary">
              Create from scratch
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {graders.map((grader) => {
            const typeInfo = GRADER_TYPES.find((t) => t.value === grader.type);
            return (
              <div key={grader.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{grader.name}</h3>
                      <span className="badge bg-muted text-muted-foreground">
                        {typeInfo?.label || grader.type}
                      </span>
                      {typeInfo && <Tooltip text={typeInfo.description} />}
                    </div>
                    {grader.description && (
                      <p className="text-sm text-muted-foreground mt-1">{grader.description}</p>
                    )}
                    {grader.rubric && (
                      <p className="text-xs text-muted-foreground mt-2 font-mono truncate">
                        Rubric: {grader.rubric.slice(0, 100)}
                        {grader.rubric.length > 100 ? '...' : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 ml-4">
                    <button
                      onClick={() => openForm(grader)}
                      className="btn-ghost p-2 text-muted-foreground"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteGrader(grader.id)}
                      className="btn-ghost p-2 text-muted-foreground hover:text-error"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold mb-4">
              {editingGrader ? 'Edit Grader' : 'Create Grader'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Grader"
                  className="input"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Evaluates responses for..."
                  className="input"
                />
              </div>

              {!editingGrader && (
                <div>
                  <label className="text-sm font-medium block mb-1 flex items-center gap-2">
                    Type
                    <Tooltip text="Choose how the grader evaluates responses" />
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as GraderType })
                    }
                    className="input"
                  >
                    {GRADER_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label} — {type.description}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {needsRubric && (
                <div>
                  <label className="text-sm font-medium block mb-1 flex items-center gap-2">
                    Rubric
                    <span className="text-muted-foreground font-normal">
                      (required for LLM Judge)
                    </span>
                    <Tooltip text="Instructions the LLM uses to evaluate responses. Be specific about what passes and fails." />
                  </label>
                  <textarea
                    value={formData.rubric}
                    onChange={(e) => setFormData({ ...formData, rubric: e.target.value })}
                    placeholder="The response should be accurate, concise, and helpful..."
                    className="input min-h-[100px] resize-y"
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingGrader(null);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button onClick={saveGrader} className="btn-primary">
                  {editingGrader ? 'Save' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close presets dropdown */}
      {showPresets && <div className="fixed inset-0 z-40" onClick={() => setShowPresets(false)} />}
    </div>
  );
}
