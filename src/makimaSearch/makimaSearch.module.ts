import { Module } from '@nestjs/common';
import { MangaController } from './makimaSearch.controller';
import { makimaSearchService } from './makimaSearch.service';

@Module({
  controllers: [MangaController],
  providers: [makimaSearchService],
})
export class makimaSearchModule {}
