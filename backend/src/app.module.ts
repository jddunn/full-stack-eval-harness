import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/db.module';
import { DatasetsModule } from './datasets/datasets.module';
import { GradersModule } from './graders/graders.module';
import { ExperimentsModule } from './experiments/experiments.module';
import { LlmModule } from './llm/llm.module';
import { PresetsModule } from './presets/presets.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    LlmModule,
    DatasetsModule,
    GradersModule,
    ExperimentsModule,
    PresetsModule,
    SettingsModule,
  ],
})
export class AppModule {}
