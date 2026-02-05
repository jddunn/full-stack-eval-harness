import type {
  Dataset,
  TestCase,
  Grader,
  GraderType,
  Experiment,
  ExperimentStats,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3021/api';

/**
 * Generic fetch wrapper with error handling.
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `Request failed: ${response.status}`);
  }

  return response.json();
}

// Dataset API
export const datasetsApi = {
  list: () => fetchApi<Dataset[]>('/datasets'),

  get: (id: string) => fetchApi<Dataset>(`/datasets/${id}`),

  create: (data: { name: string; description?: string }) =>
    fetchApi<Dataset>('/datasets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Export URLs (for download links)
  exportJsonUrl: (id: string) => `${API_BASE}/datasets/${id}/export/json`,
  exportCsvUrl: (id: string) => `${API_BASE}/datasets/${id}/export/csv`,

  // Import test cases
  importTestCases: (
    datasetId: string,
    testCases: Array<{ input: string; expectedOutput?: string; context?: string }>,
  ) =>
    fetchApi<{ imported: number; testCases: TestCase[] }>(`/datasets/${datasetId}/import`, {
      method: 'POST',
      body: JSON.stringify({ testCases }),
    }),

  update: (id: string, data: { name?: string; description?: string }) =>
    fetchApi<Dataset>(`/datasets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<{ deleted: boolean }>(`/datasets/${id}`, { method: 'DELETE' }),

  addTestCase: (datasetId: string, data: Omit<TestCase, 'id' | 'datasetId' | 'createdAt'>) =>
    fetchApi<TestCase>(`/datasets/${datasetId}/cases`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTestCase: (
    datasetId: string,
    caseId: string,
    data: Partial<Omit<TestCase, 'id' | 'datasetId' | 'createdAt'>>,
  ) =>
    fetchApi<TestCase>(`/datasets/${datasetId}/cases/${caseId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTestCase: (datasetId: string, caseId: string) =>
    fetchApi<{ deleted: boolean }>(`/datasets/${datasetId}/cases/${caseId}`, {
      method: 'DELETE',
    }),
};

// Grader API
export const gradersApi = {
  list: () => fetchApi<Grader[]>('/graders'),

  get: (id: string) => fetchApi<Grader>(`/graders/${id}`),

  create: (data: {
    name: string;
    description?: string;
    type: GraderType;
    rubric?: string;
    config?: Record<string, unknown>;
  }) =>
    fetchApi<Grader>('/graders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Omit<Grader, 'id' | 'type' | 'createdAt' | 'updatedAt'>>) =>
    fetchApi<Grader>(`/graders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<{ deleted: boolean }>(`/graders/${id}`, { method: 'DELETE' }),
};

// Experiment API
export const experimentsApi = {
  list: () => fetchApi<Experiment[]>('/experiments'),

  get: (id: string) => fetchApi<Experiment>(`/experiments/${id}`),

  create: (data: { name?: string; datasetId: string; graderIds: string[] }) =>
    fetchApi<Experiment>('/experiments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getStats: (id: string) => fetchApi<ExperimentStats>(`/experiments/${id}/stats`),

  // SSE stream for real-time progress
  streamProgress: (id: string) => {
    return new EventSource(`${API_BASE}/experiments/${id}/stream`);
  },

  // Export URLs
  exportJsonUrl: (id: string) => `${API_BASE}/experiments/${id}/export/json`,
  exportCsvUrl: (id: string) => `${API_BASE}/experiments/${id}/export/csv`,
};

// Preset types
export interface GraderPreset {
  id: string;
  name: string;
  description: string;
  type: GraderType;
  rubric?: string;
  config?: Record<string, unknown>;
  tooltip: string;
}

export interface DatasetPreset {
  id: string;
  name: string;
  description: string;
  testCases: Array<{
    input: string;
    expectedOutput: string;
    context?: string;
  }>;
  tooltip: string;
}

// Presets API
export const presetsApi = {
  getGraderPresets: () => fetchApi<GraderPreset[]>('/presets/graders'),

  getDatasetPresets: () => fetchApi<DatasetPreset[]>('/presets/datasets'),

  loadGraderPreset: (id: string) =>
    fetchApi<Grader>(`/presets/graders/${id}/load`, { method: 'POST' }),

  loadDatasetPreset: (id: string) =>
    fetchApi<Dataset>(`/presets/datasets/${id}/load`, { method: 'POST' }),

  seedAll: () =>
    fetchApi<{ graders: Grader[]; datasets: Dataset[] }>('/presets/seed', {
      method: 'POST',
    }),

  generateSynthetic: (data: {
    topic: string;
    count: number;
    style: 'qa' | 'classification' | 'extraction' | 'rag';
    customInstructions?: string;
  }) =>
    fetchApi<Array<{ input: string; expectedOutput: string; context?: string }>>(
      '/presets/synthetic/generate',
      { method: 'POST', body: JSON.stringify(data) },
    ),

  generateSyntheticDataset: (data: {
    name: string;
    description?: string;
    topic: string;
    count: number;
    style: 'qa' | 'classification' | 'extraction' | 'rag';
    customInstructions?: string;
  }) =>
    fetchApi<Dataset>('/presets/synthetic/dataset', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Settings types
export interface LlmSettings {
  provider: 'openai' | 'anthropic' | 'ollama';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AppSettings {
  llm: LlmSettings;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

// Settings API
export const settingsApi = {
  getAll: () => fetchApi<AppSettings>('/settings'),

  getLlmSettings: () => fetchApi<LlmSettings>('/settings/llm'),

  updateLlmSettings: (data: Partial<LlmSettings>) =>
    fetchApi<LlmSettings>('/settings/llm', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  testConnection: () =>
    fetchApi<ConnectionTestResult>('/settings/llm/test', { method: 'POST' }),

  resetToDefaults: () =>
    fetchApi<AppSettings>('/settings/reset', { method: 'POST' }),
};
