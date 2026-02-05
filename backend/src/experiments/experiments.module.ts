import { Module } from '@nestjs/common';
import { ExperimentsController } from './experiments.controller';
import { ExperimentsService } from './experiments.service';
import { DatasetsModule } from '../datasets/datasets.module';
import { GradersModule } from '../graders/graders.module';

@Module({
  imports: [DatasetsModule, GradersModule],
  controllers: [ExperimentsController],
  providers: [ExperimentsService],
})
export class ExperimentsModule {}
