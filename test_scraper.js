const { fetchExamUpdates } = require('./scraper');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

async function test() {
  console.log('Testing scraper with target:', config.website_url);
  const results = await fetchExamUpdates(config.website_url);
  console.log('\nTotal updates extracted:', results.length);
  console.log('\nTop 5 extracted exam updates preview:');
  results.slice(0, 5).forEach((item, idx) => {
    console.log(`\n[${idx + 1}] Category: [${item.category}]`);
    console.log(`    Title:    ${item.title}`);
    console.log(`    Link:     ${item.link}`);
  });
}

test();
