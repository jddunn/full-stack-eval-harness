/**
 * Pre-built grader configurations.
 * Load via the UI or POST /api/presets/seed.
 * Datasets are now CSV files in backend/datasets/.
 */

export interface GraderPreset {
  id: string;
  name: string;
  description: string;
  type:
    | 'exact-match'
    | 'llm-judge'
    | 'semantic-similarity'
    | 'faithfulness'
    | 'contains'
    | 'regex'
    | 'json-schema'
    | 'answer-relevancy'
    | 'context-relevancy';
  rubric?: string;
  config?: Record<string, unknown>;
  tooltip: string;
}

export const GRADER_PRESETS: GraderPreset[] = [
  {
    id: 'faithfulness-strict',
    name: 'Faithfulness (Strict)',
    description: 'All claims must be supported by context (>90%)',
    type: 'faithfulness',
    config: { threshold: 0.9 },
    tooltip: 'RAGAS-inspired: extracts atomic claims, verifies each against context',
  },
  {
    id: 'faithfulness-moderate',
    name: 'Faithfulness (Moderate)',
    description: 'Most claims must be supported by context (>70%)',
    type: 'faithfulness',
    config: { threshold: 0.7 },
    tooltip: 'Looser faithfulness — allows some inference',
  },
  {
    id: 'llm-judge-helpful',
    name: 'Helpfulness Judge',
    description: 'LLM evaluates if response is helpful and accurate',
    type: 'llm-judge',
    rubric: `Evaluate if the response is helpful, accurate, and addresses the user's question.

Pass if:
- The response directly answers the question
- Information is accurate and relevant
- Response is clear and well-structured

Fail if:
- Response is off-topic or doesn't answer the question
- Contains factual errors
- Is confusing or poorly written`,
    tooltip: 'General-purpose quality check',
  },
  {
    id: 'semantic-high',
    name: 'Semantic Match (High)',
    description: 'Output meaning must be very similar (>85%)',
    type: 'semantic-similarity',
    config: { threshold: 0.85 },
    tooltip: 'Cosine similarity on embeddings, strict threshold',
  },
  {
    id: 'semantic-moderate',
    name: 'Semantic Match (Moderate)',
    description: 'Output meaning must be somewhat similar (>70%)',
    type: 'semantic-similarity',
    config: { threshold: 0.7 },
    tooltip: 'Looser semantic match for creative rewrites',
  },
  {
    id: 'json-extraction-schema',
    name: 'Paper Extraction Schema',
    description: 'Validates JSON output against the research paper schema',
    type: 'json-schema',
    config: {
      schema: {
        type: 'object',
        required: ['title', 'authors', 'keyFindings', 'keywords'],
        properties: {
          title: { type: ['string', 'null'] },
          authors: { type: 'array', items: { type: 'string' } },
          publicationDate: { type: ['string', 'null'] },
          source: { type: ['string', 'null'] },
          abstract: { type: ['string', 'null'] },
          keyFindings: { type: 'array', items: { type: 'string' } },
          methodology: { type: ['string', 'null'] },
          keywords: { type: 'array', items: { type: 'string' } },
          limitations: { type: 'array', items: { type: 'string' } },
          citations: { type: ['number', 'null'] },
        },
      },
      strictMode: false,
    },
    tooltip: 'JSON Schema for structured paper extraction',
  },
  {
    id: 'extraction-completeness',
    name: 'Extraction Completeness Judge',
    description: 'LLM evaluates extraction quality, completeness, and grounding',
    type: 'llm-judge',
    rubric: `Evaluate the quality of a JSON extraction from a source document.

Compare the extracted output against the expected extraction:

1. COMPLETENESS: All relevant fields populated? All authors, findings, keywords captured?
2. ACCURACY: Values match source text? No fabricated data?
3. GROUNDING: Every value traces to source text? Null for fields without evidence?
4. STRUCTURE: Valid JSON matching expected schema?

Pass if all information is captured accurately with no fabrication.
Fail if key data is missing, fabricated, or schema is wrong.`,
    tooltip: 'LLM judge for extraction quality and grounding',
  },
];

