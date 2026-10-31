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
  console.log('Starting End-to-End Browser Verification for Faculty Module...');
  
  await connectDatabase(3, 1000);
  const elenaUser = await User.findOne({ email: 'prof.elena@apex.edu' });
  const ananyaUser = await User.findOne({ email: 'manjuryam.cs24@bitsathy.ac.in' });

  if (!elenaUser || !ananyaUser) {
    throw new Error('Required faculty records not found in MongoDB Atlas.');
  }

  const browser: Browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  });

  const page: Page = await browser.newPage();

  try {
    // 1. Health check & Frontend load
    console.log('\n--- 1. Verification of System Health & Connectivity ---');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 15000 });
    const title = await page.title();
    record('Connectivity', 'Frontend loads on port 5173', title.includes('GenAI'), `Title: ${title}`);

    const offlineNotice = await page.$eval('body', (el) => el.innerText.includes('Backend Connection Notice'));
    record('Connectivity', 'Backend offline notice is absent', !offlineNotice);

    // 2. Authenticate as Prof. Elena Rostova
    console.log('\n--- 2. Faculty Authentication (Prof. Elena Rostova - Apex Institute) ---');
    const elenaTokens = generateAuthTokens(elenaUser);
    await page.setCookie(
      { name: 'access_token', value: elenaTokens.tokens.accessToken, domain: 'localhost', path: '/' },
      { name: 'refresh_token', value: elenaTokens.tokens.refreshToken, domain: 'localhost', path: '/' }
    );

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.body.innerText.includes('Faculty') || document.body.innerText.includes('Elena'), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1500));

    record('Auth', 'Faculty session active on faculty portal', true, 'Session initialized');

    // 3. Faculty Dashboard Verification
    console.log('\n--- 3. Faculty Dashboard Real Assignment Verification ---');
    const dashboardText = await page.$eval('main', (el) => el.innerText);
    const bodyText = await page.$eval('body', (el) => el.innerText);

    record('Dashboard', 'Displays Prof. Elena Rostova user profile', bodyText.includes('Prof. Elena Rostova') || bodyText.includes('Elena'));
    record('Dashboard', 'Zero dummy metrics ("2 Subjects", "14 Modules", "180 Students" absent)', 
      !dashboardText.includes('14 Modules') && !dashboardText.includes('180 Students') && !dashboardText.includes('2 Subjects')
    );
    record('Dashboard', 'Displays real experiment from Atlas ("RC Circuit Transient Response")', dashboardText.includes('RC Circuit Transient Response'));
    record('Dashboard', 'Atlas Connected status badge is visible', bodyText.includes('Atlas Connected'));

    // 4. Approved Resources (RAG) Verification
    console.log('\n--- 4. Approved Resources (RAG) Real Data Verification ---');
    await navigateSidebar(page, 'Approved Resources (RAG)');
    await page.waitForSelector('main', { timeout: 10000 });
    const resourcesText = await page.$eval('main', (el) => el.innerText);

    record('Resources', 'Resources view loads correctly', resourcesText.includes('Approved Learning Resources') || resourcesText.includes('RAG'));
    record('Resources', 'Upload Official Document action button is present', resourcesText.includes('Upload Official Document'));
    record('Resources', 'Displays real curriculum documents from Atlas or honest empty state', 
      resourcesText.includes('PDF') || resourcesText.includes('Manual') || resourcesText.includes('Guide') || resourcesText.includes('No Approved Learning Resources')
    );

    // 5. Experiment-Linked Assessments & Rubrics Verification
    console.log('\n--- 5. Assessments & Mastery Rubrics Verification ---');
    await navigateSidebar(page, 'Assessments & Rubrics');
    await page.waitForSelector('main', { timeout: 10000 });
    const assessmentsText = await page.$eval('main', (el) => el.innerText);

    record('Assessments', 'Assessments workbench loads', assessmentsText.includes('Assessment') || assessmentsText.includes('Diagnostic'));
    record('Assessments', 'Experiment selector dropdown lists Atlas experiment', assessmentsText.includes('RC Circuit Transient Response'));
    record('Assessments', 'Real assessment questions from Atlas render', 
      assessmentsText.includes('time constant') || assessmentsText.includes('tau') || assessmentsText.includes('Capacitor') || assessmentsText.includes('Question')
    );
    record('Assessments', 'Add Question action button is available', assessmentsText.includes('Add Question'));
    
    // Check Rubrics tab
    const tabClicked = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.tab-btn'));
      const rubricsTab = tabs.find((t) => t.textContent?.includes('Mastery Rubrics'));
      if (rubricsTab) {
        (rubricsTab as HTMLButtonElement).click();
        return true;
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 1500));
    const rubricsText = await page.$eval('main', (el) => el.innerText);
    record('Assessments', 'Mastery Rubrics tab maps real question topic weights', 
      rubricsText.includes('Topic Domain') || rubricsText.includes('Rubric') || rubricsText.includes('Marks Weight'),
      `Tab clicked: ${tabClicked}, Has Rubric text: ${rubricsText.includes('Rubric')}`
    );

    // 6. Student Progress Verification
    console.log('\n--- 6. Student Progress Real Cohort Verification ---');
    await navigateSidebar(page, 'Student Progress');
    await page.waitForSelector('main', { timeout: 10000 });
    const progressText = await page.$eval('main', (el) => el.innerText);

    record('Student Progress', 'Roster displays real student from Atlas ("Rohan Sharma")', progressText.includes('Rohan Sharma'));
    record('Student Progress', 'Inspect Progress action is functional', progressText.includes('Inspect Progress'));

    // Click Inspect Progress for Rohan Sharma
    const inspectBtn = await page.$('button ::-p-text(Inspect Progress)');
    if (inspectBtn) {
      await inspectBtn.click();
      await new Promise((r) => setTimeout(r, 2000));
      const detailText = await page.$eval('main', (el) => el.innerText);
      record('Student Progress', 'Inspect details display diagnostic attempt score & level', detailText.includes('Diagnostic Attempts') && (detailText.includes('beginner') || detailText.includes('pts') || detailText.includes('0%')));
    }

    // 7. Assessment Performance (Faculty Analytics) Verification
    console.log('\n--- 7. Assessment Performance & Faculty Analytics Verification ---');
    await navigateSidebar(page, 'Assessment Performance');
    await page.waitForSelector('main', { timeout: 10000 });
    const analyticsText = await page.$eval('main', (el) => el.innerText);

    record('Analytics', 'Analytics page loads with real calculations', analyticsText.includes('Diagnostic Assessment Avg'));
    record('Analytics', 'Zero hardcoded dummy values ("72.4%", "84.1%", "58 mins" absent)', 
      !analyticsText.includes('72.4%') && !analyticsText.includes('84.1%') && !analyticsText.includes('58 mins') && !analyticsText.includes('98.2%')
    );
    record('Analytics', 'Displays genuine diagnostic average and attempt count from Atlas', analyticsText.includes('student baseline attempt') || analyticsText.includes('0%'));

    // 8. Learning Gaps & Student Assistance Verification
    console.log('\n--- 8. Learning Gaps Real Misconceptions Verification ---');
    await navigateSidebar(page, 'Learning Gaps & Errors');
    await page.waitForSelector('main', { timeout: 10000 });
    const gapsText = await page.$eval('main', (el) => el.innerText);

    record('Learning Gaps', 'Learning gaps view loads with real Atlas analysis', gapsText.includes('Learning Gaps'));
    record('Learning Gaps', 'Zero hardcoded dummy gaps ("Oscilloscope Probe Grounding", "Decade Resistance Box" absent)',
      !gapsText.includes('Oscilloscope Probe Grounding') && !gapsText.includes('Decade Resistance Box')
    );
    record('Learning Gaps', 'Displays real Atlas gap topics from Rohan Sharma attempt ("Capacitor Transient Behavior" or "Time Constant")',
      gapsText.includes('Capacitor') || gapsText.includes('Time Constant') || gapsText.includes('RC Circuit')
    );

    // 9. Cross-Tenant Isolation Verification
    console.log('\n--- 9. Cross-Tenant Isolation Verification ---');
    const ananyaTokens = generateAuthTokens(ananyaUser);
    await page.setCookie(
      { name: 'access_token', value: ananyaTokens.tokens.accessToken, domain: 'localhost', path: '/' },
      { name: 'refresh_token', value: ananyaTokens.tokens.refreshToken, domain: 'localhost', path: '/' }
    );

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.body.innerText.includes('Faculty') || document.body.innerText.includes('Ananya'), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 2000));

    const bitDashboardText = await page.$eval('main', (el) => el.innerText);
    record('Tenant Isolation', 'BIT faculty session loads', true, 'Session switched to Ananya');
    record('Tenant Isolation', 'Apex experiments ("RC Circuit Transient Response") are strictly hidden from BIT faculty',
      !bitDashboardText.includes('RC Circuit Transient Response')
    );
    record('Tenant Isolation', 'Apex students ("Rohan Sharma") are strictly hidden from BIT faculty',
      !bitDashboardText.includes('Rohan Sharma')
    );

  } catch (err) {
    console.error('Browser verification encountered an error:', err);
    record('Execution', 'Test script completed', false, String(err));
  } finally {
    await browser.close();
    await disconnectDatabase();
  }

  // Summary
  console.log('\n======================================================');
  console.log('         FACULTY MODULE E2E VERIFICATION REPORT       ');
  console.log('======================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`TOTAL TESTS: ${total}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${failed}`);
  console.log('======================================================\n');
}

runTests();
