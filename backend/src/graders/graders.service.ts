import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { DB_ADAPTER, IDbAdapter } from '../database/db.module';

export type GraderType =
  | 'exact-match'
  | 'llm-judge'
  | 'semantic-similarity'
  | 'faithfulness'
  | 'contains'
  | 'regex'
  | 'json-schema'
  | 'answer-relevancy'
  | 'context-relevancy';

export interface CreateGraderDto {
  name: string;
  description?: string;
  type: GraderType;
  rubric?: string;
  config?: Record<string, unknown>;
}

export interface UpdateGraderDto {
  name?: string;
  description?: string;
  rubric?: string;
  config?: Record<string, unknown>;
}

@Injectable()
export class GradersService {
  constructor(
    @Inject(DB_ADAPTER)
    private db: IDbAdapter
  ) {}

  /**
   * Get all graders.
   */
  async findAll() {
    const graders = await this.db.findAllGraders();
    return graders.map((g) => ({
      ...g,
      config: g.config ? JSON.parse(g.config) : null,
    }));
  }

  /**
   * Get a grader by ID.
   */
  async findOne(id: string) {
    const grader = await this.db.findGraderById(id);

    if (!grader) {
      throw new NotFoundException(`Grader ${id} not found`);
    }

    return {
      ...grader,
      config: grader.config ? JSON.parse(grader.config) : null,
    };
  }

  /**
   * Get multiple graders by IDs.
   */
  async findMany(ids: string[]) {
    const graders = await this.db.findGradersByIds(ids);
    return graders.map((g) => ({
      ...g,
      config: g.config ? JSON.parse(g.config) : null,
    }));
  }

  /**
   * Create a new grader.
   */
  async create(dto: CreateGraderDto) {
    const now = new Date();
    const grader = await this.db.insertGrader({
      id: nanoid(),
      name: dto.name,
      description: dto.description,
      type: dto.type,
      rubric: dto.rubric,
      config: dto.config ? JSON.stringify(dto.config) : null,
      createdAt: now,
      updatedAt: now,
    });

    return {
      ...grader,
      config: dto.config || null,
    };
  }

  /**
   * Update a grader.
   */
  async update(id: string, dto: UpdateGraderDto) {
    const existing = await this.db.findGraderById(id);

    if (!existing) {
      throw new NotFoundException(`Grader ${id} not found`);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.rubric !== undefined) updates.rubric = dto.rubric;
    if (dto.config !== undefined) updates.config = JSON.stringify(dto.config);

    await this.db.updateGrader(id, updates);

    return this.findOne(id);
  }

  /**
   * Delete a grader.
   */
  async remove(id: string) {
    const existing = await this.db.findGraderById(id);

    if (!existing) {
      throw new NotFoundException(`Grader ${id} not found`);
    }

    await this.db.deleteGrader(id);
    return { deleted: true };
  }
}
