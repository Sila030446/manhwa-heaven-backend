import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class JobService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Method to create a job
  async createJob(createJobDto: Prisma.JobCreateInput) {
    try {
      return await this.databaseService.job.create({
        data: createJobDto,
      });
    } catch (error) {
      throw new HttpException(
        `Failed to create job: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Method to find all jobs and count ongoing jobs
  async findAllJobs() {
    try {
      const jobs = await this.databaseService.job.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      });

      const onGoingJobsCount = await this.databaseService.job.count({
        where: {
          isComplete: false,
        },
      });

      return {
        jobs,
        onGoingJobsCount,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve jobs: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
