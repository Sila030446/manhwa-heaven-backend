import { Controller, Get, Query } from '@nestjs/common';
import { MangaService } from './manga.service';

@Controller('manga')
export class MangaController {
  constructor(private readonly mangaService: MangaService) {}

  @Get('search')
  async searchManga(@Query('q') searchParams: string): Promise<MangaService> {
    return this.mangaService.getSearchManga(searchParams);
  }
}
