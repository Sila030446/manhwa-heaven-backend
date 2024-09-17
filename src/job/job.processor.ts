import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import puppeteer, { Browser } from 'puppeteer';
import { DatabaseService } from 'src/database/database.service';
import {
  startMakimaScraping,
  scrapeChapterImages,
} from 'src/scraping/makima-scraping';
import { AwsService } from 'src/aws/aws.service';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
@Processor('jobsQueue')
export class JobProcessor extends WorkerHost {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly awsService: AwsService,
  ) {
    super();
  }

  // This method runs every 24 hours
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleScheduledJob() {
    console.log('Checking for updates...');

    // Fetch all jobs with status PENDING or COMPLETED
    const jobs = await this.databaseService.job.findMany({
      where: {
        status: 'complete',
      },
    });

    // Loop through each job and process it
    for (const job of jobs) {
      await this.databaseService.job.update({
        where: { id: job.id },
        data: { isComplete: false, status: 'updated' },
      });
      console.log(`Processing job for URL: ${job.url}`);
      await this.process({
        data: {
          id: job.id,
          url: job.url,
          jobType: { type: 'makima' },
        },
      } as Job<any>);
      await this.databaseService.job.update({
        where: { id: job.id },
        data: { isComplete: true, status: 'complete' },
      });
    }
  }

  async process(job: Job<any>): Promise<any> {
    let browser: Browser | undefined = undefined;

    try {
      browser = await puppeteer.launch();
      const page = await browser.newPage();

      if (!job.data.url || !job.data.jobType) {
        throw new Error('ข้อมูลงานไม่ถูกต้อง: URL หรือ jobType หายไป');
      }

      if (job.data.jobType?.type === 'makima') {
        console.log('เชื่อมต่อ! กำลังนำทางไปที่ ' + job.data.url);
        await page.goto(job.data.url);

        const manga = await startMakimaScraping(page, job.data.url);

        const existingManga = await this.databaseService.mangaManhwa.findUnique(
          {
            where: { slug: manga.titleSlug },
            include: { chapters: true },
          },
        );

        if (existingManga) {
          console.log('มังงะมีอยู่แล้ว');

          const existingChapterSlugs = existingManga.chapters.map(
            (chapter) => chapter.slug,
          );
          const newChapters = manga.chapters.filter(
            (chapter) =>
              !existingChapterSlugs.includes(
                `${manga.titleSlug}${chapter.slug}`,
              ),
          );

          console.log(`พบตอนใหม่จำนวน ${newChapters.length} ตอน`);

          if (newChapters.length > 0) {
            for (const [index, newChapter] of newChapters.reverse().entries()) {
              const createdChapter = await this.databaseService.chapter.create({
                data: {
                  chapterNumber: existingManga.chapters.length + index + 1,
                  title: newChapter.title || '',
                  slug: `${manga.titleSlug}${newChapter.slug}`,
                  urlScrape: newChapter.url,
                  mangaManhwa: { connect: { id: existingManga.id } },
                },
              });
              console.log(`ตอนใหม่ถูกบันทึก: ${createdChapter.slug}`);

              console.log(`กำลังดึงรูปภาพสำหรับตอน: ${createdChapter.slug}`);
              const imageUrls = await scrapeChapterImages(page, newChapter.url);

              // ใช้ Promise.all สำหรับการอัปโหลดพร้อมกัน
              await Promise.all(
                imageUrls.map(async (imageUrl, pageNumber) => {
                  try {
                    const uploadedImageUrl =
                      await this.awsService.uploadImageFromUrl(
                        imageUrl,
                        manga.title,
                        newChapter.title || `page-${pageNumber + 1}`,
                      );

                    await this.databaseService.page.create({
                      data: {
                        imageUrl: uploadedImageUrl,
                        pageNumber: pageNumber + 1,
                        chapter: { connect: { id: createdChapter.id } },
                      },
                    });

                    console.log(
                      `รูปภาพถูกบันทึกลง S3 และฐานข้อมูล: ${uploadedImageUrl}`,
                    );
                  } catch (error) {
                    console.error(
                      `เกิดข้อผิดพลาดในการอัปโหลดรูปภาพไปที่ S3: ${error.message}`,
                    );
                  }
                }),
              );
            }
          } else {
            console.log('ไม่พบตอนใหม่.');
          }

          return;
        }

        // ถ้ามังงะไม่เคยมีในฐานข้อมูล ให้บันทึกมังงะและตอนทั้งหมด
        console.log('มังงะใหม่, กำลังบันทึก...');

        const coverImageUrl = await this.awsService.uploadImageFromUrl(
          manga.coverImageUrl,
          manga.title,
          'cover',
        );
        const reversedChapters = manga.chapters.reverse();

        const savedManga = await this.databaseService.mangaManhwa.create({
          data: {
            title: manga.title,
            alternativeTitle: manga.alternativeTitle,
            slug: manga.titleSlug,
            description: manga.description,
            coverImageUrl: coverImageUrl,
            serialization: manga.serialization,
            releaseDate: new Date(),
            authors: {
              connectOrCreate: manga.authors.map((author) => ({
                where: { slug: author.slug },
                create: { name: author.name, slug: author.slug },
              })),
            },
            genres: {
              connectOrCreate: manga.genres.map((genre) => ({
                where: { slug: genre.slug },
                create: { name: genre.name, slug: genre.slug },
              })),
            },
            type: {
              connectOrCreate: manga.type.map((type) => ({
                where: { slug: type.slug },
                create: { name: type.name, slug: type.slug },
              })),
            },
            chapters: {
              create: reversedChapters.map((chapter, index) => ({
                chapterNumber: index + 1,
                title: chapter.title || '',
                slug: `${manga.titleSlug}${chapter.slug}`,
                urlScrape: chapter.url,
              })),
            },
          },
          include: { chapters: true },
        });

        console.log('มังงะถูกบันทึก:', savedManga);

        for (const chapter of savedManga.chapters) {
          console.log(`กำลังดึงรูปภาพสำหรับตอน: ${chapter.slug}`);
          const imageUrls = await scrapeChapterImages(page, chapter.urlScrape);

          // ใช้ Promise.all สำหรับการอัปโหลดพร้อมกัน
          await Promise.all(
            imageUrls.map(async (imageUrl, pageNumber) => {
              try {
                const uploadedImageUrl =
                  await this.awsService.uploadImageFromUrl(
                    imageUrl,
                    manga.title,
                    chapter.title || `page-${pageNumber + 1}`,
                  );

                await this.databaseService.page.create({
                  data: {
                    imageUrl: uploadedImageUrl,
                    pageNumber: pageNumber + 1,
                    chapter: { connect: { id: chapter.id } },
                  },
                });

                console.log(
                  `รูปภาพถูกบันทึกลง S3 และฐานข้อมูล: ${uploadedImageUrl}`,
                );
              } catch (error) {
                console.error(
                  `เกิดข้อผิดพลาดในการอัปโหลดรูปภาพไปที่ S3: ${error.message}`,
                );
              }
            }),
          );
        }
      }

      await this.databaseService.job.update({
        where: { id: job.data.id },
        data: { isComplete: true, status: 'complete' },
      });
    } catch (error) {
      console.log('เกิดข้อผิดพลาด:', error.message);

      await this.databaseService.job.update({
        where: { id: job.data.id },
        data: { isComplete: true, status: 'failed' },
      });
    } finally {
      if (browser) {
        await browser.close();
        console.log('เบราว์เซอร์ถูกปิดเรียบร้อยแล้ว.');
      }
    }
  }
}
