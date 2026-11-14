const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runDemo() {
  console.log('====================================================');
  console.log('  🎥 RECORDING REACHINBOX OUTBOX ASSIGNMENT DEMO');
  console.log('====================================================');

  const recordingsDir = path.join(__dirname, 'recordings');
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: recordingsDir,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();

  console.log('[Demo] 1. Navigating to ReachInbox Outbox Frontend (http://localhost:3000)...');
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);

  console.log('[Demo] 2. Logging in with Google OAuth...');
  await page.click('button:has-text("Continue with Google")');
  await page.waitForTimeout(2500);

  console.log('[Demo] 3. Inspecting Dashboard overview and stats cards...');
  await page.waitForSelector('text=Email Outreach Dispatcher');
  await page.waitForTimeout(2000);

  console.log('[Demo] 4. Opening Compose Modal...');
  await page.click('button:has-text("Compose New Email")');
  await page.waitForTimeout(1500);

  console.log('[Demo] 5. Entering lead email and composing email payload...');
  await page.fill('input[placeholder*="paste email"]', 'lead.alex@enterprise-saas.com');
  await page.click('button:has-text("Add")');
  await page.waitForTimeout(1000);

  await page.fill('input[placeholder*="Scaling outbound"]', 'ReachInbox AI: 3x Outbound Reply Rates');
  await page.fill(
    'textarea[placeholder*="Hi {{firstName}}"]',
    'Hi Alex,\n\nWe built an automated email scheduling and outbound infrastructure at Outbox Labs to reliably deliver cold emails at scale with BullMQ and provider throttling.\n\nBest,\nReachInbox Team'
  );
  await page.waitForTimeout(1500);

  console.log('[Demo] 6. Scheduling email into BullMQ queue...');
  await page.click('button[type="submit"]');
  // Wait for modal to disappear
  await page.waitForSelector('text=Compose & Schedule Outreach', { state: 'detached', timeout: 5000 });
  await page.waitForTimeout(2000);

  console.log('[Demo] 7. Viewing Scheduled Outbox table and countdown timer...');
  await page.waitForTimeout(4000);

  console.log('[Demo] 8. Switching to Sent Emails tab to observe dispatch & Ethereal preview link...');
  await page.click('button:has-text("Sent Emails")');
  await page.waitForTimeout(4000);

  console.log('[Demo] 9. Demonstrating Rate Limiting & Concurrency under load...');
  await page.click('button:has-text("Rate Limit Test")');
  await page.waitForTimeout(1500);
  await page.click('button:has-text("Burst")');
  await page.waitForTimeout(3000);
  await page.click('button:has-text("Close")');
  await page.waitForSelector('text=Rate Limiting & Concurrency Demo', { state: 'detached', timeout: 5000 });
  await page.waitForTimeout(2000);

  console.log('[Demo] 10. Navigating back to Scheduled Emails to show throttled & rescheduled emails...');
  await page.click('button:has-text("Scheduled Emails")');
  await page.waitForTimeout(5000);

  console.log('[Demo] 11. Final overview of Sent Emails...');
  await page.click('button:has-text("Sent Emails")');
  await page.waitForTimeout(4000);

  console.log('[Demo] Finishing recording...');
  await page.close();
  await context.close();
  await browser.close();

  // Find the generated video
  const files = fs.readdirSync(recordingsDir);
  const videoFile = files.find((f) => f.endsWith('.webm'));
  if (videoFile) {
    const src = path.join(recordingsDir, videoFile);
    const dest = path.join(__dirname, 'reachinbox-outbox-demo.webm');
    fs.copyFileSync(src, dest);
    console.log(`[Demo] ✅ Demo video saved successfully to: ${dest}`);
  }
}

runDemo().catch(console.error);
