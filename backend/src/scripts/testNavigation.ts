import puppeteer from 'puppeteer-core';

async function testNavigation() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });

  // Login
  await page.type('input[type="email"]', 'dean.electronics@apex.edu');
  await page.type('input[type="password"]', 'LabSecurePass2026!');
  
  const [loginRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/login') && r.status() === 200),
    page.click('button[type="submit"]'),
  ]);
  console.log('Login response status:', loginRes.status());

  // Wait for sidebar to render
  await page.waitForSelector('aside', { timeout: 10000 });
  console.log('Sidebar rendered!');

  // Navigate to Academic Hierarchy
  console.log('Clicking Academic Hierarchy...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('aside button'));
    const btn = buttons.find((b) => b.textContent?.includes('Academic Hierarchy'));
    if (btn) (btn as HTMLButtonElement).click();
  });

  await new Promise((resolve) => setTimeout(resolve, 2000));
  const mainHierarchy = await page.$eval('main', (el) => el.innerText);
  console.log('Main Hierarchy snippet:', mainHierarchy.slice(0, 200));

  // Navigate to Faculty & Students
  console.log('Clicking Faculty & Students...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('aside button'));
    const btn = buttons.find((b) => b.textContent?.includes('Faculty & Students'));
    if (btn) (btn as HTMLButtonElement).click();
  });

  await new Promise((resolve) => setTimeout(resolve, 2000));
  const mainUsers = await page.$eval('main', (el) => el.innerText);
  console.log('Main Users snippet:', mainUsers.slice(0, 200));

  await browser.close();
}

testNavigation().catch(console.error);
