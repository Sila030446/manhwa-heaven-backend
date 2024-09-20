import { Page } from 'puppeteer';

interface MangaDetails {
  title: string;
  titleSlug: string;
  alternativeTitle?: string;
  coverImageUrl: string;
  description: string;
  authors: { name: string; slug: string }[];
  artist: { name: string; slug: string }[];
  serialization?: string;
  genres: { name: string; slug: string }[];
  type: { name: string; slug: string }[];
  status: { name: string; slug: string }[];
  chapters: { title?: string; url: string; slug: string }[];
}

// Function to scrape manga details
export const startReaperTransScraping = async (
  page: Page,
  url: string,
): Promise<MangaDetails> => {
  try {
    await page.goto(url, { waitUntil: 'networkidle2' });

    const manga = await page.evaluate(() => {
      const generateSlug = (text: string): string => {
        return text
          .toLowerCase()
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/[^\w-]+/g, ''); // Remove special characters
      };

      const title =
        document.querySelector(
          'div.bixbox.animefull > div.bigcontent > div.infox > h1',
        )?.textContent || 'Unknown Title';

      const titleSlug = generateSlug(title);

      const alternativeTitle =
        document.querySelector(
          'div.bigcontent > div.infox > div:nth-child(2) > span',
        )?.textContent || '';

      const coverImageUrl =
        document
          .querySelector('div.bigcontent > div.thumbook > div.thumb > img')
          ?.getAttribute('src') || '';

      const description =
        document.querySelector(
          'div.bigcontent > div.infox > div:nth-child(3) > div > p',
        )?.textContent || 'No description';

      const serialization =
        document.querySelector(
          'div.bigcontent > div.infox > div:nth-child(6) > div:nth-child(1) > span',
        )?.textContent || 'Unknown serialization';

      const getText = (selector: string) =>
        Array.from(document.querySelectorAll(selector)).map((el) => {
          const text = el.textContent || '';
          return { name: text, slug: generateSlug(text) };
        });

      const getGenres = (selector: string) =>
        Array.from(document.querySelectorAll(selector)).map((el) => {
          const name = el.textContent || '';
          const slug = (el.getAttribute('href') || '')
            .split('/')
            .slice(-2, -1)[0];
          return { name, slug };
        });

      const authors = getText(
        'div.bigcontent > div.infox > div:nth-child(4) > div:nth-child(2) > span',
      );
      const artist = getText(
        'div.bigcontent > div.infox > div:nth-child(5) > div > span',
      );

      const type = getText(
        'div.bigcontent > div.thumbook > div.rt > div.tsinfo > div:nth-child(2) > a',
      );
      const status = getText(
        'div.bigcontent > div.thumbook > div.rt > div.tsinfo > div:nth-child(1) > i',
      );
      const genres = getGenres(
        'div.bigcontent > div.infox > div:nth-child(8) > span > a:nth-child(1)',
      );

      const chapters = Array.from(
        document.querySelectorAll('#chapterlist > ul > li > div > div > a'),
      ).map((chapter) => {
        const chapterTitle = chapter
          .querySelector('span.chapternum')
          ?.textContent?.trim();
        const chapterSlug = generateSlug(chapterTitle || 'chapter-title');
        return {
          title: chapterTitle,
          url: chapter.getAttribute('href') || '',
          slug: chapterSlug, // Ensure chapter slug is unique
        };
      });

      return {
        title,
        titleSlug,
        alternativeTitle,
        coverImageUrl,
        description,
        authors,
        artist,
        serialization,
        type,
        status,
        genres,
        chapters,
      };
    });

    return manga;
  } catch (error) {
    console.error('Error during scraping:', error.message);
    throw error; // Re-throw the error for higher-level handling
  }
};

// Function to scrape chapter images from the given chapter URL
export const scrapeChapterImages = async (
  page: Page,
  chapterUrl: string,
): Promise<string[]> => {
  const MAX_RETRIES = 100;
  const RETRY_DELAY = 20000; // milliseconds

  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      await page.goto(chapterUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      // Scroll to the bottom to ensure lazy-loaded images are triggered
      await autoScroll(page);

      // Wait for all images to load
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll('#readerarea > img')).every(
          (img) => {
            const image = img as HTMLImageElement;
            return image.complete && image.naturalHeight > 0;
          },
        ),
      );

      // Extract image URLs
      const imageUrls = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#readerarea > img')).map(
          (img) => {
            const image = img as HTMLImageElement;
            // Use data-src if present, otherwise fall back to src
            return (
              image.getAttribute('data-src') || image.getAttribute('src') || ''
            );
          },
        );
      });

      return imageUrls.filter((url) => url); // Filter out empty URLs
    } catch (error) {
      console.error('Error during scraping chapter images:', error.message);

      retries += 1;
      if (retries >= MAX_RETRIES) {
        throw error; // Re-throw the error after max retries
      }

      console.log(
        `Retrying in ${RETRY_DELAY}ms... (${retries}/${MAX_RETRIES})`,
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
  }

  return []; // Return empty array if all retries fail
};

// Helper function to scroll to the bottom of the page
const autoScroll = async (page: Page) => {
  await page.evaluate(async () => {
    const distance = 100; // Distance to scroll each time
    const delay = 100; // Delay between scrolls
    const scrollHeight = document.body.scrollHeight;
    let previousScrollTop = 0;

    while (document.body.scrollTop + window.innerHeight < scrollHeight) {
      window.scrollBy(0, distance);
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Break the loop if no further scrolling is detected
      if (document.body.scrollTop === previousScrollTop) {
        break;
      }
      previousScrollTop = document.body.scrollTop;
    }
  });
};
