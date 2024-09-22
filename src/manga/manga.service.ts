import { Injectable } from '@nestjs/common';
import { Chapter, MangaManhwa } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class MangaService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Retrieves a list of all mangas, including their associated chapters.
   *
   * @return {Promise<MangaManhwa[]>} A promise resolving to an array of manga data.
   */
  async getAllMangas(): Promise<MangaManhwa[]> {
    return this.db.mangaManhwa.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        type: true,
        chapters: {
          orderBy: {
            chapterNumber: 'desc',
          },
          take: 2,
        },
      },
    });
  }

  /**
   * Retrieves a manga by its slug and increments its view count if it exists.
   *
   * @param {string} slug - The slug of the manga.
   * @return {Promise<MangaManhwa | null>} The manga with the updated view count, or null if the manga does not exist.
   */
  async getManga(slug: string): Promise<MangaManhwa | null> {
    const manga = await this.db.mangaManhwa.findUnique({
      where: { slug },
      include: {
        type: true,
        authors: true,
        genres: true,
        ratings: true,
        comments: true,
        chapters: {
          orderBy: {
            chapterNumber: 'desc',
          },
        },
      },
    });

    if (manga) {
      await this.db.mangaManhwa.update({
        where: { slug },
        data: {
          viewCount: manga.viewCount + 1,
        },
      });
    }

    return manga;
  }

  /**
   * Retrieves the chapter pages for a given slug.
   *
   * @param {string} slug - The slug of the chapter.
   * @return {Promise<{
   *   currentChapter: Chapter | null;
   *   previousSlug: string | null;
   *   nextSlug: string | null;
   *   allChapters: { slug: string; title: string }[];
   * }>} An object containing the current chapter, the previous chapter slug, the next chapter slug, and an array of all chapters for the manga.
   */
  async getChapterPages(slug: string): Promise<{
    currentChapter: Chapter | null;
    previousSlug: string | null;
    nextSlug: string | null;
    allChapters: { slug: string; title: string }[];
  }> {
    const currentChapter = await this.db.chapter.findUnique({
      where: { slug },
      include: {
        pages: {
          orderBy: {
            pageNumber: 'asc',
          },
        },
      },
    });

    if (!currentChapter) {
      return {
        currentChapter: null,
        previousSlug: null,
        nextSlug: null,
        allChapters: [],
      };
    }

    const previousChapter = await this.getAdjacentChapter(
      currentChapter.mangaManhwaId,
      currentChapter.id,
      'lt',
    );
    const nextChapter = await this.getAdjacentChapter(
      currentChapter.mangaManhwaId,
      currentChapter.id,
      'gt',
    );

    const allChapters = await this.db.chapter.findMany({
      where: { mangaManhwaId: currentChapter.mangaManhwaId },
      select: {
        slug: true,
        title: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    return {
      currentChapter,
      previousSlug: previousChapter?.slug || null,
      nextSlug: nextChapter?.slug || null,
      allChapters,
    };
  }

  private async getAdjacentChapter(
    mangaId: number,
    chapterId: number,
    operator: 'lt' | 'gt',
  ) {
    return this.db.chapter.findFirst({
      where: {
        mangaManhwaId: mangaId,
        id: {
          [operator]: chapterId,
        },
      },
      orderBy: {
        id: operator === 'lt' ? 'desc' : 'asc',
      },
      select: {
        slug: true,
      },
    });
  }

  /**
   * Retrieves a list of the 5 most popular mangas, ordered by view count in descending order.
   *
   * @return {Promise<any[]>} A list of manga objects, including their average rating.
   */
  async getPopularMangas(): Promise<any[]> {
    const popularMangas = await this.db.mangaManhwa.findMany({
      include: {
        ratings: true,
        type: true,
        genres: true,
        authors: true,
      },
      orderBy: {
        viewCount: 'desc',
      },
      take: 5,
    });

    return popularMangas.map((manga) => {
      const ratingsCount = manga.ratings.length;
      const avgRating =
        ratingsCount > 0
          ? manga.ratings.reduce((sum, rating) => sum + rating.score, 0) /
            ratingsCount
          : 0;

      return {
        ...manga,
        avgRating: Math.min(Math.max(avgRating, 0), 10),
      };
    });
  }
}
