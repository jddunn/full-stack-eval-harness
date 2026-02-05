import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { nanoid } from 'nanoid';
import { DATABASE_CONNECTION } from '../database/db.module';
import * as schema from '../database/schema';

export type GraderType = 'exact-match' | 'llm-judge' | 'semantic-similarity' | 'faithfulness';

export interface CreateGraderDto {
  name: string;
  description?: string;
  type: GraderType;
  rubric?: string; // For LLM-based graders
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
    @Inject(DATABASE_CONNECTION)
    private db: BetterSQLite3Database<typeof schema>,
  ) {}

  /**
   * Get all graders.
   */
  async findAll() {
    const graders = await this.db.select().from(schema.graders);
    return graders.map((g) => ({
      ...g,
      config: g.config ? JSON.parse(g.config) : null,
    }));
  }

  /**
   * Get a grader by ID.
   */
  async findOne(id: string) {
    const [grader] = await this.db
      .select()
      .from(schema.graders)
      .where(eq(schema.graders.id, id));

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
    const graders = await Promise.all(ids.map((id) => this.findOne(id)));
    return graders;
  }

  /**
   * Create a new grader.
   */
  async create(dto: CreateGraderDto) {
    const now = new Date();
    const grader: schema.NewGrader = {
      id: nanoid(),
      name: dto.name,
      description: dto.description,
      type: dto.type,
      rubric: dto.rubric,
      config: dto.config ? JSON.stringify(dto.config) : null,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(schema.graders).values(grader);
    return {
      ...grader,
      config: dto.config || null,
    };
  }

  /**
   * Update a grader.
   */
  async update(id: string, dto: UpdateGraderDto) {
    const [existing] = await this.db
      .select()
      .from(schema.graders)
      .where(eq(schema.graders.id, id));

    if (!existing) {
      throw new NotFoundException(`Grader ${id} not found`);
    }

    const updates: Partial<schema.Grader> = { updatedAt: new Date() };
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.rubric !== undefined) updates.rubric = dto.rubric;
    if (dto.config !== undefined) updates.config = JSON.stringify(dto.config);

    await this.db.update(schema.graders).set(updates).where(eq(schema.graders.id, id));

    return this.findOne(id);
  }

  /**
   * Delete a grader.
   */
  async remove(id: string) {
    const [existing] = await this.db
      .select()
      .from(schema.graders)
      .where(eq(schema.graders.id, id));

    if (!existing) {
      throw new NotFoundException(`Grader ${id} not found`);
    }

    await this.db.delete(schema.graders).where(eq(schema.graders.id, id));
    return { deleted: true };
  }
}
