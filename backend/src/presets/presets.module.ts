import { Module } from '@nestjs/common';
import { PresetsController } from './presets.controller';
import { DatasetsModule } from '../datasets/datasets.module';
import { GradersModule } from '../graders/graders.module';
import { LlmModule } from '../llm/llm.module';
import { SyntheticService } from './synthetic.service';

@Module({
  imports: [DatasetsModule, GradersModule, LlmModule],
  controllers: [PresetsController],
  providers: [SyntheticService],
})
export class PresetsModule {}
