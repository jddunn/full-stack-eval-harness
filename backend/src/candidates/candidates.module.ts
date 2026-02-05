import { Module } from '@nestjs/common';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { CandidateRunnerService } from './candidate-runner.service';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [LlmModule],
  controllers: [CandidatesController],
  providers: [CandidatesService, CandidateRunnerService],
  exports: [CandidatesService, CandidateRunnerService],
})
export class CandidatesModule {}
