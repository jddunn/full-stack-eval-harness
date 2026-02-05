import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import {
  CandidatesService,
  CreateCandidateDto,
  UpdateCandidateDto,
} from './candidates.service';
import { CandidateRunnerService } from './candidate-runner.service';

@Controller('candidates')
export class CandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly candidateRunnerService: CandidateRunnerService
  ) {}

  @Get()
  findAll() {
    return this.candidatesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.candidatesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCandidateDto) {
    return this.candidatesService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCandidateDto) {
    return this.candidatesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.candidatesService.remove(id);
  }

  @Get(':id/variants')
  findVariants(@Param('id') id: string) {
    return this.candidatesService.findVariants(id);
  }

  /**
   * Test a candidate with a sample input.
   */
  @Post(':id/test')
  async testCandidate(
    @Param('id') id: string,
    @Body() body: { input: string; context?: string; metadata?: Record<string, unknown> }
  ) {
    const candidate = await this.candidatesService.findOne(id);
    const result = await this.candidateRunnerService.run(candidate, {
      input: body.input,
      context: body.context,
      metadata: body.metadata,
    });
    return result;
  }
}
