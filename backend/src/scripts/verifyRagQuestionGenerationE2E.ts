import puppeteer, { Browser, Page } from 'puppeteer-core';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { connectDatabase, disconnectDatabase } from '../config/database';
import { User } from '../models/User';
import { generateAuthTokens } from '../utils/token';

interface TestResult {
  category: string;
  test: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function record(category: string, test: string, passed: boolean, details?: string) {
  results.push({ category, test, passed, details });
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] [${category}] ${test}${details ? ` -> ${details}` : ''}`);
}

async function navigateSidebar(page: Page, label: string) {
  await page.evaluate((navLabel) => {
    const buttons = Array.from(document.querySelectorAll('aside button'));
    const btn = buttons.find((b) => b.textContent?.includes(navLabel));
    if (btn) (btn as HTMLButtonElement).click();
  }, label);
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

async function runTests() {
  console.log('Starting End-to-End Browser Verification for RAG-Based Assessment Generation...\n');

  await connectDatabase(3, 1000);
  const elenaUser = await User.findOne({ email: 'prof.elena@apex.edu' });

  if (!elenaUser) {
    throw new Error('Faculty user prof.elena@apex.edu not found in MongoDB Atlas.');
  }

  const browser: Browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  });

  const page: Page = await browser.newPage();

  try {
    // 1. Authenticate as Prof. Elena Rostova
    console.log('--- 1. Faculty Authentication ---');
    const elenaTokens = generateAuthTokens(elenaUser);
    await page.setCookie(
      { name: 'access_token', value: elenaTokens.tokens.accessToken, domain: 'localhost', path: '/' },
      { name: 'refresh_token', value: elenaTokens.tokens.refreshToken, domain: 'localhost', path: '/' }
    );

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.body.innerText.includes('Faculty') || document.body.innerText.includes('Elena'), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1500));
    record('Auth', 'Logged in as Prof. Elena Rostova', true);

    // 2. Approved Resources (RAG) View Verification
    console.log('\n--- 2. Approved Resources (RAG) View Verification ---');
    await navigateSidebar(page, 'Approved Resources (RAG)');
    await page.waitForSelector('main', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1000));

    const resourcesText = await page.$eval('main', (el) => el.innerText);
    record('Resources View', 'Approved Resources view rendered', resourcesText.includes('Approved Learning Resources'));
    record('Resources View', 'Vector Indexed status displayed', resourcesText.includes('Vector Indexed'));
    record('Resources View', 'Generate Questions shortcut button visible', resourcesText.includes('Generate Questions'));

    // 3. Assessments & Rubrics View Verification
    console.log('\n--- 3. Assessments & Rubrics View Verification ---');
    await navigateSidebar(page, 'Assessments & Rubrics');
    await page.waitForSelector('main', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1500));

    const assessmentsText = await page.$eval('main', (el) => el.innerText);
    record('Assessments View', 'Assessment view loaded with Atlas experiment', assessmentsText.includes('RC Circuit Transient Response'));
    record('Assessments View', '"Generate with AI (RAG)" button present', assessmentsText.includes('Generate with AI (RAG)'));
    record('Assessments View', 'Question filtering tabs rendered (All, Drafts, Approved)', assessmentsText.includes('Filter Questions') && assessmentsText.includes('Approved'));

    // 4. Test RAG Generation Modal
    console.log('\n--- 4. Test RAG Generation Modal UI ---');
    const clickedRagBtn = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find((b) => b.textContent?.includes('Generate with AI (RAG)'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    record('RAG Modal', 'Clicked "Generate with AI (RAG)" button', clickedRagBtn);

    await new Promise((r) => setTimeout(r, 1000));
    const modalText = await page.$eval('.modal-card', (el) => (el as HTMLElement).innerText);
    record('RAG Modal', 'RAG Modal opened with instructions', modalText.includes('Generate Assessment Questions with AI (RAG)'));
    record('RAG Modal', 'Indexed document selector shows verified manual', modalText.includes('Manual') || modalText.includes('RC Circuit'));
    record('RAG Modal', 'Question count selector exists', modalText.includes('Number of Questions'));
    record('RAG Modal', 'Target difficulty selector exists', modalText.includes('Target Difficulty'));
    record('RAG Modal', 'Topic focus field exists', modalText.includes('Optional Topic Focus'));

    // Close modal
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.modal-card button'));
      const cancelBtn = buttons.find((b) => b.textContent?.includes('Cancel'));
      if (cancelBtn) (cancelBtn as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // 5. Verify Question Badges and Source Passage Accordion
    console.log('\n--- 5. Verify Question Badges & Grounded Passage Accordion ---');
    const mainAfterClose = await page.$eval('main', (el) => (el as HTMLElement).innerText);
    record('Question Items', 'AI Grounded badge rendered', mainAfterClose.includes('AI Grounded (RAG)'));
    record('Question Items', 'Status badge rendered (Approved/Draft)', mainAfterClose.includes('Approved') || mainAfterClose.includes('Draft'));
    record('Question Items', 'Grounded Source Reference toggle rendered', mainAfterClose.includes('Grounded Source Reference'));

    // Test expanding grounded source reference passage
    const passageExpanded = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const passageToggle = buttons.find((b) => b.textContent?.includes('Grounded Source Reference'));
      if (passageToggle) {
        (passageToggle as HTMLElement).click();
        return true;
      }
      return false;
    });
    record('Grounded Passage', 'Clicked Grounded Source Reference toggle', passageExpanded);

    await new Promise((r) => setTimeout(r, 600));
    const expandedText = await page.$eval('main', (el) => (el as HTMLElement).innerText);
    record('Grounded Passage', 'Source document passage quotation visible', 
      expandedText.includes('time constant') || expandedText.includes('tau') || expandedText.includes('capacitor')
    );

    // 6. Test Settings & Publishing Modal
    console.log('\n--- 6. Test Assessment Settings & Publishing Modal ---');
    const clickedSettings = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find((b) => b.textContent?.includes('Settings & Publish') || b.textContent?.includes('Publish Assessment'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    record('Publish Modal', 'Clicked Settings / Publish button', clickedSettings);

    await new Promise((r) => setTimeout(r, 1000));
    const settingsModalText = await page.$eval('.modal-card', (el) => (el as HTMLElement).innerText);
    record('Publish Modal', 'Settings modal opened', settingsModalText.includes('Assessment Settings & Publishing'));
    record('Publish Modal', 'Passing Score field configured', settingsModalText.includes('Passing Score'));
    record('Publish Modal', 'Time Limit field configured', settingsModalText.includes('Time Limit'));
    record('Publish Modal', 'Approved questions count displayed', settingsModalText.includes('Approved Questions'));

    // Close settings modal
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.modal-card button'));
      const cancelBtn = buttons.find((b) => b.textContent?.includes('Cancel'));
      if (cancelBtn) (cancelBtn as HTMLElement).click();
    });

  } catch (err: unknown) {
    console.error('Browser verification failed with error:', err);
    record('Exception', 'Test execution completed without crashing', false, (err as Error).message);
  } finally {
    await browser.close();
    await disconnectDatabase();
  }

  console.log('\n======================================================');
  console.log('        RAG QUESTION GENERATION E2E SUMMARY           ');
  console.log('======================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total Checks: ${total} | Passed: ${passed} | Failed: ${failed}`);
  if (failed > 0) {
    console.error('SOME CHECKS FAILED!');
    process.exit(1);
  } else {
    console.log('ALL BROWSER E2E VERIFICATIONS PASSED SUCCESSFULLY!');
  }
}

runTests();

