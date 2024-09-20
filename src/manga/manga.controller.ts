import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { MangaService } from './manga.service';

@Controller('manga')
export class MangaController {
  constructor(private readonly mangaService: MangaService) {}

  @Get()
  async findAll(@Query('page') page: string, @Query('limit') limit: string) {
    try {
      const pageNumber = parseInt(page, 10) || 1; // Default to page 1
      const limitNumber = parseInt(limit, 10) || 12; // Default to limit 12

      // Validate the page and limit numbers
      if (pageNumber < 1) {
        throw new BadRequestException('Page number must be greater than 0');
      }
      if (limitNumber < 1) {
        throw new BadRequestException('Limit must be greater than 0');
      }

      const mangaList = await this.mangaService.findAll(
        pageNumber,
        limitNumber,
      );
      return mangaList;
    } catch (error) {
      throw new NotFoundException('Manga list could not be retrieved', error);
    }
  }

  @Get('popular')
  async findPopular() {
    const mangaList = await this.mangaService.findPopular();
    return mangaList;
  }

  @Get(':mangaSlug')
  async findOne(@Param('mangaSlug') mangaSlug: string) {
    const manga = await this.mangaService.findOne(mangaSlug);
    if (!manga) {
      throw new NotFoundException(`Manga with slug "${mangaSlug}" not found`);
    }
    return manga;
  }

  @Get('chapter/:chapterSlug')
  async findPageChapter(@Param('chapterSlug') chapterSlug: string) {
    const chapter = await this.mangaService.findChapter(chapterSlug);
    if (!chapter) {
      throw new NotFoundException(
        `Chapter with slug "${chapterSlug}" not found`,
      );
    }
    return chapter;
  }
}
