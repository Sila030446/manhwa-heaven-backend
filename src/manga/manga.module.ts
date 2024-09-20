import { Module } from '@nestjs/common';
import { MangaService } from './manga.service';
import { MangaController } from './manga.controller';

@Module({
  controllers: [MangaController],
  providers: [MangaService],
})
export class MangaModule {}
