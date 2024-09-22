import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { makimaSearchModule } from './makimaSearch/makimaSearch.module';
import { JobModule } from './job/job.module';
import { DatabaseModule } from './database/database.module';
import { BullModule } from '@nestjs/bullmq';
import { AwsService } from './aws/aws.service';
import { AwsModule } from './aws/aws.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { MangaModule } from './manga/manga.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true, // Make the config module available globally
    }),
    AwsModule,
    makimaSearchModule,
    JobModule,
    DatabaseModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => ({
        connection: {
          host: 'redis',
          port: 6379,
          maxRetriesPerRequest: null,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'jobsQueue',
    }),
    MangaModule,
  ],
  controllers: [AppController],
  providers: [AppService, AwsService],
})
export class AppModule {}
