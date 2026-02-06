import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { LlmService, LlmProvider } from '../llm/llm.service';
import { LoadedPrompt, PromptLoaderService } from './prompt-loader.service';

export interface GeneratePromptVariantsDto {
  count?: number;
  customInstructions?: string;
  provider?: LlmProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface GeneratedVariantDraft {
  variantLabel?: string;
  name?: string;
  description?: string;
  systemPrompt?: string;
}

export interface GeneratePromptVariantsResult {
  parentId: string;
  created: LoadedPrompt[];
  skipped: Array<{ requestedLabel: string; reason: string }>;
  usedConfig: {
    provider: LlmProvider;
    model: string;
    temperature: number;
    maxTokens: number;
  };
}

@Injectable()
export class PromptVariantGeneratorService {
  private readonly defaultCount = 3;
  private readonly maxCount = 10;

  constructor(
    private promptLoader: PromptLoaderService,
    private llmService: LlmService,
  ) {}

  async generate(
    parentId: string,
    dto: GeneratePromptVariantsDto,
  ): Promise<GeneratePromptVariantsResult> {
    const parent = this.promptLoader.findOne(parentId);

    if (parent.runnerType !== 'llm_prompt') {
      throw new BadRequestException(
        'AI variant generation is only supported for llm_prompt candidates',
      );
    }

    const count = dto.count ?? this.defaultCount;
    if (!Number.isInteger(count) || count < 1 || count > this.maxCount) {
      throw new BadRequestException(`count must be an integer between 1 and ${this.maxCount}`);
    }

    const settings = await this.llmService.getFullSettings();
    const usedConfig = {
      provider: dto.provider ?? settings.provider,
      model: dto.model ?? settings.model,
      temperature: dto.temperature ?? settings.temperature ?? 0.7,
      maxTokens: dto.maxTokens ?? settings.maxTokens ?? 1024,
    };

    const prompt = this.buildGenerationPrompt(parent, count, dto.customInstructions);
    const rawResponse = await this.llmService.complete(prompt, {
      provider: usedConfig.provider,
      model: usedConfig.model,
      temperature: usedConfig.temperature,
      maxTokens: usedConfig.maxTokens,
    });

    const drafts = this.parseDrafts(rawResponse, count);
    const existingIds = new Set(this.promptLoader.findAll().map((p) => p.id));
    const created: LoadedPrompt[] = [];
    const skipped: Array<{ requestedLabel: string; reason: string }> = [];

    for (let i = 0; i < drafts.length; i++) {
      const draft = drafts[i];
      const requestedLabel = draft.variantLabel || `variant-${i + 1}`;
      const baseLabel = this.promptLoader.normalizeVariantLabel(requestedLabel);
      const uniqueLabel = this.ensureUniqueLabel(parentId, baseLabel, existingIds);
      const systemPrompt = (draft.systemPrompt || '').trim();
      const cleanName = draft.name?.replace(/\s+/g, ' ').trim() || undefined;
      const cleanDescription =
        draft.description?.replace(/\s+/g, ' ').trim() || undefined;

      if (!systemPrompt) {
        skipped.push({
          requestedLabel,
          reason: 'missing systemPrompt',
        });
        continue;
      }

      try {
        const createdVariant = this.promptLoader.createVariant(parentId, {
          variantLabel: uniqueLabel,
          name: cleanName,
          description: cleanDescription,
          systemPrompt,
        });
        created.push(createdVariant);
        existingIds.add(createdVariant.id);
      } catch (error) {
        skipped.push({
          requestedLabel,
          reason: error instanceof Error ? error.message : 'createVariant failed',
        });
      }
    }

    if (created.length === 0) {
      throw new InternalServerErrorException(
        'Variant generation returned no usable variants',
      );
    }

    return {
      parentId,
      created,
      skipped,
      usedConfig,
    };
  }

  private ensureUniqueLabel(
    parentId: string,
    baseLabel: string,
    existingIds: Set<string>,
  ): string {
    let label = baseLabel;
    let suffix = 2;
    while (existingIds.has(this.promptLoader.buildVariantId(parentId, label))) {
      label = `${baseLabel}-${suffix}`;
      suffix++;
    }
    return label;
  }

  private buildGenerationPrompt(
    parent: LoadedPrompt,
    count: number,
    customInstructions?: string,
  ): string {
    return `You generate high-quality prompt variants for evaluation.

Task:
- Produce exactly ${count} prompt variants for the parent prompt below.
- Keep the task intent equivalent to the parent.
- Vary style/strategy (for example: concise, step-by-step, strict grounding, schema-first).
- Keep outputs practical for eval harness comparison (no roleplay or meta text).

Parent prompt metadata:
- id: ${parent.id}
- name: ${parent.name}
- description: ${parent.description || '(none)'}
- user_template: ${parent.userPromptTemplate || '{{input}}'}

Parent system prompt:
"""
${parent.systemPrompt || ''}
"""

${customInstructions ? `Additional user instructions:\n${customInstructions}\n` : ''}

Return ONLY valid JSON as an array of exactly ${count} objects.
Each object must have:
- "variantLabel": short slug-like label (letters/numbers/hyphen)
- "name": display name
- "description": one-line summary
- "systemPrompt": full system prompt text for this variant

Do not include markdown fences or extra commentary.`;
  }

  private parseDrafts(rawResponse: string, count: number): GeneratedVariantDraft[] {
    let jsonText = rawResponse.trim();
    const fenced = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      jsonText = fenced[1];
    }

    const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonText = arrayMatch[0];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new BadRequestException('Failed to parse generated variants JSON');
    }

    if (!Array.isArray(parsed)) {
      throw new BadRequestException('Generated variants response is not an array');
    }

    return parsed
      .slice(0, count)
      .map((item) => (item && typeof item === 'object' ? (item as GeneratedVariantDraft) : {}));
  }
}
