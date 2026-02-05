import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Res,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import {
  DatasetsService,
  CreateDatasetDto,
  CreateTestCaseDto,
  UpdateTestCaseDto,
} from './datasets.service';

@Controller('datasets')
export class DatasetsController {
  constructor(private readonly datasetsService: DatasetsService) {}

  @Get()
  findAll() {
    return this.datasetsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.datasetsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateDatasetDto) {
    return this.datasetsService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateDatasetDto>) {
    return this.datasetsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.datasetsService.remove(id);
  }

  // Test case endpoints
  @Post(':id/cases')
  addTestCase(@Param('id') datasetId: string, @Body() dto: CreateTestCaseDto) {
    return this.datasetsService.addTestCase(datasetId, dto);
  }

  @Put(':id/cases/:caseId')
  updateTestCase(
    @Param('id') datasetId: string,
    @Param('caseId') caseId: string,
    @Body() dto: UpdateTestCaseDto,
  ) {
    return this.datasetsService.updateTestCase(datasetId, caseId, dto);
  }

  @Delete(':id/cases/:caseId')
  removeTestCase(
    @Param('id') datasetId: string,
    @Param('caseId') caseId: string,
  ) {
    return this.datasetsService.removeTestCase(datasetId, caseId);
  }

  /**
   * Export dataset as JSON.
   */
  @Get(':id/export/json')
  @Header('Content-Type', 'application/json')
  async exportJson(@Param('id') id: string, @Res() res: Response) {
    const dataset = await this.datasetsService.findOne(id);

    const exportData = {
      name: dataset.name,
      description: dataset.description,
      testCases: dataset.testCases.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        context: tc.context,
        metadata: tc.metadata,
      })),
    };

    const filename = `dataset-${dataset.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(exportData, null, 2));
  }

  /**
   * Export dataset as CSV.
   */
  @Get(':id/export/csv')
  @Header('Content-Type', 'text/csv')
  async exportCsv(@Param('id') id: string, @Res() res: Response) {
    const dataset = await this.datasetsService.findOne(id);

    const headers = ['input', 'expected_output', 'context', 'metadata'];
    const rows = dataset.testCases.map((tc) => [
      `"${(tc.input || '').replace(/"/g, '""')}"`,
      `"${(tc.expectedOutput || '').replace(/"/g, '""')}"`,
      `"${(tc.context || '').replace(/"/g, '""')}"`,
      `"${tc.metadata ? JSON.stringify(tc.metadata).replace(/"/g, '""') : ''}"`,
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const filename = `dataset-${dataset.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  /**
   * Import test cases from JSON.
   */
  @Post(':id/import')
  async importTestCases(
    @Param('id') datasetId: string,
    @Body() body: {
      testCases: Array<{
        input: string;
        expectedOutput?: string;
        context?: string;
        metadata?: Record<string, unknown>;
      }>;
    },
  ) {
    const results = [];

    for (const tc of body.testCases) {
      const testCase = await this.datasetsService.addTestCase(datasetId, tc);
      results.push(testCase);
    }

    return {
      imported: results.length,
      testCases: results,
    };
  }
}
