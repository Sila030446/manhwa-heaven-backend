import { Controller, Get, Query } from '@nestjs/common';
import { makimaSearchService } from './makimaSearch.service';

@Controller('makima')
export class MangaController {
  constructor(private readonly mangaService: makimaSearchService) {}

  @Get('search')
  async searchManga(
    @Query('q') searchParams: string,
  ): Promise<makimaSearchService> {
    return this.mangaService.getSearchManga(searchParams);
  }
}
