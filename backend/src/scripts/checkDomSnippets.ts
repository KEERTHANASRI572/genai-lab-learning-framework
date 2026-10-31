import puppeteer from 'puppeteer-core';
import { generateAuthTokens } from '../utils/token';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { Institution } from '../models/Institution';
import { User } from '../models/User';

async function checkDomSnippets() {
  await connectDatabase();
  const aitInst = await Institution.findOne({ code: 'AIT' });
  const bitInst = await Institution.findOne({ code: 'BIT' });
  const aitAdmin = await User.findOne({ institutionId: aitInst?._id, role: 'college-admin' });
  const bitAdmin = await User.findOne({ institutionId: bitInst?._id, role: 'college-admin' });

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // 1. Check Student Interventions as AIT
  const aitTokens = generateAuthTokens(aitAdmin!);
  await page.setCookie(
    { name: 'access_token', value: aitTokens.tokens.accessToken, domain: 'localhost', path: '/' },
    { name: 'refresh_token', value: aitTokens.tokens.refreshToken, domain: 'localhost', path: '/' }
  );

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await page.waitForSelector('aside');

  // Navigate to Student Interventions
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('aside button'));
    const btn = btns.find((b) => b.textContent?.includes('Student Interventions'));
    if (btn) (btn as HTMLButtonElement).click();
  });

  await new Promise((r) => setTimeout(r, 2000));
  const interventionsText = await page.$eval('main', (el) => el.innerText);
  console.log('=== AIT Student Interventions Main Text ===\n', interventionsText);

  // 2. Check Faculty & Students as BIT
  const bitTokens = generateAuthTokens(bitAdmin!);
  await page.setCookie(
    { name: 'access_token', value: bitTokens.tokens.accessToken, domain: 'localhost', path: '/' },
    { name: 'refresh_token', value: bitTokens.tokens.refreshToken, domain: 'localhost', path: '/' }
  );

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await page.waitForSelector('aside');

  // Navigate to Faculty & Students
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('aside button'));
    const btn = btns.find((b) => b.textContent?.includes('Faculty & Students'));
    if (btn) (btn as HTMLButtonElement).click();
  });

  await new Promise((r) => setTimeout(r, 2000));
  const bitUsersText = await page.$eval('main', (el) => el.innerText);
  console.log('\n=== BIT Users Main Text ===\n', bitUsersText);

  await browser.close();
  await disconnectDatabase();
}

checkDomSnippets().catch(console.error);
