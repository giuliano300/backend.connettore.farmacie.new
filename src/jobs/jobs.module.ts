import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { JobsService } from './jobs.service';
import { JobsProcessor } from './jobs.processor';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT ?? '6379'),
      },
    }),
    BullModule.registerQueue({
      name: 'customer-jobs',
    }),
  ],
  providers: [JobsService, JobsProcessor],
  exports: [JobsService],
})
export class JobsModule {}
