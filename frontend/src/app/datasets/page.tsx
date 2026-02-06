'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronRight, RefreshCw, Upload, Info, ChevronDown, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { datasetsApi, presetsApi } from '@/lib/api';
import { useToast } from '@/components/Toast';
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
  const { toast } = useToast();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showSyntheticModal, setShowSyntheticModal] = useState(false);
  const [generatingSynthetic, setGeneratingSynthetic] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [syntheticForm, setSyntheticForm] = useState({
    name: '',
    topic: '',
    count: 5,
    style: 'qa' as 'qa' | 'classification' | 'extraction' | 'rag',
    customInstructions: '',
  });

  useEffect(() => {
    loadDatasets();
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

  async function reloadFromDisk() {
    setReloading(true);
    try {
      const result = await datasetsApi.reload();
      await loadDatasets();
      toast(`Reloaded ${result.loaded} datasets from disk`, 'success');
    } catch (error) {
      console.error('Failed to reload:', error);
    } finally {
      setReloading(false);
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const csv = await file.text();
      const filename = file.name.replace(/\.csv$/, '');
      await datasetsApi.importCsv({ filename, csv });
      await loadDatasets();
    } catch (error) {
      console.error('Failed to import CSV:', error);
      toast('Failed to import CSV. Check the file format.', 'error');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
      toast('Failed to generate. Check LLM configuration.', 'error');
    } finally {
      setGeneratingSynthetic(false);
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
            CSV files loaded from <code className="text-xs">backend/datasets/</code>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reloadFromDisk}
            disabled={reloading}
            className="btn-secondary"
            title="Re-read all CSV files from disk"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${reloading ? 'animate-spin' : ''}`} />
            {reloading ? 'Reloading...' : 'Reload from Disk'}
          </button>
          <button
            onClick={() => setShowSyntheticModal(true)}
            className="btn-secondary"
            title="Use AI to generate test cases and save as CSV"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Generate
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary"
            title="Upload a CSV file to the datasets directory"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Expandable guide */}
      <button
        onClick={() => setShowGuide(!showGuide)}
        className="w-full text-left px-4 py-3 card flex items-center justify-between text-sm hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <Info className="h-4 w-4" />
          How datasets work
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showGuide ? 'rotate-180' : ''}`} />
      </button>
      {showGuide && (
        <div className="card p-5 space-y-3 text-sm text-muted-foreground">
          <p>
            Datasets are <strong className="text-foreground">CSV files</strong> in <code>backend/datasets/</code>.
            Each CSV has columns: <code>input</code>, <code>expected_output</code>, <code>context</code>, <code>metadata</code>.
          </p>
          <p>
            <strong className="text-foreground">To add a dataset:</strong> Place a <code>.csv</code> file in the datasets directory
            and click &ldquo;Reload from Disk&rdquo;, or use &ldquo;Upload CSV&rdquo; to import directly.
          </p>
          <p>
            An optional <code>.meta.json</code> sidecar provides the dataset name and description.
            Without it, the name is derived from the filename.
          </p>
          <p>
            <strong className="text-foreground">Generate</strong> uses AI to create test cases and saves them as a new CSV file.
          </p>
        </div>
      )}

      {datasets.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-muted-foreground">No datasets found</p>
          <p className="text-sm text-muted-foreground mt-2">
            Add CSV files to <code>backend/datasets/</code> and reload, or upload a CSV.
          </p>
          <div className="flex gap-2 justify-center mt-4">
            <button onClick={reloadFromDisk} className="btn-secondary">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload from Disk
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
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
                    <code className="text-[11px]">{dataset.filePath || `${dataset.id}.csv`}</code>
                    {' · '}
                    {dataset.testCaseCount || 0} test cases
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
              </Link>
            </div>
          ))}
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
              Use AI to generate test cases and save as a CSV file.
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
                  placeholder="Physics Questions"
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
    </div>
  );
}
