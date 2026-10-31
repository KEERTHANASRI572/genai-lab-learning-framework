import puppeteer from 'puppeteer-core';

async function testChromeLaunch() {
  console.log('Testing Chrome launch with puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  const title = await page.title();
  console.log('Page Title:', title);
  const text = await page.evaluate(() => document.body.innerText);
  console.log('Page Text snippet:', text.slice(0, 150));
  await browser.close();
  console.log('Chrome launch successful!');
}

testChromeLaunch().catch(console.error);

