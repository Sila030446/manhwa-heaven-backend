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
      console.log(`Processing job for URL: ${job.url}`);
      await this.process({
        data: {
          id: job.id,
          url: job.url,
          jobType: { type: 'makima' },
        },
      } as Job<any>);
    }
  }

  async process(job: Job<any>): Promise<any> {
    let browser: Browser | undefined = undefined;

    try {
      browser = await puppeteer.launch();
      const page = await browser.newPage();

      if (!job.data.url || !job.data.jobType) {
        throw new Error('Invalid job data: URL or jobType is missing');
      }

      if (job.data.jobType?.type === 'makima') {
        console.log('Connected! Navigate to ' + job.data.url);
        await page.goto(job.data.url);

        const manga = await startMakimaScraping(page, job.data.url);

        const existingManga = await this.databaseService.mangaManhwa.findUnique(
          {
            where: { slug: manga.titleSlug },
            include: { chapters: true }, // Include chapters for comparison
          },
        );

        if (existingManga) {
          console.log('Manga already exists');

          // Extract existing chapter slugs for comparison
          const existingChapterSlugs = existingManga.chapters.map(
            (chapter) => chapter.slug,
          );

          // Filter new chapters by checking if their slugs exist in the database
          const newChapters = manga.chapters.filter(
            (chapter) =>
              !existingChapterSlugs.includes(
                `${manga.titleSlug}${chapter.slug}`,
              ),
          );

          console.log(`Found ${newChapters.length} new chapters`);

          if (newChapters.length > 0) {
            // Save new chapters
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
              console.log(`New chapter saved: ${createdChapter.slug}`);

              // Scrape images for the new chapter
              console.log(
                `Scraping images for chapter: ${createdChapter.slug}`,
              );
              const imageUrls = await scrapeChapterImages(page, newChapter.url);

              let pageNumber = 1;
              for (const imageUrl of imageUrls) {
                try {
                  const uploadedImageUrl =
                    await this.awsService.uploadImageFromUrl(
                      imageUrl,
                      manga.title,
                      newChapter.title || `page-${pageNumber}`,
                    );

                  await this.databaseService.page.create({
                    data: {
                      imageUrl: uploadedImageUrl,
                      pageNumber: pageNumber++,
                      chapter: { connect: { id: createdChapter.id } },
                    },
                  });

                  console.log(
                    `Image saved to S3 and database: ${uploadedImageUrl}`,
                  );
                } catch (error) {
                  console.error(
                    `Error uploading image to S3: ${error.message}`,
                  );
                }
              }
            }
          } else {
            console.log('No new chapters found.');
          }

          return;
        }

        // If manga doesn't exist, save it and all chapters
        console.log('New manga, saving...');

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

        console.log('Manga saved:', savedManga);

        for (const chapter of savedManga.chapters) {
          console.log(`Scraping images for chapter: ${chapter.slug}`);
          const imageUrls = await scrapeChapterImages(page, chapter.urlScrape);

          let pageNumber = 1;
          for (const imageUrl of imageUrls) {
            try {
              const uploadedImageUrl = await this.awsService.uploadImageFromUrl(
                imageUrl,
                manga.title,
                chapter.title || `page-${pageNumber}`,
              );

              await this.databaseService.page.create({
                data: {
                  imageUrl: uploadedImageUrl,
                  pageNumber: pageNumber++,
                  chapter: { connect: { id: chapter.id } },
                },
              });

              console.log(
                `Image saved to S3 and database: ${uploadedImageUrl}`,
              );
            } catch (error) {
              console.error(`Error uploading image to S3: ${error.message}`);
            }
          }
        }
      }

      await this.databaseService.job.update({
        where: { id: job.data.id },
        data: { isComplete: true, status: 'complete' },
      });
    } catch (error) {
      console.log('Error:', error.message);

      await this.databaseService.job.update({
        where: { id: job.data.id },
        data: { isComplete: true, status: 'failed' },
      });
    } finally {
      if (browser) {
        await browser.close();
        console.log('Browser closed successfully.');
      }
    }
  }
}
