import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

@Injectable()
export class makimaSearchService {
  private readonly logger = new Logger(makimaSearchService.name);

  async getSearchManga(searchParams: string) {
    let browser;
    try {
      // Launch browser with necessary settings
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      const url = `https://makimaaaaa.com/?s=${searchParams}`;
      this.logger.log(`Navigating to URL: ${url}`);

      // Go to the page and wait for network to be idle to ensure it’s fully loaded
      await page.goto(url);

      // Wait for the selector to ensure the content has loaded
      await page.waitForSelector(
        '#content > div.wrapper > div.postbody > div > div.listupd > div',
        {
          timeout: 10000,
        },
      );

      // Extract manga data
      const results = await page.evaluate(() => {
        const mangaElements = document.querySelectorAll(
          '#content > div.wrapper > div.postbody > div > div.listupd > div',
        );

        return Array.from(mangaElements).map((manga) => {
          const titleElement = manga.querySelector(
            'div > a > div.bigor > div.tt',
          );
          const urlElement = manga.querySelector('a');

          const title = titleElement?.textContent?.trim() || 'Title not found';
          const mangaUrl = urlElement?.getAttribute('href') || 'URL not found';

          return { title, mangaUrl };
        });
      });

      this.logger.log(`Scraping results: ${JSON.stringify(results)}`);
      return results;
    } catch (error) {
      // Log errors during the scraping process
      this.logger.error(`Error during scraping: ${error.message}`);
      return [];
    } finally {
      // Ensure the browser is closed even in case of an error
      if (browser) {
        await browser.close();
      }
    }
  }
}
