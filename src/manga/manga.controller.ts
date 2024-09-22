import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { MangaService } from './manga.service';
import { MangaManhwa, Chapter } from '@prisma/client';

@Controller('manga')
export class MangaController {
  constructor(private readonly mangaService: MangaService) {}

  @Get('popular')
  async getPopularMangas(): Promise<MangaManhwa[]> {
    return this.mangaService.getPopularMangas();
  }

  @Get()
  async getAllMangas(): Promise<MangaManhwa[]> {
    return this.mangaService.getAllMangas();
  }

  @Get(':slug')
  async getManga(@Param('slug') slug: string): Promise<MangaManhwa | null> {
    return this.mangaService.getManga(slug);
  }

  @Get('pages/:slug')
  async getChapterPages(@Param('slug') slug: string): Promise<{
    currentChapter: Chapter | null;
    previousSlug: string | null;
    nextSlug: string | null;
    allChapters: { slug: string; title: string }[]; // Adjust this type based on your data structure
  }> {
    const { currentChapter, previousSlug, nextSlug, allChapters } =
      await this.mangaService.getChapterPages(slug);

    // Handle the case where the current chapter is not found
    if (!currentChapter) {
      throw new NotFoundException('Chapter not found');
    }

    return { currentChapter, previousSlug, nextSlug, allChapters };
  }
}
