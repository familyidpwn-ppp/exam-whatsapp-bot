const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
  'Upgrade-Insecure-Requests': '1'
};

function generateNoticeId(title, link) {
  const hash = crypto.createHash('sha256');
  hash.update((link || '').trim().toLowerCase() + '|' + (title || '').trim().toLowerCase());
  return hash.digest('hex').substring(0, 16);
}

/**
 * Scrapes SarkariResult with accurate section matching
 */
function parseSarkariResult($, baseUrl) {
  const updates = [];
  const seenUrls = new Set();

  // 1. Scrape all lists in .sarkari-quick-list
  $('ul.sarkari-quick-list').each((_, ul) => {
    // Find category from section title
    const parentContainer = $(ul).closest('div');
    let category = parentContainer.find('h2, h3, h4, .box-title, strong, font').first().text().trim() || 'Exam Update';

    $(ul).find('li a').each((_, a) => {
      const title = $(a).text().trim();
      let href = $(a).attr('href');

      if (!title || !href || href.startsWith('javascript') || href.length < 5) return;
      if (!href.startsWith('http')) {
        try { href = new URL(href, baseUrl).href; } catch(e) { return; }
      }

      if (seenUrls.has(href)) return;
      seenUrls.add(href);

      updates.push({
        id: generateNoticeId(title, href),
        title: title.replace(/\s+/g, ' '),
        link: href,
        category: category,
        foundAt: new Date().toISOString()
      });
    });
  });

  // 2. Scrape job-grid / job-box
  $('.job-box a, .job-grid a').each((_, a) => {
    const title = $(a).text().trim();
    let href = $(a).attr('href');
    if (!title || !href || href.startsWith('javascript') || href.length < 5) return;
    if (!href.startsWith('http')) {
      try { href = new URL(href, baseUrl).href; } catch(e) { return; }
    }
    if (seenUrls.has(href)) return;
    seenUrls.add(href);

    updates.push({
      id: generateNoticeId(title, href),
      title: title.replace(/\s+/g, ' '),
      link: href,
      category: 'Latest Job Highlight',
      foundAt: new Date().toISOString()
    });
  });

  // 3. Scrape breaking marquee
  $('marquee a').each((_, a) => {
    const title = $(a).text().trim();
    let href = $(a).attr('href');
    if (!title || !href || href.startsWith('javascript') || href.length < 5) return;
    if (!href.startsWith('http')) {
      try { href = new URL(href, baseUrl).href; } catch(e) { return; }
    }
    if (seenUrls.has(href)) return;
    seenUrls.add(href);

    updates.push({
      id: generateNoticeId(title, href),
      title: title.replace(/\s+/g, ' '),
      link: href,
      category: 'Breaking Update',
      foundAt: new Date().toISOString()
    });
  });

  return updates;
}

/**
 * Generic scraper for other notice boards
 */
function parseGenericNoticeBoard($, baseUrl) {
  const updates = [];
  const seen = new Set();

  $('a').each((_, el) => {
    const text = $(el).text().trim();
    let href = $(el).attr('href');
    if (!href || href.startsWith('javascript') || href.length < 5 || text.length < 6) return;

    const lower = text.toLowerCase();
    if (
      lower.includes('exam') ||
      lower.includes('admit') ||
      lower.includes('result') ||
      lower.includes('notice') ||
      lower.includes('recruitment') ||
      lower.includes('rpsc') ||
      lower.includes('rssb') ||
      lower.includes('rsmssb') ||
      lower.includes('railway') ||
      lower.includes('rrb') ||
      lower.includes('ssc') ||
      lower.includes('bank') ||
      lower.includes('ibps') ||
      lower.includes('sbi')
    ) {
      if (!href.startsWith('http')) {
        try { href = new URL(href, baseUrl).href; } catch(e) { return; }
      }
      if (seen.has(href)) return;
      seen.add(href);

      updates.push({
        id: generateNoticeId(text, href),
        title: text.replace(/\s+/g, ' '),
        link: href,
        category: 'Exam Notice',
        foundAt: new Date().toISOString()
      });
    }
  });

  return updates;
}

async function fetchExamUpdates(targetUrl, retries = 3) {
  let attempt = 0;

  while (attempt < retries) {
    try {
      attempt++;
      console.log(`[Scraper] Fetching updates from ${targetUrl} (Attempt ${attempt}/${retries})...`);

      const response = await axios.get(targetUrl, {
        headers: HEADERS,
        timeout: 15000,
        maxRedirects: 5
      });

      const $ = cheerio.load(response.data);
      let updates = [];

      if (targetUrl.includes('sarkariresult')) {
        updates = parseSarkariResult($, targetUrl);
      } else {
        updates = parseGenericNoticeBoard($, targetUrl);
      }

      console.log(`[Scraper] Successfully extracted ${updates.length} updates.`);
      return updates;
    } catch (err) {
      console.error(`[Scraper] Error fetching ${targetUrl}: ${err.message}`);
      if (attempt >= retries) return [];
      await new Promise((res) => setTimeout(res, 2000 * attempt));
    }
  }

  return [];
}

module.exports = {
  fetchExamUpdates,
  generateNoticeId
};
