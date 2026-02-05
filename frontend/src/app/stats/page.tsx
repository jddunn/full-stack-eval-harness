'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, CheckCircle, XCircle, Loader2, Download } from 'lucide-react';
import { experimentsApi, datasetsApi } from '@/lib/api';
import type { Experiment, ExperimentStats } from '@/lib/types';

interface ExperimentWithStats extends Experiment {
  stats?: ExperimentStats;
}

export default function StatsPage() {
  const [experiments, setExperiments] = useState<ExperimentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExperiment, setSelectedExperiment] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const exps = await experimentsApi.list();

      // Load stats for completed experiments
      const expsWithStats = await Promise.all(
        exps.map(async (exp) => {
          if (exp.status === 'completed') {
            try {
              const stats = await experimentsApi.getStats(exp.id);
              return { ...exp, stats };
            } catch {
              return exp;
            }
          }
          return exp;
        }),
      );

      setExperiments(expsWithStats);
      if (expsWithStats.length > 0 && expsWithStats[0].status === 'completed') {
        setSelectedExperiment(expsWithStats[0].id);
      }
    } catch (err) {
      console.error('Failed to load experiments:', err);
    } finally {
      setLoading(false);
    }
  }

  const selectedExp = experiments.find((e) => e.id === selectedExperiment);
  const completedExperiments = experiments.filter((e) => e.status === 'completed');

  // Aggregate stats across all experiments
  const aggregateStats = {
    totalExperiments: completedExperiments.length,
    totalEvaluations: completedExperiments.reduce((sum, e) => sum + (e.stats?.totalTests || 0), 0),
    overallPassRate:
      completedExperiments.length > 0
        ? completedExperiments.reduce((sum, e) => sum + (e.stats?.passRate || 0), 0) /
          completedExperiments.length
        : 0,
    totalPassed: completedExperiments.reduce((sum, e) => sum + (e.stats?.passed || 0), 0),
    totalFailed: completedExperiments.reduce((sum, e) => sum + (e.stats?.failed || 0), 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="section-title flex items-center gap-3">
          <BarChart3 className="h-8 w-8" />
          Stats Dashboard
        </h1>
        <p className="section-subtitle">
          Aggregate statistics and performance metrics across experiments.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="card p-6">
          <div className="text-sm text-muted-foreground uppercase tracking-wide">Experiments</div>
          <div className="text-3xl font-bold mt-2">{aggregateStats.totalExperiments}</div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-muted-foreground uppercase tracking-wide">Evaluations</div>
          <div className="text-3xl font-bold mt-2">{aggregateStats.totalEvaluations}</div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-[hsl(var(--success))]" />
            Passed
          </div>
          <div className="text-3xl font-bold mt-2 text-[hsl(var(--success))]">
            {aggregateStats.totalPassed}
          </div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <XCircle className="h-4 w-4 text-[hsl(var(--error))]" />
            Failed
          </div>
          <div className="text-3xl font-bold mt-2 text-[hsl(var(--error))]">
            {aggregateStats.totalFailed}
          </div>
        </div>
      </div>

      {/* Overall Pass Rate */}
      <div className="card p-6">
        <h2 className="text-lg font-bold uppercase tracking-wide mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Overall Pass Rate
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="progress-bar h-6">
              <div
                className="progress-fill bg-[hsl(var(--success))]"
                style={{ width: `${aggregateStats.overallPassRate * 100}%` }}
              />
            </div>
          </div>
          <div className="text-2xl font-bold w-20 text-right">
            {(aggregateStats.overallPassRate * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Experiment Selector */}
      {completedExperiments.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-bold uppercase tracking-wide mb-4">
            Experiment Details
          </h2>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Select Experiment</label>
            <select
              className="input"
              value={selectedExperiment || ''}
              onChange={(e) => setSelectedExperiment(e.target.value)}
            >
              {completedExperiments.map((exp) => (
                <option key={exp.id} value={exp.id}>
                  {exp.name} ({new Date(exp.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          {selectedExp?.stats && (
            <div className="space-y-6">
              {/* Experiment Summary */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="card-inset p-4">
                  <div className="text-sm text-muted-foreground">Total Tests</div>
                  <div className="text-2xl font-bold">{selectedExp.stats.totalTests}</div>
                </div>
                <div className="card-inset p-4">
                  <div className="text-sm text-muted-foreground">Pass Rate</div>
                  <div className="text-2xl font-bold">
                    {(selectedExp.stats.passRate * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="card-inset p-4">
                  <div className="text-sm text-muted-foreground">Graders Used</div>
                  <div className="text-2xl font-bold">{selectedExp.stats.totalGraders}</div>
                </div>
              </div>

              {/* Per-Grader Stats */}
              {selectedExp.stats.graderStats && selectedExp.stats.graderStats.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide mb-4">
                    Per-Grader Performance
                  </h3>
                  <div className="space-y-4">
                    {selectedExp.stats.graderStats.map((graderStat: any) => (
                      <div key={graderStat.graderId} className="card-flat p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{graderStat.graderId}</span>
                          <span className="text-sm text-muted-foreground">
                            {graderStat.passed}/{graderStat.total} passed
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="progress-bar h-3">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${graderStat.passRate * 100}%`,
                                  background:
                                    graderStat.passRate >= 0.8
                                      ? 'hsl(var(--success))'
                                      : graderStat.passRate >= 0.5
                                        ? 'hsl(var(--foreground))'
                                        : 'hsl(var(--error))',
                                }}
                              />
                            </div>
                          </div>
                          <div className="text-sm font-medium w-16 text-right">
                            {(graderStat.passRate * 100).toFixed(1)}%
                          </div>
                        </div>
                        {graderStat.avgScore !== undefined && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Avg Score: {graderStat.avgScore.toFixed(3)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Export Buttons */}
              <div className="flex gap-4">
                <a
                  href={experimentsApi.exportJsonUrl(selectedExp.id)}
                  className="btn-secondary"
                  download
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </a>
                <a
                  href={experimentsApi.exportCsvUrl(selectedExp.id)}
                  className="btn-secondary"
                  download
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Experiment History Chart */}
      {completedExperiments.length > 1 && (
        <div className="card p-6">
          <h2 className="text-lg font-bold uppercase tracking-wide mb-4">
            Pass Rate History
          </h2>
          <div className="flex items-end gap-2 h-40">
            {completedExperiments.slice(-10).map((exp) => {
              const passRate = exp.stats?.passRate || 0;
              return (
                <div
                  key={exp.id}
                  className="flex-1 flex flex-col items-center gap-2"
                  title={`${exp.name}: ${(passRate * 100).toFixed(1)}%`}
                >
                  <div
                    className="w-full transition-all"
                    style={{
                      height: `${passRate * 100}%`,
                      minHeight: '4px',
                      background:
                        passRate >= 0.8
                          ? 'hsl(var(--success))'
                          : passRate >= 0.5
                            ? 'hsl(var(--foreground))'
                            : 'hsl(var(--error))',
                    }}
                  />
                  <span className="text-xs text-muted-foreground truncate w-full text-center">
                    {new Date(exp.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {completedExperiments.length === 0 && (
        <div className="empty-state">
          <BarChart3 className="empty-state-icon" />
          <p className="text-muted-foreground">No completed experiments yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Run some experiments to see statistics here
          </p>
        </div>
      )}
    </div>
  );
}
