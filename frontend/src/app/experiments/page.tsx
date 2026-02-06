'use client';

import { useState, useEffect, useCallback } from 'react';
import { Play, Check, X, Loader2, Bot, Info, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { datasetsApi, gradersApi, promptsApi, experimentsApi } from '@/lib/api';
import type { Dataset, Grader, Candidate, Experiment, ExperimentProgress, ExperimentStats } from '@/lib/types';

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

export default function ExperimentsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [graders, setGraders] = useState<Grader[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [selectedGraders, setSelectedGraders] = useState<string[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // Results view
  const [activeExperiment, setActiveExperiment] = useState<Experiment | null>(null);
  const [activeDataset, setActiveDataset] = useState<Dataset | null>(null);
  const [activeStats, setActiveStats] = useState<ExperimentStats | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [datasetsData, gradersData, candidatesData, experimentsData] = await Promise.all([
        datasetsApi.list(),
        gradersApi.list(),
        promptsApi.list(),
        experimentsApi.list(),
      ]);
      setDatasets(datasetsData);
      setGraders(gradersData);
      setCandidates(candidatesData);
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

  const toggleCandidate = useCallback((candidateId: string) => {
    setSelectedCandidates((prev) =>
      prev.includes(candidateId)
        ? prev.filter((id) => id !== candidateId)
        : [...prev, candidateId]
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
        candidateIds: selectedCandidates.length > 0 ? selectedCandidates : undefined,
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

        if (data.type === 'error' && !data.testCaseId) {
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
      const [experiment, stats] = await Promise.all([
        experimentsApi.get(experimentId),
        experimentsApi.getStats(experimentId),
      ]);
      setActiveExperiment(experiment);
      setActiveStats(stats);

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

  // Determine if active experiment has candidates
  const hasCandidates = !!(
    activeExperiment?.candidateIds && activeExperiment.candidateIds.length > 0
  );
  const sortedCandidateStats = activeStats?.candidateStats
    ? [...activeStats.candidateStats].sort(
        (a, b) =>
          (b.weightedScore ?? b.avgScore) - (a.weightedScore ?? a.avgScore)
      )
    : [];
  const bestCandidateId = sortedCandidateStats[0]?.candidateId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Experiments</h1>
        <p className="text-muted-foreground mt-1">
          Run candidates and graders against datasets
        </p>
      </div>

      {/* Expandable walkthrough */}
      <button
        onClick={() => setShowGuide(!showGuide)}
        className="w-full text-left px-4 py-3 card flex items-center justify-between text-sm hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <Info className="h-4 w-4" />
          Quick start guide
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showGuide ? 'rotate-180' : ''}`} />
      </button>
      {showGuide && (
        <div className="card p-5 space-y-3 text-sm text-muted-foreground">
          <p className="text-foreground font-medium">Run your first experiment in 4 steps:</p>
          <ol className="list-decimal ml-5 space-y-2">
            <li>
              <strong className="text-foreground">Load a dataset</strong> — Go to{' '}
              <Link href="/datasets" className="underline hover:text-foreground">Datasets</Link>{' '}
              and choose one of the loaded CSV datasets (or upload your own CSV).
            </li>
            <li>
              <strong className="text-foreground">Choose graders</strong> — Go to{' '}
              <Link href="/graders" className="underline hover:text-foreground">Graders</Link>{' '}
              to create/edit grader definitions, then select one or more graders here.
            </li>
            <li>
              <strong className="text-foreground">Select candidates</strong> (optional) — Go to{' '}
              <Link href="/candidates" className="underline hover:text-foreground">Candidates</Link>{' '}
              to review prompt files. Each candidate is a prompt configuration (system prompt + template + model settings).
              Without candidates, graders evaluate the expected output directly (useful for testing grader behavior).
            </li>
            <li>
              <strong className="text-foreground">Run the experiment</strong> — Select your dataset, toggle graders,
              optionally select candidates below, and click <strong>Run Experiment</strong>. Results stream in real-time
              with pass/fail badges. Hover over any result for the score, reason, and generated output.
            </li>
          </ol>
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-foreground font-medium">Suggested first experiments:</p>
            <ul className="list-disc ml-5 space-y-1 text-xs">
              <li><strong>Extraction quality:</strong> Research Paper Extraction dataset + Strict JSON Extractor + Loose JSON Extractor candidates + Paper Extraction Schema + Extraction Completeness Judge graders.</li>
              <li><strong>Grounding check:</strong> Q&amp;A with Context dataset + analyst-full candidate + Faithfulness (Strict) grader.</li>
              <li><strong>Prompt comparison:</strong> Same dataset/graders, two candidate prompts. Compare pass rates side-by-side.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Run Form */}
      <div className="card p-6 space-y-4">
        <h2 className="font-medium">Run New Experiment</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium block mb-2 flex items-center gap-2">
              Dataset
              <Tooltip text="The test cases to evaluate. Each has input, expected output, and optional context." />
            </label>
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
            <label className="text-sm font-medium block mb-2 flex items-center gap-2">
              Graders
              <Tooltip text="How to score outputs. Toggle one or more. Each grader runs independently on every test case." />
            </label>
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

        {/* Candidate selection */}
        {candidates.length > 0 && (
          <div>
            <label className="text-sm font-medium block mb-2 flex items-center gap-2">
              Candidates
              <span className="text-muted-foreground font-normal">(optional)</span>
              <Tooltip text="Select candidates to generate outputs. Without candidates, graders evaluate the expected output directly." />
            </label>
            <div className="flex flex-wrap gap-2">
              {candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  onClick={() => toggleCandidate(candidate.id)}
                  disabled={isRunning}
                  className={`
                    px-3 py-1.5 text-sm rounded-md border transition-colors flex items-center gap-1.5
                    ${
                      selectedCandidates.includes(candidate.id)
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-border hover:border-foreground/50'
                    }
                    ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <Bot className="h-3 w-3" />
                  {candidate.name}
                </button>
              ))}
            </div>
            {selectedCandidates.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Without candidates, graders evaluate expectedOutput directly
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={runExperiment}
            disabled={!selectedDataset || selectedGraders.length === 0 || isRunning}
            className="btn-primary"
            title="Run all test cases through selected candidates and grade the outputs"
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
              {hasCandidates && ` · ${activeExperiment.candidateIds!.length} candidate(s)`}
            </p>
          </div>

          {/* Candidate score summary */}
          {hasCandidates && sortedCandidateStats.length > 0 && (
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex flex-wrap gap-4">
                {sortedCandidateStats.map((cs) => {
                  const candidate = candidates.find((c) => c.id === cs.candidateId);
                  const hasWeighted = cs.weightedScore != null && Math.abs((cs.weightedScore ?? 0) - cs.avgScore) > 0.001;
                  return (
                    <div key={cs.candidateId} className="text-sm">
                      <span className="font-medium">{candidate?.name || cs.candidateId}</span>
                      {cs.candidateId === bestCandidateId && (
                        <span className="ml-2 badge badge-pass">Best</span>
                      )}
                      <span className="text-muted-foreground ml-2">
                        Avg: {(cs.avgScore * 100).toFixed(0)}%
                      </span>
                      {hasWeighted && (
                        <span className="ml-2 text-foreground" title="Weighted score using the prompt's grader weight configuration">
                          Weighted: {((cs.weightedScore ?? 0) * 100).toFixed(0)}%
                        </span>
                      )}
                      <span className="text-muted-foreground ml-2">
                        ({cs.passed}/{cs.total} passed)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeExperiment.results && activeExperiment.results.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Input</th>
                    {hasCandidates ? (
                      // Multi-candidate: columns grouped by candidate, sub-columns by grader
                      activeExperiment.candidateIds!.map((candidateId) => {
                        const candidate = candidates.find((c) => c.id === candidateId);
                        return activeExperiment.graderIds.map((graderId) => {
                          const grader = graders.find((g) => g.id === graderId);
                          return (
                            <th key={`${candidateId}-${graderId}`}>
                              <div className="text-xs">
                                <div className="font-medium">{candidate?.name || candidateId.slice(0, 8)}</div>
                                <div className="text-muted-foreground font-normal">{grader?.name || graderId.slice(0, 8)}</div>
                              </div>
                            </th>
                          );
                        });
                      })
                    ) : (
                      // Legacy: single column per grader
                      activeExperiment.graderIds.map((graderId) => {
                        const grader = graders.find((g) => g.id === graderId);
                        return <th key={graderId}>{grader?.name || graderId}</th>;
                      })
                    )}
                  </tr>
                </thead>
                <tbody>
                  {activeDataset.testCases?.map((tc) => (
                    <tr key={tc.id}>
                      <td className="font-mono text-sm max-w-[200px] truncate">
                        {tc.input}
                      </td>
                      {hasCandidates
                        ? activeExperiment.candidateIds!.map((candidateId) =>
                            activeExperiment.graderIds.map((graderId) => {
                              const result = activeExperiment.results?.find(
                                (r) =>
                                  r.testCaseId === tc.id &&
                                  r.graderId === graderId &&
                                  r.candidateId === candidateId
                              );
                              return (
                                <td key={`${candidateId}-${graderId}`}>
                                  {result ? (
                                    <ResultCell result={result} />
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </td>
                              );
                            })
                          )
                        : activeExperiment.graderIds.map((graderId) => {
                            const result = activeExperiment.results?.find(
                              (r) => r.testCaseId === tc.id && r.graderId === graderId
                            );
                            return (
                              <td key={graderId}>
                                {result ? (
                                  <ResultCell result={result} />
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
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
              const hasCands = exp.candidateIds && exp.candidateIds.length > 0;
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
                        {hasCands && ` · ${exp.candidateIds!.length} candidate(s)`}
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

function ResultCell({ result }: { result: { pass: boolean; score?: number; reason?: string; generatedOutput?: string; latencyMs?: number } }) {
  return (
    <div className="group relative">
      <span className={`badge ${result.pass ? 'badge-pass' : 'badge-fail'}`}>
        {result.pass ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
        {result.pass ? 'Pass' : 'Fail'}
      </span>

      <div className="absolute hidden group-hover:block z-10 bottom-full left-0 mb-2 w-72 p-2 bg-card border border-border rounded-md shadow-lg text-xs">
        <p className="font-medium mb-1">
          Score: {((result.score || 0) * 100).toFixed(0)}%
          {result.latencyMs !== undefined && (
            <span className="text-muted-foreground ml-2">{result.latencyMs}ms</span>
          )}
        </p>
        <p className="text-muted-foreground">{result.reason}</p>
        {result.generatedOutput && (
          <div className="mt-2 pt-2 border-t border-border">
            <p className="font-medium mb-0.5">Generated Output:</p>
            <p className="text-muted-foreground font-mono whitespace-pre-wrap">
              {result.generatedOutput.substring(0, 200)}
              {result.generatedOutput.length > 200 && '...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
