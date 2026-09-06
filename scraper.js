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
 * Detects the specific sub-type of update based on title and context keywords
 */
function detectDetailedCategory(title, sectionName) {
  const lower = title.toLowerCase();

  if (lower.includes('typing') || lower.includes('skill test') || lower.includes('steno test') || lower.includes('pet') || lower.includes('pst') || lower.includes('physical test')) {
    return 'Typing / Skill / Physical Test';
  }
  if (lower.includes('extended') || lower.includes('last date extend') || lower.includes('date change') || lower.includes('reopened')) {
    return 'Date Extended / Reopen';
  }
  if (lower.includes('correction') || lower.includes('edit form') || lower.includes('modify form')) {
    return 'Form Correction Window';
  }
  if (lower.includes('postponed') || lower.includes('cancelled') || lower.includes('rescheduled') || lower.includes('exam date')) {
    return 'Exam Date Notice';
  }
  if (lower.includes('city') || lower.includes('admit') || lower.includes('call letter') || lower.includes('hall ticket') || lower.includes('status')) {
    return 'Admit Card / Exam City';
  }
  if (lower.includes('result') || lower.includes('marks') || lower.includes('score card') || lower.includes('merit list') || lower.includes('cutoff')) {
    return 'Exam Result / Cutoff';
  }
  if (lower.includes('answer key') || lower.includes('omr') || lower.includes('objection')) {
    return 'Answer Key / Objections';
  }
  if (lower.includes('syllabus') || lower.includes('exam pattern')) {
    return 'Syllabus & Exam Pattern';
  }
  if (lower.includes('admission') || lower.includes('entrance') || lower.includes('counseling') || lower.includes('seat allotment')) {
    return 'Admission & Counseling';
  }
  if (lower.includes('online form') || lower.includes('apply online') || lower.includes('recruitment') || lower.includes('vacancy') || lower.includes('jobs')) {
    return 'New Vacancy / Online Form';
  }

  return sectionName || 'Exam Update';
}

/**
 * Scrapes all sections from SarkariResult
 */
function parseSarkariResult($, baseUrl) {
  const updates = [];
  const seenUrls = new Set();

  // 1. Scrape all lists in .sarkari-quick-list (Result, Admit Card, Latest Job, Answer Key, Syllabus, Admission, Important)
  $('ul.sarkari-quick-list').each((_, ul) => {
    const parentContainer = $(ul).closest('div');
    const rawSection = parentContainer.find('h2, h3, h4, .box-title, strong, font').first().text().trim() || 'Exam Notice';

    $(ul).find('li a').each((_, a) => {
      const title = $(a).text().trim();
      let href = $(a).attr('href');

      if (!title || !href || href.startsWith('javascript') || href.length < 5) return;
      if (!href.startsWith('http')) {
        try { href = new URL(href, baseUrl).href; } catch(e) { return; }
      }

      if (seenUrls.has(href)) return;
      seenUrls.add(href);

      const category = detectDetailedCategory(title, rawSection);

      updates.push({
        id: generateNoticeId(title, href),
        title: title.replace(/\s+/g, ' '),
        link: href,
        category: category,
        rawSection: rawSection,
        foundAt: new Date().toISOString()
      });
    });
  });

  // 2. Scrape job-grid / job-box (Highlighted top vacancies)
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
      category: detectDetailedCategory(title, 'New Vacancy Highlight'),
      rawSection: 'Latest Job Highlight',
      foundAt: new Date().toISOString()
    });
  });

  // 3. Scrape breaking marquee announcements
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
      category: detectDetailedCategory(title, 'Breaking Notice'),
      rawSection: 'Breaking Announcement',
      foundAt: new Date().toISOString()
    });
  });

  return updates;
}

/**
 * Generic notice board scraper for colleges, boards, other sites
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
      lower.includes('answer') ||
      lower.includes('syllabus') ||
      lower.includes('typing') ||
      lower.includes('rpsc') ||
      lower.includes('rssb') ||
      lower.includes('railway') ||
      lower.includes('ssc') ||
      lower.includes('bank')
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
        category: detectDetailedCategory(text, 'Official Notice'),
        rawSection: 'General Notice',
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
      console.log(`[Scraper] Fetching all updates from ${targetUrl} (Attempt ${attempt}/${retries})...`);

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

      console.log(`[Scraper] Successfully extracted ${updates.length} comprehensive updates.`);
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
  generateNoticeId,
  detectDetailedCategory
};
