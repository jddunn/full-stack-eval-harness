import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ExperimentsService, CreateExperimentDto } from './experiments.service';

@Controller('experiments')
export class ExperimentsController {
  constructor(private readonly experimentsService: ExperimentsService) {}

  @Get()
  findAll() {
    return this.experimentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.experimentsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateExperimentDto) {
    return this.experimentsService.create(dto);
  }

  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.experimentsService.getStats(id);
  }

  /**
   * SSE endpoint for real-time experiment progress.
   * Client connects and receives updates as graders complete.
   */
  @Sse(':id/stream')
  stream(@Param('id') id: string): Observable<MessageEvent> {
    return this.experimentsService.getProgressStream(id).pipe(
      map((progress) => ({
        data: progress,
      })),
    );
  }
}
