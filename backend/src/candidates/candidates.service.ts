import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { DB_ADAPTER, IDbAdapter } from '../database/db.module';

export interface CreateCandidateDto {
  name: string;
  description?: string;
  runnerType: 'llm_prompt' | 'http_endpoint';
  systemPrompt?: string;
  userPromptTemplate?: string;
  modelConfig?: Record<string, unknown>;
  endpointUrl?: string;
  endpointMethod?: string;
  endpointHeaders?: Record<string, string>;
  endpointBodyTemplate?: string;
  parentId?: string;
  variantLabel?: string;
}

export interface UpdateCandidateDto {
  name?: string;
  description?: string;
  runnerType?: 'llm_prompt' | 'http_endpoint';
  systemPrompt?: string;
  userPromptTemplate?: string;
  modelConfig?: Record<string, unknown>;
  endpointUrl?: string;
  endpointMethod?: string;
  endpointHeaders?: Record<string, string>;
  endpointBodyTemplate?: string;
  variantLabel?: string;
}

@Injectable()
export class CandidatesService {
  constructor(
    @Inject(DB_ADAPTER)
    private db: IDbAdapter
  ) {}

  async findAll() {
    const candidates = await this.db.findAllCandidates();
    return candidates.map((c) => this.serialize(c));
  }

  async findOne(id: string) {
    const candidate = await this.db.findCandidateById(id);
    if (!candidate) {
      throw new NotFoundException(`Candidate ${id} not found`);
    }
    return this.serialize(candidate);
  }

  async findMany(ids: string[]) {
    const candidates = await this.db.findCandidatesByIds(ids);
    return candidates.map((c) => this.serialize(c));
  }

  async findVariants(parentId: string) {
    const variants = await this.db.findCandidateVariants(parentId);
    return variants.map((c) => this.serialize(c));
  }

  async create(dto: CreateCandidateDto) {
    const now = new Date();
    const candidate = await this.db.insertCandidate({
      id: nanoid(),
      name: dto.name,
      description: dto.description || null,
      runnerType: dto.runnerType,
      systemPrompt: dto.systemPrompt || null,
      userPromptTemplate: dto.userPromptTemplate || null,
      modelConfig: dto.modelConfig ? JSON.stringify(dto.modelConfig) : null,
      endpointUrl: dto.endpointUrl || null,
      endpointMethod: dto.endpointMethod || null,
      endpointHeaders: dto.endpointHeaders ? JSON.stringify(dto.endpointHeaders) : null,
      endpointBodyTemplate: dto.endpointBodyTemplate || null,
      parentId: dto.parentId || null,
      variantLabel: dto.variantLabel || null,
      createdAt: now,
      updatedAt: now,
    });
    return this.serialize(candidate);
  }

  async update(id: string, dto: UpdateCandidateDto) {
    const existing = await this.db.findCandidateById(id);
    if (!existing) {
      throw new NotFoundException(`Candidate ${id} not found`);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.runnerType !== undefined) updates.runnerType = dto.runnerType;
    if (dto.systemPrompt !== undefined) updates.systemPrompt = dto.systemPrompt;
    if (dto.userPromptTemplate !== undefined) updates.userPromptTemplate = dto.userPromptTemplate;
    if (dto.modelConfig !== undefined) updates.modelConfig = JSON.stringify(dto.modelConfig);
    if (dto.endpointUrl !== undefined) updates.endpointUrl = dto.endpointUrl;
    if (dto.endpointMethod !== undefined) updates.endpointMethod = dto.endpointMethod;
    if (dto.endpointHeaders !== undefined)
      updates.endpointHeaders = JSON.stringify(dto.endpointHeaders);
    if (dto.endpointBodyTemplate !== undefined)
      updates.endpointBodyTemplate = dto.endpointBodyTemplate;
    if (dto.variantLabel !== undefined) updates.variantLabel = dto.variantLabel;

    await this.db.updateCandidate(id, updates);
    return this.findOne(id);
  }

  async remove(id: string) {
    const existing = await this.db.findCandidateById(id);
    if (!existing) {
      throw new NotFoundException(`Candidate ${id} not found`);
    }
    await this.db.deleteCandidate(id);
    return { deleted: true };
  }

  /**
   * Extract {{variable}} names from prompt templates.
   */
  extractVariables(userPrompt?: string, systemPrompt?: string): string[] {
    const regex = /\{\{(\w[\w.]*)\}\}/g;
    const vars = new Set<string>();
    const text = (systemPrompt || '') + '\n' + (userPrompt || '');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      vars.add(match[1]);
    }
    return Array.from(vars);
  }

  /**
   * Render a template by substituting variables.
   */
  renderTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w[\w.]*)\}\}/g, (_, key) => {
      // Support dot notation for metadata.field
      const parts = key.split('.');
      let val: any = variables;
      for (const part of parts) {
        val = val?.[part];
      }
      return val !== undefined && val !== null ? String(val) : `{{${key}}}`;
    });
  }

  private serialize(candidate: any) {
    return {
      ...candidate,
      modelConfig: candidate.modelConfig ? JSON.parse(candidate.modelConfig) : null,
      endpointHeaders: candidate.endpointHeaders ? JSON.parse(candidate.endpointHeaders) : null,
    };
  }
}
