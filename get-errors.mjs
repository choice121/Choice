import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));
  
  await page.goto('https://choice-properties-site.pages.dev/matches.html?id=7958b02a-9f0a-4830-a1fa-162d7c559831', { waitUntil: 'networkidle0' });
  
  const content = await page.evaluate(() => {
    return document.getElementById('propertyGrid')?.innerText;
  });
  console.log('GRID CONTENT:', content);
  
  await browser.close();
})();
