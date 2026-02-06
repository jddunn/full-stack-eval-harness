import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export type GraderType =
  | 'exact-match'
  | 'llm-judge'
  | 'semantic-similarity'
  | 'faithfulness'
  | 'contains'
  | 'regex'
  | 'json-schema'
  | 'answer-relevancy'
  | 'context-relevancy'
  | 'promptfoo';

export interface LoadedGrader {
  id: string;
  name: string;
  description: string | null;
  type: GraderType;
  rubric: string | null;
  config: Record<string, unknown> | null;
  inspiration: string | null;
  reference: string | null;
  source: 'file';
  filePath: string;
  createdAt: string;
  updatedAt: string;
}

interface YamlGraderFile {
  name: string;
  description?: string;
  type: string;
  rubric?: string;
  config?: Record<string, unknown>;
  inspiration?: string;
  reference?: string;
}

@Injectable()
export class GraderLoaderService implements OnModuleInit {
  private readonly logger = new Logger(GraderLoaderService.name);
  private graders = new Map<string, LoadedGrader>();
  private gradersDir: string;

  constructor() {
    // graders/ directory lives next to src/ in the backend package
    const candidate = path.resolve(__dirname, '..', '..', '..', 'graders');
    const fallback = path.resolve(__dirname, '..', '..', 'graders');
    this.gradersDir = fs.existsSync(candidate) ? candidate : fallback;
  }

  onModuleInit() {
    this.loadAll();
  }

  /**
   * Read all .yaml files from the graders directory and parse them.
   */
  loadAll(): { loaded: number } {
    this.graders.clear();

    if (!fs.existsSync(this.gradersDir)) {
      this.logger.warn(`Graders directory not found: ${this.gradersDir}`);
      return { loaded: 0 };
    }

    const files = fs.readdirSync(this.gradersDir).filter(
      (f) => f.endsWith('.yaml') || f.endsWith('.yml'),
    );

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.gradersDir, file), 'utf-8');
        const grader = this.parseYaml(file, content);
        this.graders.set(grader.id, grader);
      } catch (err) {
        this.logger.error(`Failed to parse ${file}: ${err}`);
      }
    }

    this.logger.log(`Loaded ${this.graders.size} graders from ${this.gradersDir}`);
    return { loaded: this.graders.size };
  }

  findAll(): LoadedGrader[] {
    return Array.from(this.graders.values());
  }

  findOne(id: string): LoadedGrader {
    const grader = this.graders.get(id);
    if (!grader) {
      throw new NotFoundException(`Grader "${id}" not found`);
    }
    return grader;
  }

  findMany(ids: string[]): LoadedGrader[] {
    return ids.map((id) => this.findOne(id));
  }

  /**
   * Update a grader's YAML file on disk and reload it in memory.
   */
  updateGrader(
    id: string,
    data: {
      name?: string;
      description?: string;
      type?: GraderType;
      rubric?: string;
      config?: Record<string, unknown>;
      inspiration?: string;
      reference?: string;
    },
  ): LoadedGrader {
    const existing = this.findOne(id);

    const updated: YamlGraderFile = {
      name: data.name ?? existing.name,
      description: data.description ?? existing.description ?? undefined,
      type: data.type ?? existing.type,
      rubric: data.rubric ?? existing.rubric ?? undefined,
      config: data.config ?? existing.config ?? undefined,
      inspiration: data.inspiration ?? existing.inspiration ?? undefined,
      reference: data.reference ?? existing.reference ?? undefined,
    };

    const yamlContent = yaml.dump(updated, { lineWidth: -1, quotingType: '"' });
    const filePath = path.join(this.gradersDir, `${id}.yaml`);
    fs.writeFileSync(filePath, yamlContent, 'utf-8');

    // Re-parse and store
    const reloaded = this.parseYaml(`${id}.yaml`, yamlContent);
    this.graders.set(id, reloaded);

    this.logger.log(`Updated grader ${id} on disk`);
    return reloaded;
  }

  /**
   * Create a new grader YAML file on disk.
   */
  createGrader(
    id: string,
    data: {
      name: string;
      description?: string;
      type: GraderType;
      rubric?: string;
      config?: Record<string, unknown>;
    },
  ): LoadedGrader {
    const filePath = path.join(this.gradersDir, `${id}.yaml`);
    if (fs.existsSync(filePath)) {
      throw new Error(`Grader file already exists: ${id}.yaml`);
    }

    const yamlData: YamlGraderFile = {
      name: data.name,
      description: data.description,
      type: data.type,
      rubric: data.rubric,
      config: data.config,
    };

    // Ensure directory exists
    if (!fs.existsSync(this.gradersDir)) {
      fs.mkdirSync(this.gradersDir, { recursive: true });
    }

    const yamlContent = yaml.dump(yamlData, { lineWidth: -1, quotingType: '"' });
    fs.writeFileSync(filePath, yamlContent, 'utf-8');

    const grader = this.parseYaml(`${id}.yaml`, yamlContent);
    this.graders.set(id, grader);

    this.logger.log(`Created grader ${id} on disk`);
    return grader;
  }

  /**
   * Delete a grader YAML file from disk.
   */
  deleteGrader(id: string): void {
    this.findOne(id); // throws if not found
    const filePath = path.join(this.gradersDir, `${id}.yaml`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    this.graders.delete(id);
    this.logger.log(`Deleted grader ${id}`);
  }

  private parseYaml(filename: string, content: string): LoadedGrader {
    const id = filename.replace(/\.(yaml|yml)$/, '');
    const data = yaml.load(content) as YamlGraderFile;

    if (!data || typeof data !== 'object') {
      throw new Error(`Invalid YAML in ${filename}`);
    }
    if (!data.name) {
      throw new Error(`Missing "name" in ${filename}`);
    }
    if (!data.type) {
      throw new Error(`Missing "type" in ${filename}`);
    }

    const now = new Date().toISOString();
    const filePath = path.join(this.gradersDir, filename);
    const stat = fs.statSync(filePath);

    return {
      id,
      name: data.name,
      description: data.description || null,
      type: data.type as GraderType,
      rubric: data.rubric || null,
      config: data.config || null,
      inspiration: data.inspiration || null,
      reference: data.reference || null,
      source: 'file',
      filePath: `graders/${filename}`,
      createdAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    };
  }
}
