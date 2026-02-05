'use client';

import { useState, useEffect, useCallback } from 'react';
import { Play, Check, X, Loader2 } from 'lucide-react';
import { datasetsApi, gradersApi, experimentsApi } from '@/lib/api';
import type { Dataset, Grader, Experiment, ExperimentProgress } from '@/lib/types';

export default function ExperimentsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [graders, setGraders] = useState<Grader[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [selectedGraders, setSelectedGraders] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  // Results view
  const [activeExperiment, setActiveExperiment] = useState<Experiment | null>(null);
  const [activeDataset, setActiveDataset] = useState<Dataset | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [datasetsData, gradersData, experimentsData] = await Promise.all([
        datasetsApi.list(),
        gradersApi.list(),
        experimentsApi.list(),
      ]);
      setDatasets(datasetsData);
      setGraders(gradersData);
      setExperiments(experimentsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  const toggleGrader = useCallback((graderId: string) => {
    setSelectedGraders((prev) =>
      prev.includes(graderId)
        ? prev.filter((id) => id !== graderId)
        : [...prev, graderId]
    );
  }, []);

  async function runExperiment() {
    if (!selectedDataset || selectedGraders.length === 0) return;

    setIsRunning(true);
    setProgress(null);

    try {
      const experiment = await experimentsApi.create({
        datasetId: selectedDataset,
        graderIds: selectedGraders,
      });

      // Connect to SSE stream for progress
      const eventSource = experimentsApi.streamProgress(experiment.id);

      eventSource.onmessage = (event) => {
        const data: ExperimentProgress = JSON.parse(event.data);

        if (data.type === 'progress' || data.type === 'result') {
          setProgress({ current: data.current || 0, total: data.total || 1 });
        }

        if (data.type === 'complete') {
          eventSource.close();
          setIsRunning(false);
          setProgress(null);
          loadData();
          viewExperiment(experiment.id);
        }

        if (data.type === 'error') {
          console.error('Experiment error:', data.error);
          eventSource.close();
          setIsRunning(false);
          setProgress(null);
          loadData();
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setIsRunning(false);
        setProgress(null);
        loadData();
      };
    } catch (error) {
      console.error('Failed to run experiment:', error);
      setIsRunning(false);
    }
  }

  async function viewExperiment(experimentId: string) {
    try {
      const experiment = await experimentsApi.get(experimentId);
      setActiveExperiment(experiment);

      // Load the dataset for this experiment
      const dataset = await datasetsApi.get(experiment.datasetId);
      setActiveDataset(dataset);
    } catch (error) {
      console.error('Failed to load experiment:', error);
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
      <div>
        <h1 className="text-2xl font-semibold">Experiments</h1>
        <p className="text-muted-foreground mt-1">
          Run graders against datasets and view results
        </p>
      </div>

      {/* Run Form */}
      <div className="card p-6 space-y-4">
        <h2 className="font-medium">Run New Experiment</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium block mb-2">Dataset</label>
            {datasets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No datasets available. Create one first.
              </p>
            ) : (
              <select
                value={selectedDataset}
                onChange={(e) => setSelectedDataset(e.target.value)}
                className="input"
                disabled={isRunning}
              >
                <option value="">Select a dataset...</option>
                {datasets.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name} ({ds.testCaseCount || 0} cases)
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">Graders</label>
            {graders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No graders available. Create one first.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {graders.map((grader) => (
                  <button
                    key={grader.id}
                    onClick={() => toggleGrader(grader.id)}
                    disabled={isRunning}
                    className={`
                      px-3 py-1.5 text-sm rounded-md border transition-colors
                      ${
                        selectedGraders.includes(grader.id)
                          ? 'bg-foreground text-background border-foreground'
                          : 'border-border hover:border-foreground/50'
                      }
                      ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {grader.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={runExperiment}
            disabled={!selectedDataset || selectedGraders.length === 0 || isRunning}
            className="btn-primary"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Experiment
              </>
            )}
          </button>

          {progress && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-foreground transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              {progress.current} / {progress.total}
            </div>
          )}
        </div>
      </div>

      {/* Results View */}
      {activeExperiment && activeDataset && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-medium">
              Results: {activeExperiment.name || 'Experiment'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Dataset: {activeDataset.name} · Status: {activeExperiment.status}
            </p>
          </div>

          {activeExperiment.results && activeExperiment.results.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Input</th>
                    {activeExperiment.graderIds.map((graderId) => {
                      const grader = graders.find((g) => g.id === graderId);
                      return <th key={graderId}>{grader?.name || graderId}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {activeDataset.testCases?.map((tc) => (
                    <tr key={tc.id}>
                      <td className="font-mono text-sm max-w-[200px] truncate">
                        {tc.input}
                      </td>
                      {activeExperiment.graderIds.map((graderId) => {
                        const result = activeExperiment.results?.find(
                          (r) => r.testCaseId === tc.id && r.graderId === graderId
                        );

                        if (!result) {
                          return <td key={graderId}>—</td>;
                        }

                        return (
                          <td key={graderId}>
                            <div className="group relative">
                              <span
                                className={`badge ${result.pass ? 'badge-pass' : 'badge-fail'}`}
                              >
                                {result.pass ? (
                                  <Check className="h-3 w-3 mr-1" />
                                ) : (
                                  <X className="h-3 w-3 mr-1" />
                                )}
                                {result.pass ? 'Pass' : 'Fail'}
                              </span>

                              {/* Tooltip with reason */}
                              <div className="absolute hidden group-hover:block z-10 bottom-full left-0 mb-2 w-64 p-2 bg-card border border-border rounded-md shadow-lg text-xs">
                                <p className="font-medium mb-1">
                                  Score: {((result.score || 0) * 100).toFixed(0)}%
                                </p>
                                <p className="text-muted-foreground">{result.reason}</p>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              No results yet
            </div>
          )}
        </div>
      )}

      {/* Past Experiments */}
      {experiments.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-medium">Past Experiments</h2>
          <div className="grid gap-2">
            {experiments.slice(0, 10).map((exp) => {
              const dataset = datasets.find((d) => d.id === exp.datasetId);
              return (
                <button
                  key={exp.id}
                  onClick={() => viewExperiment(exp.id)}
                  className={`
                    card p-3 text-left hover:bg-muted/50 transition-colors
                    ${activeExperiment?.id === exp.id ? 'ring-2 ring-foreground' : ''}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{exp.name || 'Experiment'}</p>
                      <p className="text-sm text-muted-foreground">
                        {dataset?.name || 'Unknown dataset'} ·{' '}
                        {exp.graderIds.length} grader(s)
                      </p>
                    </div>
                    <span
                      className={`badge ${
                        exp.status === 'completed'
                          ? 'bg-success/20 text-success'
                          : exp.status === 'failed'
                          ? 'bg-error/20 text-error'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {exp.status}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
