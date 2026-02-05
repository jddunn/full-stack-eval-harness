import { Module } from '@nestjs/common';
import { GradersController } from './graders.controller';
import { GradersService } from './graders.service';

@Module({
  controllers: [GradersController],
  providers: [GradersService],
  exports: [GradersService],
})
export class GradersModule {}
