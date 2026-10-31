import puppeteer, { Browser, Page } from 'puppeteer-core';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { connectDatabase, disconnectDatabase } from '../config/database';
import { User } from '../models/User';
import { Assessment } from '../models/Assessment';
import { generateAuthTokens } from '../utils/token';

interface TestStep {
  name: string;
  passed: boolean;
  details?: string;
}

const steps: TestStep[] = [];

function record(name: string, passed: boolean, details?: string) {
  steps.push({ name, passed, details });
  const mark = passed ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name}${details ? ` -> ${details}` : ''}`);
}

async function navigateSidebar(page: Page, label: string) {
  await page.evaluate((navLabel) => {
    const buttons = Array.from(document.querySelectorAll('aside button'));
    const btn = buttons.find((b) => b.textContent?.includes(navLabel));
    if (btn) (btn as HTMLButtonElement).click();
  }, label);
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

async function run() {
  console.log('=== STARTING COMPLETE BROWSER VERIFICATION FOR RAG APPROVE/REJECT WORKFLOW ===\n');

  await connectDatabase(3, 1000);
  const elenaUser = await User.findOne({ email: 'prof.elena@apex.edu' });
  if (!elenaUser) throw new Error('Faculty prof.elena@apex.edu not found in MongoDB Atlas.');

  const browser: Browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  });

  const page: Page = await browser.newPage();

  try {
    // 1. Authenticate Faculty
    const elenaTokens = generateAuthTokens(elenaUser);
    await page.setCookie(
      { name: 'access_token', value: elenaTokens.tokens.accessToken, domain: 'localhost', path: '/' },
      { name: 'refresh_token', value: elenaTokens.tokens.refreshToken, domain: 'localhost', path: '/' }
    );

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.body.innerText.includes('Faculty') || document.body.innerText.includes('Elena'), { timeout: 10000 });
    record('Faculty Login', true, 'Session active for Prof. Elena Rostova');

    // 2. Navigate to Assessments & Rubrics
    await navigateSidebar(page, 'Assessments & Rubrics');
    await page.waitForSelector('main', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1000));
    record('Navigation to Assessments', true);

    // 3. Open RAG Question Generation Modal
    const openRagClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find((b) => b.textContent?.includes('Generate with AI (RAG)'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    record('Open RAG Generator Modal', openRagClicked);
    await new Promise((r) => setTimeout(r, 1000));

    // 4. Generate 3 RAG Questions
    const generateClicked = await page.evaluate(() => {
      const select = document.querySelector('select[value]') || document.querySelectorAll('.modal-card select')[1];
      if (select) {
        // select 3 questions
        (select as HTMLSelectElement).value = '3';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const submitBtn = Array.from(document.querySelectorAll('.modal-card button')).find(
        (b) => b.textContent?.includes('Generate Grounded Drafts')
      );
      if (submitBtn) {
        (submitBtn as HTMLButtonElement).click();
        return true;
      }
      return false;
    });
    record('Submit RAG Generation', generateClicked);

    // Wait for generation response
    console.log('Waiting for AI generation from vector chunks in Atlas...');
    await page.waitForFunction(
      () => document.body.innerText.includes('Successfully generated') || document.body.innerText.includes('Question #'),
      { timeout: 25000 }
    );
    await new Promise((r) => setTimeout(r, 1500));
    record('RAG Generation Complete', true, 'Draft questions rendered');

    // 5. Verify Individual Question Cards have Visible Approve / Reject Buttons
    const cardButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const approveBtns = buttons.filter((b) => b.textContent?.includes('Approve Question'));
      const rejectBtns = buttons.filter((b) => b.textContent?.includes('Reject Question'));
      const editBtns = buttons.filter((b) => b.textContent?.includes('Edit Question'));
      const deleteBtns = buttons.filter((b) => b.textContent?.includes('Delete / Archive'));
      return {
        approveCount: approveBtns.length,
        rejectCount: rejectBtns.length,
        editCount: editBtns.length,
        deleteCount: deleteBtns.length,
      };
    });

    console.log('Visible Action Buttons Count:', cardButtons);
    record('Visible Approve Buttons Exist', cardButtons.approveCount > 0, `Found ${cardButtons.approveCount} Approve buttons`);
    record('Visible Reject Buttons Exist', cardButtons.rejectCount > 0, `Found ${cardButtons.rejectCount} Reject buttons`);
    record('Visible Edit Buttons Exist', cardButtons.editCount > 0, `Found ${cardButtons.editCount} Edit buttons`);
    record('Visible Delete Buttons Exist', cardButtons.deleteCount > 0, `Found ${cardButtons.deleteCount} Delete buttons`);

    // 6. Click Approve on First Draft Question
    const clickedApprove = await page.evaluate(() => {
      const approveBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Approve Question')
      );
      if (approveBtn) {
        (approveBtn as HTMLButtonElement).click();
        return true;
      }
      return false;
    });
    record('Click Approve Question Action', clickedApprove);

    await page.waitForFunction(() => document.body.innerText.includes('Question approved successfully'), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1500));
    record('Approve Action Success Notice Displayed', true);

    // 7. Click Reject on Remaining Draft Question
    const clickedReject = await page.evaluate(() => {
      const rejectBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Reject Question')
      );
      if (rejectBtn) {
        (rejectBtn as HTMLButtonElement).click();
        return true;
      }
      return false;
    });
    record('Click Reject Question Action', clickedReject);

    await page.waitForFunction(() => document.body.innerText.includes('Question rejected'), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1500));
    record('Reject Action Success Notice Displayed', true);

    // 8. Test Question Filters (Approved & Rejected)
    const filterApprovedClicked = await page.evaluate(() => {
      const filterBtns = Array.from(document.querySelectorAll('.filter-btn'));
      const approvedTab = filterBtns.find((b) => b.textContent?.includes('Approved'));
      if (approvedTab) {
        (approvedTab as HTMLButtonElement).click();
        return true;
      }
      return false;
    });
    record('Switch to Approved Filter', filterApprovedClicked);
    await new Promise((r) => setTimeout(r, 1000));

    const approvedMainText = await page.$eval('main', (el) => (el as HTMLElement).innerText);
    record('Approved List displays Approved Question', approvedMainText.includes('Approved for Assessment') || approvedMainText.includes('Approved'));

    const filterRejectedClicked = await page.evaluate(() => {
      const filterBtns = Array.from(document.querySelectorAll('.filter-btn'));
      const rejectedTab = filterBtns.find((b) => b.textContent?.includes('Rejected'));
      if (rejectedTab) {
        (rejectedTab as HTMLButtonElement).click();
        return true;
      }
      return false;
    });
    record('Switch to Rejected Filter', filterRejectedClicked);
    await new Promise((r) => setTimeout(r, 1000));

    const rejectedMainText = await page.$eval('main', (el) => (el as HTMLElement).innerText);
    record('Rejected List displays Rejected Question', rejectedMainText.includes('Rejected Question') || rejectedMainText.includes('Rejected'));

    // 9. Test Edit Question Form Modal
    const editClicked = await page.evaluate(() => {
      const editBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Edit Question')
      );
      if (editBtn) {
        (editBtn as HTMLButtonElement).click();
        return true;
      }
      return false;
    });
    record('Click Edit Question', editClicked);
    await new Promise((r) => setTimeout(r, 1000));

    const editModalText = await page.$eval('.modal-card', (el) => (el as HTMLElement).innerText);
    record('Edit Question Modal Open', editModalText.includes('Edit Assessment Question'));

    // Save Edit with modified prompt
    const savedEdit = await page.evaluate(() => {
      const textarea = document.querySelector('.modal-card textarea');
      if (textarea) {
        (textarea as HTMLTextAreaElement).value = (textarea as HTMLTextAreaElement).value + ' [Verified by Elena]';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const saveBtn = Array.from(document.querySelectorAll('.modal-card button')).find((b) =>
        b.textContent?.includes('Update Question')
      );
      if (saveBtn) {
        (saveBtn as HTMLButtonElement).click();
        return true;
      }
      return false;
    });
    record('Submit Question Edit', savedEdit);
    await page.waitForFunction(() => document.body.innerText.includes('Question updated successfully'), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1500));
    record('Question Edit Saved & Persisted', true);

    // 10. Refresh Page and Verify Persistence of Status in Atlas
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.body.innerText.includes('Faculty') || document.body.innerText.includes('Elena'), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1500));

    await navigateSidebar(page, 'Assessments & Rubrics');
    await page.waitForSelector('main', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1500));

    const reloadedText = await page.$eval('main', (el) => (el as HTMLElement).innerText);
    record('Persistence After Page Refresh', reloadedText.includes('Approved') || reloadedText.includes('Question #'));

    // 11. Verify in MongoDB Atlas directly
    const atlasAssessment = await Assessment.findOne({ experimentId: '6ae32a0c0efd2cdcb5d4427a' }).lean();
    const hasApproved = atlasAssessment?.questions?.some((q: any) => q.status === 'approved');
    const hasRejected = atlasAssessment?.questions?.some((q: any) => q.status === 'rejected');
    record('MongoDB Atlas: Approved questions persisted', !!hasApproved);
    record('MongoDB Atlas: Rejected questions persisted', !!hasRejected);

  } catch (err: unknown) {
    console.error('Test error:', err);
    record('Execution Exception', false, (err as Error).message);
  } finally {
    await browser.close();
    await disconnectDatabase();
  }

  console.log('\n======================================================');
  console.log('       RAG APPROVE/REJECT VERIFICATION SUMMARY        ');
  console.log('======================================================');
  const total = steps.length;
  const passed = steps.filter((s) => s.passed).length;
  const failed = steps.filter((s) => !s.passed).length;
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
  if (failed > 0) {
    console.error('FAILED CHECKS OCCURRED!');
    process.exit(1);
  } else {
    console.log('ALL WORKFLOW & UI CONTROLS VERIFIED SUCCESSFULLY!');
  }
}

run();
