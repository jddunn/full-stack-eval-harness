import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Sse,
  Res,
  Header,
  MessageEvent,
} from '@nestjs/common';
import { Response } from 'express';
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
   */
  @Sse(':id/stream')
  stream(@Param('id') id: string): Observable<MessageEvent> {
    return this.experimentsService.getProgressStream(id).pipe(
      map((progress) => ({
        data: progress,
      })),
    );
  }

  /**
   * Export experiment results as JSON.
   */
  @Get(':id/export/json')
  @Header('Content-Type', 'application/json')
  async exportJson(@Param('id') id: string, @Res() res: Response) {
    const experiment = await this.experimentsService.findOne(id);
    const stats = await this.experimentsService.getStats(id);

    const exportData = {
      experiment: {
        id: experiment.id,
        name: experiment.name,
        datasetId: experiment.datasetId,
        graderIds: experiment.graderIds,
        status: experiment.status,
        createdAt: experiment.createdAt,
        completedAt: experiment.completedAt,
      },
      stats,
      results: experiment.results.map((r) => ({
        testCaseId: r.testCaseId,
        graderId: r.graderId,
        pass: r.pass,
        score: r.score,
        reason: r.reason,
        output: r.output,
        createdAt: r.createdAt,
      })),
    };

    const filename = `experiment-${id}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(exportData, null, 2));
  }

  /**
   * Export experiment results as CSV.
   */
  @Get(':id/export/csv')
  @Header('Content-Type', 'text/csv')
  async exportCsv(@Param('id') id: string, @Res() res: Response) {
    const experiment = await this.experimentsService.findOne(id);

    // CSV header
    const headers = [
      'test_case_id',
      'grader_id',
      'pass',
      'score',
      'reason',
      'output',
      'created_at',
    ];

    // CSV rows
    const rows = experiment.results.map((r) => [
      r.testCaseId,
      r.graderId,
      r.pass ? 'true' : 'false',
      r.score?.toFixed(4) || '',
      `"${(r.reason || '').replace(/"/g, '""')}"`,
      `"${(r.output || '').replace(/"/g, '""')}"`,
      r.createdAt?.toISOString() || '',
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const filename = `experiment-${id}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
