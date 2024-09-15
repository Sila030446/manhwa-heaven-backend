// job.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('jobsQueue')
export class JobProcessor extends WorkerHost {
  async process(job: Job<any>): Promise<any> {
    // ประมวลผล job ที่นี่
    console.log(`Processing job ${job.id} with data:`, job.data);
    console.log(job);
    // ใส่ logic การประมวลผลของคุณที่นี่
  }

  // ตั้งค่าตัวเลือกสำหรับ Worker
  public workerOptions = {
    concurrency: 10,
    removeOnComplete: {
      count: 1000,
    },
    removeOnFail: {
      count: 5000,
    },
  };
}
