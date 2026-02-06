import { Injectable } from '@nestjs/common';
import { GraderLoaderService, LoadedGrader, GraderType } from './grader-loader.service';

export { GraderType };

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
  constructor(private readonly loader: GraderLoaderService) {}

  findAll(): LoadedGrader[] {
    return this.loader.findAll();
  }

  findOne(id: string): LoadedGrader {
    return this.loader.findOne(id);
  }

  findMany(ids: string[]): LoadedGrader[] {
    return this.loader.findMany(ids);
  }

  create(dto: CreateGraderDto): LoadedGrader {
    const id = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return this.loader.createGrader(id, dto);
  }

  update(id: string, dto: UpdateGraderDto): LoadedGrader {
    return this.loader.updateGrader(id, dto);
  }

  remove(id: string): { deleted: boolean } {
    this.loader.deleteGrader(id);
    return { deleted: true };
  }

  reload(): { loaded: number } {
    return this.loader.loadAll();
  }
}
