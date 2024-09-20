import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class MangaService {
  private readonly logger = new Logger(MangaService.name);

  constructor(private readonly db: DatabaseService) {}

  async findAll(page: number = 1, limit: number = 12) {
    try {
      // Validate the page and limit
      if (page < 1) {
        throw new BadRequestException('Page number must be greater than 0');
      }
      if (limit < 1) {
        throw new BadRequestException('Limit must be greater than 0');
      }

      const skip = (page - 1) * limit;

      const mangaList = await this.db.mangaManhwa.findMany({
        skip: skip,
        take: limit,
        orderBy: {
          updatedAt: 'desc',
        },
        include: {
          chapters: {
            take: 3,
            orderBy: {
              chapterNumber: 'desc',
            },
          },
        },
      });

      if (!mangaList || mangaList.length === 0) {
        throw new NotFoundException('No manga found');
      }

      return mangaList;
    } catch (error) {
      this.logger.error('Error retrieving manga list', error.stack);
      throw new NotFoundException('Failed to retrieve manga list');
    }
  }

  async findOne(slug: string) {
    try {
      const manga = await this.db.mangaManhwa.findUnique({
        where: { slug },
        include: {
          genres: true,
          authors: true,
          type: true,
          chapters: {
            orderBy: {
              chapterNumber: 'desc',
            },
          },
        },
      });
      if (!manga) {
        throw new NotFoundException(`Manga with slug "${slug}" not found`);
      }
      return manga;
    } catch (error) {
      this.logger.error(`Error finding manga with slug "${slug}"`, error.stack);
      throw new NotFoundException(
        `Failed to retrieve manga with slug "${slug}"`,
      );
    }
  }

  async findChapter(chapterSlug: string) {
    try {
      const chapter = await this.db.chapter.findUnique({
        where: { slug: chapterSlug },
        include: {
          pages: {
            orderBy: {
              pageNumber: 'asc',
            },
          },
        },
      });

      if (!chapter) {
        throw new NotFoundException(`ไม่พบบทที่มี slug "${chapterSlug}"`);
      }

      // ดึงข้อมูลบทก่อนหน้า
      const prevChapter = await this.db.chapter.findFirst({
        where: {
          mangaManhwaId: chapter.mangaManhwaId, // สมมติว่าบทเชื่อมโยงกับมังงะ
          chapterNumber: {
            lt: chapter.chapterNumber, // หา chapter ที่มี chapterNumber น้อยกว่า
          },
        },
        orderBy: {
          chapterNumber: 'desc', // ให้ได้บทล่าสุดก่อนหน้า
        },
      });

      // ดึงข้อมูลบทถัดไป
      const nextChapter = await this.db.chapter.findFirst({
        where: {
          mangaManhwaId: chapter.mangaManhwaId,
          chapterNumber: {
            gt: chapter.chapterNumber, // หา chapter ที่มี chapterNumber มากกว่า
          },
        },
        orderBy: {
          chapterNumber: 'asc', // ให้ได้บทถัดไปที่ใกล้ที่สุด
        },
      });

      return {
        ...chapter,
        prevChapterSlug: prevChapter?.slug || null, // เพิ่ม slug ของบทก่อนหน้า หรือ null ถ้าไม่มี
        nextChapterSlug: nextChapter?.slug || null, // เพิ่ม slug ของบทถัดไป หรือ null ถ้าไม่มี
      };
    } catch (error) {
      this.logger.error(
        `เกิดข้อผิดพลาดในการค้นหาบทที่มี slug "${chapterSlug}"`,
        error.stack,
      );
      throw new NotFoundException(
        `ล้มเหลวในการดึงข้อมูลบทที่มี slug "${chapterSlug}"`,
      );
    }
  }

  async findPopular() {
    try {
      // Fetch manga with ratings and calculate the average score
      const mangaList = await this.db.mangaManhwa.findMany({
        include: {
          genres: true,
          type: true,
          authors: true,
          ratings: true, // Include all ratings for aggregation
        },
      });

      // Calculate the average rating for each manga
      const sortedMangaList = mangaList
        .map((manga) => {
          const totalRatings = manga.ratings.length;
          const averageRating =
            totalRatings > 0
              ? manga.ratings.reduce((acc, rating) => acc + rating.score, 0) /
                totalRatings
              : 0;
          return { ...manga, averageRating }; // Add the average rating to each manga object
        })
        .sort((a, b) => b.averageRating - a.averageRating) // Sort by average rating (descending)
        .slice(0, 5); // Limit to top 5 popular manga

      return sortedMangaList;
    } catch (error) {
      this.logger.error('Error retrieving popular manga', error.stack);
      throw new NotFoundException('Failed to retrieve popular manga');
    }
  }
}
