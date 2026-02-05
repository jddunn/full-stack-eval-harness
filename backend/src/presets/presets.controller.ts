import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { GRADER_PRESETS, DATASET_PRESETS, CANDIDATE_PRESETS } from './presets';
import { DatasetsService } from '../datasets/datasets.service';
import { GradersService } from '../graders/graders.service';
import { CandidatesService } from '../candidates/candidates.service';
import {
  SyntheticService,
  SyntheticGenerationRequest,
} from './synthetic.service';

@Controller('presets')
export class PresetsController {
  constructor(
    private datasetsService: DatasetsService,
    private gradersService: GradersService,
    private candidatesService: CandidatesService,
    private syntheticService: SyntheticService,
  ) {}

  /**
   * Get all grader presets
   */
  @Get('graders')
  getGraderPresets() {
    return GRADER_PRESETS;
  }

  /**
   * Get all dataset presets
   */
  @Get('datasets')
  getDatasetPresets() {
    return DATASET_PRESETS;
  }

  /**
   * Load a grader preset - creates a new grader from the preset
   */
  @Post('graders/:id/load')
  async loadGraderPreset(@Param('id') id: string) {
    const preset = GRADER_PRESETS.find((p) => p.id === id);
    if (!preset) {
      throw new Error(`Grader preset not found: ${id}`);
    }

    return this.gradersService.create({
      name: preset.name,
      description: preset.description,
      type: preset.type,
      rubric: preset.rubric,
      config: preset.config,
    });
  }

  /**
   * Load a dataset preset - creates a new dataset with test cases
   */
  @Post('datasets/:id/load')
  async loadDatasetPreset(@Param('id') id: string) {
    const preset = DATASET_PRESETS.find((p) => p.id === id);
    if (!preset) {
      throw new Error(`Dataset preset not found: ${id}`);
    }

    // Create the dataset
    const dataset = await this.datasetsService.create({
      name: preset.name,
      description: preset.description,
    });

    // Add all test cases
    for (const testCase of preset.testCases) {
      await this.datasetsService.addTestCase(dataset.id, {
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        context: testCase.context,
      });
    }

    // Return the full dataset with test cases
    return this.datasetsService.findOne(dataset.id);
  }

  /**
   * Load all presets at once - useful for demo/seed data
   */
  @Post('seed')
  async seedAll() {
    const results = {
      graders: [] as any[],
      datasets: [] as any[],
    };

    // Load all grader presets
    for (const preset of GRADER_PRESETS) {
      const grader = await this.gradersService.create({
        name: preset.name,
        description: preset.description,
        type: preset.type,
        rubric: preset.rubric,
        config: preset.config,
      });
      results.graders.push(grader);
    }

    // Load all dataset presets
    for (const preset of DATASET_PRESETS) {
      const dataset = await this.datasetsService.create({
        name: preset.name,
        description: preset.description,
      });

      for (const testCase of preset.testCases) {
        await this.datasetsService.addTestCase(dataset.id, {
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          context: testCase.context,
        });
      }

      results.datasets.push(await this.datasetsService.findOne(dataset.id));
    }

    return results;
  }

  /**
   * Get all candidate presets
   */
  @Get('candidates')
  getCandidatePresets() {
    return CANDIDATE_PRESETS;
  }

  /**
   * Load a candidate preset - creates a new candidate from the preset
   */
  @Post('candidates/:id/load')
  async loadCandidatePreset(@Param('id') id: string) {
    const preset = CANDIDATE_PRESETS.find((p) => p.id === id);
    if (!preset) {
      throw new Error(`Candidate preset not found: ${id}`);
    }

    return this.candidatesService.create({
      name: preset.name,
      description: preset.description,
      runnerType: preset.runnerType,
      systemPrompt: preset.systemPrompt,
      userPromptTemplate: preset.userPromptTemplate,
      modelConfig: preset.modelConfig,
      endpointUrl: preset.endpointUrl,
      endpointMethod: preset.endpointMethod,
      endpointBodyTemplate: preset.endpointBodyTemplate,
    });
  }

  /**
   * Generate synthetic test cases using LLM
   */
  @Post('synthetic/generate')
  async generateSynthetic(@Body() request: SyntheticGenerationRequest) {
    return this.syntheticService.generateTestCases(request);
  }

  /**
   * Generate synthetic test cases and create a dataset from them
   */
  @Post('synthetic/dataset')
  async generateSyntheticDataset(
    @Body()
    body: SyntheticGenerationRequest & { name: string; description?: string },
  ) {
    // Generate test cases
    const testCases = await this.syntheticService.generateTestCases(body);

    // Create dataset
    const dataset = await this.datasetsService.create({
      name: body.name,
      description: body.description || `Synthetic ${body.style} dataset: ${body.topic}`,
    });

    // Add test cases
    for (const testCase of testCases) {
      await this.datasetsService.addTestCase(dataset.id, {
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        context: testCase.context,
      });
    }

    return this.datasetsService.findOne(dataset.id);
  }
}
