import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  /** Simple liveness endpoint used by deployment platforms and the web app. */
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'weekly-report-api', time: new Date().toISOString() };
  }
}
