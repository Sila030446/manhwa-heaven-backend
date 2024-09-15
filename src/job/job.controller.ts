import {
  Controller,
  Get,
  Post,
  Body,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JobService } from './job.service';
import { Prisma } from '@prisma/client';

@Controller('job')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post()
  async create(@Body() createJobDto: Prisma.JobCreateInput) {
    try {
      const job = await this.jobService.createJob(createJobDto);
      return {
        jobCreated: true,
        job,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'An unexpected error occurred.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  async findAll() {
    try {
      return await this.jobService.findAllJobs();
    } catch (error) {
      throw new BadRequestException('Failed to fetch jobs', error);
    }
  }
}
