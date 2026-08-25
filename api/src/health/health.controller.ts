import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';

import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  async check() {
    const health = await this.healthService.check();

    if (health.status === 'degraded') {
      throw new HttpException(health, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return health;
  }
}
