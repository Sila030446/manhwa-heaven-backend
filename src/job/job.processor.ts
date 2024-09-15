import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import puppeteer, { Browser } from 'puppeteer';
import { DatabaseService } from 'src/database/database.service';
import { startMakimaScraping } from 'src/scraping/makima-scraping';

@Processor('jobsQueue')
export class JobProcessor extends WorkerHost {
  constructor(private readonly databaseService: DatabaseService) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const BROWSER_WS =
      'wss://brd-customer-hl_4b56736d-zone-scraping_browser1:ar43hh80gv6r@brd.superproxy.io:9222';
    let browser: Browser | undefined = undefined;
    console.log(`Processing job ${job.id} with data:`, job.data);

    try {
      browser = await puppeteer.connect({
        browserWSEndpoint: BROWSER_WS,
      });
      const page = await browser.newPage();

      if (!job.data.url || !job.data.jobType) {
        throw new Error('Invalid job data: URL or jobType is missing');
      }

      if (job.data.jobType?.type === 'makima') {
        console.log('Connected! Navigate to ' + job.data.url);
        await page.goto(job.data.url);
        console.log('Navigated. Scraping page content...');
        const manga = await startMakimaScraping(page, job.data.url);
        console.log({
          'Manga title': manga.title,
          'Alternative title': manga.alternativeTitle,
          CoverImageUrl: manga.coverImageUrl,
          Description: manga.description,
          Author: manga.authors,
          Artist: manga.artist,
          Serialization: manga.serialization,
          Genres: manga.genres,
          Status: manga.status,
          Type: manga.type,
          Chapters: manga.chapters,
        });
      }

      await this.databaseService.job.update({
        where: { id: job.data.id },
        data: { isComplete: true, status: 'complete' },
      });
    } catch (error) {
      console.log('Failed to connect to browser:', error.message);

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

  public workerOptions = {
    concurrency: 10,
    removeOnComplete: {
      count: 1000,
    },
    removeOnFail: {
      count: 5000,
    },
  };
}
