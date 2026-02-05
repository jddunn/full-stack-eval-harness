'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronRight, Sparkles, Wand2, Info } from 'lucide-react';
import Link from 'next/link';
import { datasetsApi, presetsApi, type DatasetPreset } from '@/lib/api';
import type { Dataset } from '@/lib/types';

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

const SYNTHETIC_STYLES = [
  { value: 'qa', label: 'Q&A', description: 'Question-answer pairs' },
  { value: 'classification', label: 'Classification', description: 'Text with category labels' },
  { value: 'extraction', label: 'Extraction', description: 'Text with extracted data' },
  { value: 'rag', label: 'RAG', description: 'Questions with context documents' },
] as const;

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [presets, setPresets] = useState<DatasetPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showSyntheticModal, setShowSyntheticModal] = useState(false);
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null);
  const [generatingSynthetic, setGeneratingSynthetic] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Synthetic form state
  const [syntheticForm, setSyntheticForm] = useState({
    name: '',
    topic: '',
    count: 5,
    style: 'qa' as 'qa' | 'classification' | 'extraction' | 'rag',
    customInstructions: '',
  });

  useEffect(() => {
    loadDatasets();
    loadPresets();
  }, []);

  async function loadDatasets() {
    try {
      const data = await datasetsApi.list();
      setDatasets(data);
    } catch (error) {
      console.error('Failed to load datasets:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPresets() {
    try {
      const data = await presetsApi.getDatasetPresets();
      setPresets(data);
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  }

  async function loadPreset(preset: DatasetPreset) {
    setLoadingPreset(preset.id);
    try {
      await presetsApi.loadDatasetPreset(preset.id);
      await loadDatasets();
      setShowPresets(false);
    } catch (error) {
      console.error('Failed to load preset:', error);
    } finally {
      setLoadingPreset(null);
    }
  }

  async function createDataset() {
    if (!newName.trim()) return;

    try {
      await datasetsApi.create({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      });
      setNewName('');
      setNewDescription('');
      setShowCreateModal(false);
      loadDatasets();
    } catch (error) {
      console.error('Failed to create dataset:', error);
    }
  }

  async function generateSyntheticDataset() {
    if (!syntheticForm.name.trim() || !syntheticForm.topic.trim()) return;

    setGeneratingSynthetic(true);
    try {
      await presetsApi.generateSyntheticDataset({
        name: syntheticForm.name.trim(),
        topic: syntheticForm.topic.trim(),
        count: syntheticForm.count,
        style: syntheticForm.style,
        customInstructions: syntheticForm.customInstructions.trim() || undefined,
      });
      setSyntheticForm({
        name: '',
        topic: '',
        count: 5,
        style: 'qa',
        customInstructions: '',
      });
      setShowSyntheticModal(false);
      loadDatasets();
    } catch (error) {
      console.error('Failed to generate synthetic dataset:', error);
      alert('Failed to generate. Check LLM configuration.');
    } finally {
      setGeneratingSynthetic(false);
    }
  }

  async function deleteDataset(id: string) {
    if (!confirm('Delete this dataset and all its test cases?')) return;

    try {
      await datasetsApi.delete(id);
      loadDatasets();
    } catch (error) {
      console.error('Failed to delete dataset:', error);
    }
  }

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
          <h1 className="text-2xl font-semibold">Datasets</h1>
          <p className="text-muted-foreground mt-1">
            Manage your test case collections
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="btn-secondary"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Load Preset
            </button>

            {showPresets && (
              <div className="absolute right-0 mt-2 w-72 card p-2 z-50 shadow-xl">
                <div className="text-xs text-muted-foreground px-2 py-1 mb-1">
                  Quick-load sample datasets
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
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {preset.description} ({preset.testCases.length} cases)
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowSyntheticModal(true)}
            className="btn-secondary"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Generate
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            New Dataset
          </button>
        </div>
      </div>

      {datasets.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-muted-foreground">No datasets yet</p>
          <div className="flex gap-2 justify-center mt-4">
            <button onClick={() => setShowPresets(true)} className="btn-secondary">
              <Sparkles className="h-4 w-4 mr-2" />
              Load a preset
            </button>
            <button onClick={() => setShowSyntheticModal(true)} className="btn-secondary">
              <Wand2 className="h-4 w-4 mr-2" />
              Generate with AI
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-secondary"
            >
              Create empty
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {datasets.map((dataset) => (
            <div key={dataset.id} className="card p-4 flex items-center justify-between">
              <Link
                href={`/datasets/${dataset.id}`}
                className="flex-1 flex items-center gap-4 hover:opacity-80"
              >
                <div>
                  <h3 className="font-medium">{dataset.name}</h3>
                  {dataset.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {dataset.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {dataset.testCaseCount || 0} test cases
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  deleteDataset(dataset.id);
                }}
                className="btn-ghost p-2 text-muted-foreground hover:text-error ml-2"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Create Dataset</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="My Dataset"
                  className="input"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="A collection of test cases for..."
                  className="input"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button onClick={createDataset} className="btn-primary">
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Synthetic Generation Modal */}
      {showSyntheticModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Generate Synthetic Dataset
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Use AI to generate test cases based on your topic and style.
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Dataset Name</label>
                <input
                  type="text"
                  value={syntheticForm.name}
                  onChange={(e) =>
                    setSyntheticForm({ ...syntheticForm, name: e.target.value })
                  }
                  placeholder="Math Questions"
                  className="input"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1 flex items-center gap-2">
                  Topic
                  <Tooltip text="What subject area should the test cases cover?" />
                </label>
                <input
                  type="text"
                  value={syntheticForm.topic}
                  onChange={(e) =>
                    setSyntheticForm({ ...syntheticForm, topic: e.target.value })
                  }
                  placeholder="e.g., Basic arithmetic, Python programming, US History"
                  className="input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1 flex items-center gap-2">
                    Style
                    <Tooltip text="The format of generated test cases" />
                  </label>
                  <select
                    value={syntheticForm.style}
                    onChange={(e) =>
                      setSyntheticForm({
                        ...syntheticForm,
                        style: e.target.value as typeof syntheticForm.style,
                      })
                    }
                    className="input"
                  >
                    {SYNTHETIC_STYLES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1 flex items-center gap-2">
                    Count
                    <Tooltip text="Number of test cases to generate" />
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={syntheticForm.count}
                    onChange={(e) =>
                      setSyntheticForm({
                        ...syntheticForm,
                        count: parseInt(e.target.value) || 5,
                      })
                    }
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">
                  Custom Instructions (optional)
                </label>
                <textarea
                  value={syntheticForm.customInstructions}
                  onChange={(e) =>
                    setSyntheticForm({
                      ...syntheticForm,
                      customInstructions: e.target.value,
                    })
                  }
                  placeholder="e.g., Focus on addition and subtraction only. Keep answers as single numbers."
                  className="input min-h-[80px] resize-y"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowSyntheticModal(false)}
                  className="btn-secondary"
                  disabled={generatingSynthetic}
                >
                  Cancel
                </button>
                <button
                  onClick={generateSyntheticDataset}
                  className="btn-primary"
                  disabled={generatingSynthetic || !syntheticForm.name || !syntheticForm.topic}
                >
                  {generatingSynthetic ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close presets dropdown */}
      {showPresets && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowPresets(false)}
        />
      )}
    </div>
  );
}
