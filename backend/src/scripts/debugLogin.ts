import puppeteer from 'puppeteer-core';

async function debugLogin() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', (err: unknown) => console.error('PAGE ERROR:', err instanceof Error ? err.message : String(err)));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });

  console.log('Filling form...');
  await page.type('input[type="email"]', 'dean.electronics@apex.edu');
  await page.type('input[type="password"]', 'LabSecurePass2026!');
  
  console.log('Clicking submit...');
  await page.click('button[type="submit"]');

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const text = await page.evaluate(() => document.body.innerText);
  console.log('After submit body text:', text.slice(0, 300));

  const alertText = await page.evaluate(() => {
    const alerts = Array.from(document.querySelectorAll('.alert, [role="alert"]'));
    return alerts.map((a) => a.textContent).join(' | ');
  });
  console.log('Alert text:', alertText);

  await browser.close();
}

debugLogin().catch(console.error);

