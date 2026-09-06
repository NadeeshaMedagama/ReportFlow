import { Module } from '@nestjs/common';
import { DashboardModule } from '../dashboard/dashboard.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [DashboardModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
