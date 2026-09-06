const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
  'Upgrade-Insecure-Requests': '1'
};

const OFFICIAL_GOV_PORTALS = {
  'SSC': 'https://ssc.gov.in',
  'Railway': 'https://rrbcdg.gov.in',
  'RPSC & RSSB': 'https://rpsc.rajasthan.gov.in',
  'Banking': 'https://ibps.in'
};

function generateNoticeId(title, link) {
  const hash = crypto.createHash('sha256');
  hash.update((link || '').trim().toLowerCase() + '|' + (title || '').trim().toLowerCase());
  return hash.digest('hex').substring(0, 16);
}

/**
 * Removes any third-party/aggregator branding from titles
 */
function cleanTitle(rawTitle) {
  return rawTitle
    .replace(/sarkari\s*result[s]?(\.com)?/gi, '')
    .replace(/\|\s*sarkari\s*result/gi, '')
    .replace(/www\.sarkariresult\.com/gi, '')
    .replace(/[|:-]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts official government link from detail page (Apply online, Notification PDF, Official site)
 */
async function extractOfficialGovLink(detailUrl, channelCategory) {
  const fallback = OFFICIAL_GOV_PORTALS[channelCategory] || 'https://www.india.gov.in';

  if (!detailUrl || !detailUrl.includes('sarkariresult')) {
    return detailUrl || fallback;
  }

  try {
    const res = await axios.get(detailUrl, { headers: HEADERS, timeout: 8000 });
    const $ = cheerio.load(res.data);
    let officialLink = null;
    let officialWebsite = null;
    let pdfLink = null;

    $('table tr').each((_, tr) => {
      const label = $(tr).find('td').first().text().trim().toLowerCase();
      const href = $(tr).find('a').attr('href');
      if (!href || href.startsWith('javascript') || href.includes('sarkariresult.com') || href.includes('t.me') || href.includes('play.google.com')) return;

      if (label.includes('apply online') || label.includes('download admit') || label.includes('download result') || label.includes('answer key')) {
        if (!officialLink) officialLink = href;
      } else if (label.includes('official website')) {
        if (!officialWebsite) officialWebsite = href;
      } else if (label.includes('notification') || label.includes('syllabus')) {
        if (!pdfLink) pdfLink = href;
      }
    });

    return officialLink || officialWebsite || pdfLink || fallback;
  } catch (err) {
    return fallback;
  }
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
 * Scrapes all sections and cleans titles
 */
function parseSarkariResult($, baseUrl) {
  const updates = [];
  const seenUrls = new Set();

  $('ul.sarkari-quick-list').each((_, ul) => {
    const parentContainer = $(ul).closest('div');
    const rawSection = parentContainer.find('h2, h3, h4, .box-title, strong, font').first().text().trim() || 'Exam Notice';

    $(ul).find('li a').each((_, a) => {
      const rawTitle = $(a).text().trim();
      let href = $(a).attr('href');

      if (!rawTitle || !href || href.startsWith('javascript') || href.length < 5) return;
      if (!href.startsWith('http')) {
        try { href = new URL(href, baseUrl).href; } catch(e) { return; }
      }

      if (seenUrls.has(href)) return;
      seenUrls.add(href);

      const title = cleanTitle(rawTitle);
      const category = detectDetailedCategory(title, rawSection);

      updates.push({
        id: generateNoticeId(title, href),
        title: title,
        detailUrl: href,
        link: href, // Will be resolved to direct official gov link when dispatching
        category: category,
        rawSection: rawSection,
        foundAt: new Date().toISOString()
      });
    });
  });

  $('.job-box a, .job-grid a').each((_, a) => {
    const rawTitle = $(a).text().trim();
    let href = $(a).attr('href');
    if (!rawTitle || !href || href.startsWith('javascript') || href.length < 5) return;
    if (!href.startsWith('http')) {
      try { href = new URL(href, baseUrl).href; } catch(e) { return; }
    }
    if (seenUrls.has(href)) return;
    seenUrls.add(href);

    const title = cleanTitle(rawTitle);
    updates.push({
      id: generateNoticeId(title, href),
      title: title,
      detailUrl: href,
      link: href,
      category: detectDetailedCategory(title, 'New Vacancy Highlight'),
      rawSection: 'Latest Job Highlight',
      foundAt: new Date().toISOString()
    });
  });

  $('marquee a').each((_, a) => {
    const rawTitle = $(a).text().trim();
    let href = $(a).attr('href');
    if (!rawTitle || !href || href.startsWith('javascript') || href.length < 5) return;
    if (!href.startsWith('http')) {
      try { href = new URL(href, baseUrl).href; } catch(e) { return; }
    }
    if (seenUrls.has(href)) return;
    seenUrls.add(href);

    const title = cleanTitle(rawTitle);
    updates.push({
      id: generateNoticeId(title, href),
      title: title,
      detailUrl: href,
      link: href,
      category: detectDetailedCategory(title, 'Breaking Notice'),
      rawSection: 'Breaking Announcement',
      foundAt: new Date().toISOString()
    });
  });

  return updates;
}

/**
 * Generic notice board scraper
 */
function parseGenericNoticeBoard($, baseUrl) {
  const updates = [];
  const seen = new Set();

  $('a').each((_, el) => {
    const rawText = $(el).text().trim();
    let href = $(el).attr('href');
    if (!href || href.startsWith('javascript') || href.length < 5 || rawText.length < 6) return;

    const title = cleanTitle(rawText);
    const lower = title.toLowerCase();
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
        id: generateNoticeId(title, href),
        title: title,
        detailUrl: href,
        link: href,
        category: detectDetailedCategory(title, 'Official Notice'),
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
      console.log(`[Scraper] Fetching updates from source (Attempt ${attempt}/${retries})...`);

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

      console.log(`[Scraper] Successfully extracted ${updates.length} clean updates.`);
      return updates;
    } catch (err) {
      console.error(`[Scraper] Error fetching updates: ${err.message}`);
      if (attempt >= retries) return [];
      await new Promise((res) => setTimeout(res, 2000 * attempt));
    }
  }

  return [];
}

module.exports = {
  fetchExamUpdates,
  generateNoticeId,
  detectDetailedCategory,
  extractOfficialGovLink,
  cleanTitle
};
