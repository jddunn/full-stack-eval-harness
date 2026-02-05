'use client';

import { useState, useEffect, use } from 'react';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import Link from 'next/link';
import { datasetsApi } from '@/lib/api';
import type { Dataset, TestCase } from '@/lib/types';

interface EditingCase {
  id: string;
  input: string;
  expectedOutput: string;
  context: string;
}

export default function DatasetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCase, setEditingCase] = useState<EditingCase | null>(null);
  const [newCase, setNewCase] = useState({ input: '', expectedOutput: '', context: '' });
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadDataset();
  }, [id]);

  async function loadDataset() {
    try {
      const data = await datasetsApi.get(id);
      setDataset(data);
    } catch (error) {
      console.error('Failed to load dataset:', error);
    } finally {
      setLoading(false);
    }
  }

  async function addTestCase() {
    if (!newCase.input.trim()) return;

    try {
      await datasetsApi.addTestCase(id, {
        input: newCase.input.trim(),
        expectedOutput: newCase.expectedOutput.trim() || undefined,
        context: newCase.context.trim() || undefined,
      });
      setNewCase({ input: '', expectedOutput: '', context: '' });
      setShowAddForm(false);
      loadDataset();
    } catch (error) {
      console.error('Failed to add test case:', error);
    }
  }

  async function updateTestCase(caseId: string) {
    if (!editingCase) return;

    try {
      await datasetsApi.updateTestCase(id, caseId, {
        input: editingCase.input.trim(),
        expectedOutput: editingCase.expectedOutput.trim() || undefined,
        context: editingCase.context.trim() || undefined,
      });
      setEditingCase(null);
      loadDataset();
    } catch (error) {
      console.error('Failed to update test case:', error);
    }
  }

  async function deleteTestCase(caseId: string) {
    if (!confirm('Delete this test case?')) return;

    try {
      await datasetsApi.deleteTestCase(id, caseId);
      loadDataset();
    } catch (error) {
      console.error('Failed to delete test case:', error);
    }
  }

  function startEditing(testCase: TestCase) {
    setEditingCase({
      id: testCase.id,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput || '',
      context: testCase.context || '',
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Dataset not found</p>
        <Link href="/datasets" className="btn-secondary mt-4">
          Back to datasets
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/datasets" className="btn-ghost p-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{dataset.name}</h1>
          {dataset.description && (
            <p className="text-muted-foreground">{dataset.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {dataset.testCases?.length || 0} test cases
        </p>
        <button onClick={() => setShowAddForm(true)} className="btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          Add Test Case
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="card p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium block mb-1">Input</label>
              <textarea
                value={newCase.input}
                onChange={(e) => setNewCase({ ...newCase, input: e.target.value })}
                placeholder="What is 2+2?"
                className="input min-h-[80px] resize-y"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Expected Output</label>
              <textarea
                value={newCase.expectedOutput}
                onChange={(e) => setNewCase({ ...newCase, expectedOutput: e.target.value })}
                placeholder="4"
                className="input min-h-[80px] resize-y"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Context (for faithfulness)</label>
              <textarea
                value={newCase.context}
                onChange={(e) => setNewCase({ ...newCase, context: e.target.value })}
                placeholder="Optional context..."
                className="input min-h-[80px] resize-y"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAddForm(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={addTestCase} className="btn-primary">
              Add
            </button>
          </div>
        </div>
      )}

      {/* Test Cases Table */}
      {dataset.testCases && dataset.testCases.length > 0 ? (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th className="w-1/3">Input</th>
                <th className="w-1/3">Expected Output</th>
                <th className="w-1/4">Context</th>
                <th className="w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dataset.testCases.map((tc) => (
                <tr key={tc.id}>
                  {editingCase?.id === tc.id ? (
                    <>
                      <td>
                        <textarea
                          value={editingCase.input}
                          onChange={(e) =>
                            setEditingCase({ ...editingCase, input: e.target.value })
                          }
                          className="input min-h-[60px] resize-y text-sm"
                        />
                      </td>
                      <td>
                        <textarea
                          value={editingCase.expectedOutput}
                          onChange={(e) =>
                            setEditingCase({ ...editingCase, expectedOutput: e.target.value })
                          }
                          className="input min-h-[60px] resize-y text-sm"
                        />
                      </td>
                      <td>
                        <textarea
                          value={editingCase.context}
                          onChange={(e) =>
                            setEditingCase({ ...editingCase, context: e.target.value })
                          }
                          className="input min-h-[60px] resize-y text-sm"
                        />
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            onClick={() => updateTestCase(tc.id)}
                            className="btn-ghost p-2 text-success"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingCase(null)}
                            className="btn-ghost p-2 text-muted-foreground"
                          >
                            &times;
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td
                        onClick={() => startEditing(tc)}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <pre className="text-sm whitespace-pre-wrap font-mono">
                          {tc.input}
                        </pre>
                      </td>
                      <td
                        onClick={() => startEditing(tc)}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground">
                          {tc.expectedOutput || '—'}
                        </pre>
                      </td>
                      <td
                        onClick={() => startEditing(tc)}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground truncate max-w-[200px]">
                          {tc.context || '—'}
                        </pre>
                      </td>
                      <td>
                        <button
                          onClick={() => deleteTestCase(tc.id)}
                          className="btn-ghost p-2 text-muted-foreground hover:text-error"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-12 text-center">
          <p className="text-muted-foreground">No test cases yet</p>
          <button onClick={() => setShowAddForm(true)} className="btn-secondary mt-4">
            Add your first test case
          </button>
        </div>
      )}
    </div>
  );
}
