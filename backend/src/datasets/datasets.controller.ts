import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
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

  // Test case endpoints nested under dataset
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
}
