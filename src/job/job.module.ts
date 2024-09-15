import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobService } from './job.service';
import { JobController } from './job.controller';
import { JobProcessor } from './job.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'jobsQueue',
    }),
  ],
  controllers: [JobController],
  providers: [JobService, JobProcessor], // เพิ่ม JobProcessor เข้าไปใน providers
})
export class JobModule {}
