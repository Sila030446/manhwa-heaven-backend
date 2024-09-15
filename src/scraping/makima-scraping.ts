import { Page } from 'puppeteer';

interface MangaDetails {
  title: string;
  alternativeTitle?: string;
  coverImageUrl: string;
  description: string;
  authors: { name: string; slug: string }[];
  artist: { name: string; slug: string }[];
  serialization: { name: string; slug: string }[];
  genres: { name: string; slug: string }[];
  type: { name: string; slug: string }[];
  status: { name: string; slug: string }[];
  chapters: { title?: string; url: string }[]; // เพิ่ม chapters เป็นอาเรย์ของอ็อบเจ็กต์
}

export const startMakimaScraping = async (
  page: Page,
  url: string, // รับ URL เป็นพารามิเตอร์
): Promise<MangaDetails> => {
  try {
    // ไปยัง URL ที่กำหนด
    await page.goto(url, { waitUntil: 'networkidle2' }); // เพิ่ม waitUntil เพื่อรอให้หน้าทั้งหมดโหลดเสร็จ

    // ดึงข้อมูลทั้งหมดจากหน้าเพจ
    const manga = await page.evaluate(() => {
      const title =
        document.querySelector('#titlemove > h1')?.textContent ||
        'Unknown Title';
      const alternativeTitle =
        document.querySelector('#titlemove > span')?.textContent || '';
      const coverImageUrl =
        document
          .querySelector(
            'div.main-info > div.info-left > div > div.thumb > img',
          )
          ?.getAttribute('src') || '';
      const descriptionElement = document.querySelector(
        'div.entry-content.entry-content-single[itemprop="description"]',
      );

      // ถ้าเจอ div ที่ต้องการ ก็รวมข้อความจากทุก <p> แท็ก
      const description = descriptionElement
        ? Array.from(descriptionElement.querySelectorAll('p'))
            .map((p) => p.textContent?.trim() || '')
            .join(' ')
        : 'No description';

      const getText = (selector: string) =>
        Array.from(document.querySelectorAll(selector)).map((el) => {
          const text = el.textContent || '';
          return {
            name: text,
            slug: text.toLowerCase().replace(/\s+/g, '-'),
          };
        });

      const getGenres = (selector: string) =>
        Array.from(document.querySelectorAll(selector)).map((el) => {
          const name = el.textContent || '';
          const slug = (el.getAttribute('href') || '')
            .split('/')
            .slice(-2, -1)[0]; // ดึง slug จาก href
          return {
            name,
            slug,
          };
        });

      const authors = getText(
        'div.main-info > div.info-left > div > div.tsinfo.bixbox > div:nth-child(4) > i',
      );

      const artist = getText(
        'div.main-info > div.info-left > div > div.tsinfo.bixbox > div:nth-child(5) > i',
      );

      const serialization = getText(
        'div.main-info > div.info-left > div > div.tsinfo.bixbox > div:nth-child(6) > i',
      );

      const type = getText(
        'div.main-info > div.info-left > div > div.tsinfo.bixbox > div:nth-child(2) > a',
      );

      const status = getText(
        'div.main-info > div.info-left > div > div.tsinfo.bixbox > div:nth-child(1) > i',
      );

      const genres = getGenres('span.mgen > a');

      const chapters = Array.from(
        document.querySelectorAll('#chapterlist > ul > li > div > div > a'),
      ).map((chapter) => ({
        title: chapter.querySelector('span.chapternum')?.textContent?.trim(),
        url: chapter.getAttribute('href') || '',
      }));

      return {
        title,
        alternativeTitle,
        coverImageUrl,
        description,
        authors,
        artist,
        serialization,
        type,
        status,
        genres,
        chapters, // เพิ่ม chapters ในการคืนค่า
      };
    });

    return manga;
  } catch (error) {
    console.error('Error during scraping:', error.message); // log ข้อความ error
    throw error; // ให้ throw error ออกไปเพื่อให้เรียกใช้ฟังก์ชันรู้ว่ามีข้อผิดพลาดเกิดขึ้น
  }
};
