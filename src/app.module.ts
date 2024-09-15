import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MangaModule } from './manga/manga.module';
import { JobModule } from './job/job.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [MangaModule, JobModule, DatabaseModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
