import { Controller, Post, Body } from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post('run-customer-job')
  async runCustomerJob(
    @Body() body: { customerId: string; filePath: string; fileName: string; supplierFilePath: string },
  ) {
    const { customerId, filePath, fileName, supplierFilePath } = body;
    await this.jobsService.addCustomerJob(customerId, filePath, fileName, supplierFilePath);
    return { message: 'Job aggiunto alla coda' };
  }
}
