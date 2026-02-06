import { Injectable, Logger, OnModuleInit, NotFoundException, ConflictException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface LoadedPrompt {
  id: string;
  name: string;
  description: string | null;
  runnerType: 'llm_prompt' | 'http_endpoint';
  systemPrompt: string | null;
  userPromptTemplate: string | null;
  modelConfig: Record<string, unknown> | null;
  endpointUrl: string | null;
  endpointMethod: string | null;
  endpointHeaders: Record<string, string> | null;
  endpointBodyTemplate: string | null;
  parentId: string | null;
  variantLabel: string | null;
  recommendedGraders: string[];
  graderWeights: Record<string, number>;
  recommendedDatasets: string[];
  graderRationale: string | null;
  notes: string | null;
  source: 'file';
}

@Injectable()
export class PromptLoaderService implements OnModuleInit {
  private readonly logger = new Logger(PromptLoaderService.name);
  private prompts = new Map<string, LoadedPrompt>();
  private promptsDir: string;

  constructor() {
    // prompts/ directory lives next to src/ in the backend package
    // In compiled dist: __dirname = dist/src/candidates/, so go up 3 levels
    // In tests (ts-jest): __dirname = src/candidates/, so go up 2 levels
    const candidate = path.resolve(__dirname, '..', '..', '..', 'prompts');
    const fallback = path.resolve(__dirname, '..', '..', 'prompts');
    this.promptsDir = fs.existsSync(candidate) ? candidate : fallback;
  }

  onModuleInit() {
    this.loadAll();
  }

  /**
   * Read all .md files from the prompts directory and parse them.
   */
  loadAll(): { loaded: number } {
    this.prompts.clear();

    if (!fs.existsSync(this.promptsDir)) {
      this.logger.warn(`Prompts directory not found: ${this.promptsDir}`);
      return { loaded: 0 };
    }

    const files = fs.readdirSync(this.promptsDir).filter((f) => f.endsWith('.md'));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.promptsDir, file), 'utf-8');
        const prompt = this.parseMarkdown(file, content);
        this.prompts.set(prompt.id, prompt);
      } catch (err) {
        this.logger.error(`Failed to parse ${file}: ${err}`);
      }
    }

    this.logger.log(`Loaded ${this.prompts.size} prompts from ${this.promptsDir}`);
    return { loaded: this.prompts.size };
  }

  findAll(): LoadedPrompt[] {
    return Array.from(this.prompts.values());
  }

  findOne(id: string): LoadedPrompt {
    const prompt = this.prompts.get(id);
    if (!prompt) {
      throw new NotFoundException(`Prompt "${id}" not found`);
    }
    return prompt;
  }

  findMany(ids: string[]): LoadedPrompt[] {
    return ids.map((id) => this.findOne(id));
  }

  /**
   * Normalize a variant label into a safe slug for prompt IDs/files.
   */
  normalizeVariantLabel(label: string): string {
    const normalized = label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
    return normalized || 'variant';
  }

  buildVariantId(parentId: string, variantLabel: string): string {
    return `${parentId}-${this.normalizeVariantLabel(variantLabel)}`;
  }

  /**
   * Update a prompt's .md file on disk and reload it in memory.
   */
  updatePrompt(
    id: string,
    data: {
      name?: string;
      description?: string;
      runnerType?: 'llm_prompt' | 'http_endpoint';
      systemPrompt?: string;
      userPromptTemplate?: string;
      temperature?: number;
      maxTokens?: number;
      provider?: string;
      model?: string;
      endpointUrl?: string;
      endpointMethod?: string;
      endpointBodyTemplate?: string;
      recommendedGraders?: string[];
      graderWeights?: Record<string, number>;
      recommendedDatasets?: string[];
      graderRationale?: string;
      notes?: string;
    },
  ): LoadedPrompt {
    const existing = this.findOne(id);

    // Merge fields
    const name = data.name ?? existing.name;
    const description = data.description ?? existing.description;
    const runner = data.runnerType ?? existing.runnerType;
    const userTemplate = data.userPromptTemplate ?? existing.userPromptTemplate;
    const systemPrompt = data.systemPrompt ?? existing.systemPrompt ?? '';

    // Model config
    const temperature = data.temperature ?? (existing.modelConfig?.temperature as number | undefined);
    const maxTokens = data.maxTokens ?? (existing.modelConfig?.maxTokens as number | undefined);
    const provider = data.provider ?? (existing.modelConfig?.provider as string | undefined);
    const model = data.model ?? (existing.modelConfig?.model as string | undefined);

    // Endpoint fields
    const endpointUrl = data.endpointUrl ?? existing.endpointUrl;
    const endpointMethod = data.endpointMethod ?? existing.endpointMethod;
    const endpointBodyTemplate = data.endpointBodyTemplate ?? existing.endpointBodyTemplate;

    // Recommendations
    const recGraders = data.recommendedGraders ?? existing.recommendedGraders;
    const graderWeights = data.graderWeights ?? existing.graderWeights;
    const recDatasets = data.recommendedDatasets ?? existing.recommendedDatasets;
    const graderRationale = data.graderRationale ?? existing.graderRationale;
    const notes = data.notes ?? existing.notes;

    // Build frontmatter lines
    const lines: string[] = [];
    lines.push(`name: ${name}`);
    if (description) lines.push(`description: ${description}`);
    lines.push(`runner: ${runner}`);
    if (existing.parentId) lines.push(`parent_prompt: ${existing.parentId}`);
    if (existing.variantLabel) lines.push(`variant: ${existing.variantLabel}`);
    if (temperature !== undefined) lines.push(`temperature: ${temperature}`);
    if (maxTokens !== undefined) lines.push(`max_tokens: ${maxTokens}`);
    if (provider) lines.push(`provider: ${provider}`);
    if (model) lines.push(`model: ${model}`);
    if (userTemplate) lines.push(`user_template: "${userTemplate}"`);
    if (endpointUrl) lines.push(`endpoint_url: ${endpointUrl}`);
    if (endpointMethod) lines.push(`endpoint_method: ${endpointMethod}`);
    if (endpointBodyTemplate) lines.push(`endpoint_body_template: ${endpointBodyTemplate}`);

    // Serialize weighted grader list: "id:weight, id2:weight2"
    if (recGraders.length > 0) {
      const parts = recGraders.map((g) => {
        const w = graderWeights[g];
        return w != null && w !== 1 ? `${g}:${w}` : g;
      });
      lines.push(`recommended_graders: ${parts.join(', ')}`);
    }
    if (recDatasets.length > 0) {
      lines.push(`recommended_datasets: ${recDatasets.join(', ')}`);
    }
    if (graderRationale) lines.push(`grader_rationale: ${graderRationale}`);
    if (notes) lines.push(`notes: ${notes}`);

    // Assemble file content
    const content = `---\n${lines.join('\n')}\n---\n${systemPrompt}\n`;

    // Write to disk
    const filePath = path.join(this.promptsDir, `${id}.md`);
    fs.writeFileSync(filePath, content, 'utf-8');

    // Re-parse and store in memory
    const updated = this.parseMarkdown(`${id}.md`, content);
    this.prompts.set(id, updated);

    this.logger.log(`Updated prompt ${id} on disk`);
    return updated;
  }

  /**
   * Create a variant of an existing prompt. Clones the parent's system prompt
   * and config, sets parent_prompt/variant fields, writes a new .md file.
   */
  createVariant(
    parentId: string,
    data: {
      variantLabel: string;
      name?: string;
      description?: string;
      systemPrompt?: string;
    },
  ): LoadedPrompt {
    const parent = this.findOne(parentId);
    const label = this.normalizeVariantLabel(data.variantLabel);
    const newId = this.buildVariantId(parentId, label);

    if (this.prompts.has(newId)) {
      throw new ConflictException(`Prompt "${newId}" already exists`);
    }

    const name = data.name || `${parent.name} (${data.variantLabel})`;
    const description = data.description || parent.description;
    const systemPrompt = data.systemPrompt ?? parent.systemPrompt ?? '';

    // Build frontmatter
    const lines: string[] = [];
    lines.push(`name: ${name}`);
    if (description) lines.push(`description: ${description}`);
    lines.push(`runner: ${parent.runnerType}`);
    lines.push(`parent_prompt: ${parentId}`);
    lines.push(`variant: ${label}`);
    if (parent.userPromptTemplate) lines.push(`user_template: "${parent.userPromptTemplate}"`);

    // Copy model config
    if (parent.modelConfig?.temperature !== undefined) lines.push(`temperature: ${parent.modelConfig.temperature}`);
    if (parent.modelConfig?.maxTokens !== undefined) lines.push(`max_tokens: ${parent.modelConfig.maxTokens}`);
    if (parent.modelConfig?.provider) lines.push(`provider: ${parent.modelConfig.provider}`);
    if (parent.modelConfig?.model) lines.push(`model: ${parent.modelConfig.model}`);

    // Copy recommendations
    if (parent.recommendedGraders.length > 0) {
      const parts = parent.recommendedGraders.map((g) => {
        const w = parent.graderWeights[g];
        return w != null && w !== 1 ? `${g}:${w}` : g;
      });
      lines.push(`recommended_graders: ${parts.join(', ')}`);
    }
    if (parent.recommendedDatasets.length > 0) {
      lines.push(`recommended_datasets: ${parent.recommendedDatasets.join(', ')}`);
    }
    if (parent.graderRationale) lines.push(`grader_rationale: ${parent.graderRationale}`);

    const content = `---\n${lines.join('\n')}\n---\n${systemPrompt}\n`;
    const filePath = path.join(this.promptsDir, `${newId}.md`);
    fs.writeFileSync(filePath, content, 'utf-8');

    const created = this.parseMarkdown(`${newId}.md`, content);
    this.prompts.set(newId, created);

    this.logger.log(`Created variant "${newId}" of "${parentId}"`);
    return created;
  }

  /**
   * Delete a prompt's .md file from disk and remove from memory.
   */
  deletePrompt(id: string): { deleted: boolean } {
    this.findOne(id); // throws if not found
    const filePath = path.join(this.promptsDir, `${id}.md`);
    fs.unlinkSync(filePath);
    this.prompts.delete(id);
    this.logger.log(`Deleted prompt "${id}"`);
    return { deleted: true };
  }

  /**
   * Parse a markdown file with simple frontmatter into a LoadedPrompt.
   *
   * Format:
   * ---
   * key: value
   * key: value
   * ---
   * Body text (system prompt)
   */
  private parseMarkdown(filename: string, content: string): LoadedPrompt {
    const id = filename.replace(/\.md$/, '');

    // Split frontmatter from body
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!fmMatch) {
      throw new Error(`No frontmatter found in ${filename}`);
    }

    const frontmatterText = fmMatch[1];
    const body = fmMatch[2].trim();

    // Parse flat key: value pairs from frontmatter
    const fm: Record<string, string> = {};
    for (const line of frontmatterText.split('\n')) {
      const match = line.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
      if (match) {
        fm[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
      }
    }

    if (!fm.name) {
      throw new Error(`Missing "name" in frontmatter of ${filename}`);
    }
    if (!fm.runner) {
      throw new Error(`Missing "runner" in frontmatter of ${filename}`);
    }

    // Build model config from optional fields
    const modelConfig: Record<string, unknown> = {};
    if (fm.temperature !== undefined) modelConfig.temperature = parseFloat(fm.temperature);
    if (fm.max_tokens !== undefined) modelConfig.maxTokens = parseInt(fm.max_tokens, 10);
    if (fm.provider) modelConfig.provider = fm.provider;
    if (fm.model) modelConfig.model = fm.model;

    // Parse comma-separated recommendation lists
    const parseList = (val: string | undefined): string[] =>
      val ? val.split(',').map((s) => s.trim()).filter(Boolean) : [];

    // Parse weighted grader list: "grader-id:0.4, grader-id2:0.3" → ids + weights
    const parseWeightedList = (val: string | undefined): { ids: string[]; weights: Record<string, number> } => {
      if (!val) return { ids: [], weights: {} };
      const ids: string[] = [];
      const weights: Record<string, number> = {};
      for (const item of val.split(',').map((s) => s.trim()).filter(Boolean)) {
        const colonIdx = item.lastIndexOf(':');
        if (colonIdx > 0) {
          const maybeWeight = parseFloat(item.slice(colonIdx + 1));
          if (!isNaN(maybeWeight)) {
            const id = item.slice(0, colonIdx);
            ids.push(id);
            weights[id] = maybeWeight;
            continue;
          }
        }
        ids.push(item);
        weights[item] = 1.0;
      }
      return { ids, weights };
    };

    const graderResult = parseWeightedList(fm.recommended_graders);

    return {
      id,
      name: fm.name,
      description: fm.description || null,
      runnerType: fm.runner as 'llm_prompt' | 'http_endpoint',
      systemPrompt: body || null,
      userPromptTemplate: fm.user_template || null,
      modelConfig: Object.keys(modelConfig).length > 0 ? modelConfig : null,
      endpointUrl: fm.endpoint_url || null,
      endpointMethod: fm.endpoint_method || null,
      endpointHeaders: null,
      endpointBodyTemplate: fm.endpoint_body_template || null,
      parentId: fm.parent_prompt || null,
      variantLabel: fm.variant || null,
      recommendedGraders: graderResult.ids,
      graderWeights: graderResult.weights,
      recommendedDatasets: parseList(fm.recommended_datasets),
      graderRationale: fm.grader_rationale || null,
      notes: fm.notes || null,
      source: 'file',
    };
  }
}
