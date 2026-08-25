import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';

import { JobsService } from './jobs.service';
import { ListDeadLetterQueryDto } from '../files/dto/list-dead-letter-query.dto';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('dead-letter')
  async listDeadLetter(@Query() query: ListDeadLetterQueryDto) {
    return this.jobsService.listDeadLetter(query.limit);
  }

  @Post(':jobId/retry')
  async retryJob(@Param('jobId', new ParseUUIDPipe()) jobId: string) {
    return this.jobsService.retryJob(jobId);
  }
}
