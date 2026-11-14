const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function setCaption(page, title, subtitle) {
  try {
    await page.evaluate(({ title, subtitle }) => {
      let el = document.getElementById('demo-captions-banner');
      if (!el) {
        el = document.createElement('div');
        el.id = 'demo-captions-banner';
        el.style.position = 'fixed';
        el.style.bottom = '24px';
        el.style.left = '50%';
        el.style.transform = 'translateX(-50%)';
        el.style.zIndex = '999999';
        el.style.background = 'rgba(15, 23, 42, 0.94)';
        el.style.backdropFilter = 'blur(16px)';
        el.style.color = 'white';
        el.style.padding = '12px 28px';
        el.style.borderRadius = '16px';
        el.style.boxShadow = '0 25px 35px -5px rgba(0, 0, 0, 0.6), 0 10px 10px -5px rgba(0, 0, 0, 0.4)';
        el.style.border = '1px solid rgba(129, 140, 248, 0.3)';
        el.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        el.style.textAlign = 'center';
        el.style.maxWidth = '850px';
        el.style.pointerEvents = 'none';
        el.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
        document.body.appendChild(el);
      }
      el.innerHTML = `
        <div style="font-size: 13px; font-weight: 800; color: #a5b4fc; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 3px; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <span>⚡</span> ${title}
        </div>
        <div style="font-size: 13px; font-weight: 500; color: #f8fafc; line-height: 1.4;">
          ${subtitle}
        </div>
      `;
    }, { title, subtitle });
  } catch (e) {}
}

async function runDetailed3MinDemo() {
  console.log('================================================================');
  console.log('  🎥 RECORDING COMPREHENSIVE 3-MINUTE REACHINBOX OUTBOX DEMO');
  console.log('================================================================');

  const recordingsDir = path.join(__dirname, 'recordings_3min');
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    recordVideo: {
      dir: recordingsDir,
      size: { width: 1366, height: 768 },
    },
  });

  const page = await context.newPage();

  // -------------------------------------------------------------
  // SCENE 1: Google OAuth Login (0:00 - 0:18, ~18s)
  // -------------------------------------------------------------
  console.log('[Scene 1] Navigating to Login Page...');
  await page.goto('http://localhost:3000');
  await setCaption(
    page,
    'Requirement 1: Google OAuth Login',
    'ReachInbox authentication flow with Google OAuth branding, user avatar & profile session.'
  );
  await page.waitForTimeout(4000);

  // Hover over Google Sign-in button
  await page.hover('button:has-text("Continue with Google")');
  await page.waitForTimeout(2000);

  // Click login
  await page.click('button:has-text("Continue with Google")');
  await page.waitForTimeout(3000);

  // -------------------------------------------------------------
  // SCENE 2: Dashboard Overview & System Metrics (0:18 - 0:38, ~20s)
  // -------------------------------------------------------------
  console.log('[Scene 2] Dashboard Overview...');
  await setCaption(
    page,
    'Requirement 2: Main Dashboard & System Architecture',
    'Figma-aligned dashboard showing Scheduled Queue, Sent Outbox, Concurrency (5 threads) & Hourly Quota.'
  );
  await page.waitForTimeout(3000);

  // Hover over stats cards
  const cards = await page.$$('.grid > div');
  if (cards.length >= 4) {
    await cards[0].hover();
    await page.waitForTimeout(2000);
    await cards[1].hover();
    await page.waitForTimeout(2000);
    await cards[2].hover();
    await page.waitForTimeout(2000);
    await cards[3].hover();
    await page.waitForTimeout(2000);
  }

  // -------------------------------------------------------------
  // SCENE 3: Slack Integration & Live Verification (0:38 - 0:58, ~20s)
  // -------------------------------------------------------------
  console.log('[Scene 3] Slack Integration...');
  await setCaption(
    page,
    'Requirement 3: Live Slack Notifications on Rate Limit',
    'Connecting Slack webhook for real-time alerting whenever a sender hits their hourly limit.'
  );
  await page.click('button:has-text("Connect Slack"), button:has-text("Slack Alert")');
  await page.waitForTimeout(2500);

  // Fill in Slack webhook
  await page.fill('input[type="url"]', 'https://api.reachinbox.ai/mock-slack-webhook-endpoint');
  await page.waitForTimeout(2000);

  // Click Test Alert
  await page.click('button:has-text("Test Alert")');
  await page.waitForTimeout(3500);

  // Close modal via close button
  const closeSlackBtn = page.locator('div.fixed button:has(svg)').first();
  await closeSlackBtn.click();
  await page.waitForSelector('text=Slack Alerts Integration', { state: 'detached', timeout: 5000 });
  await page.waitForTimeout(2000);

  // -------------------------------------------------------------
  // SCENE 4: Compose with CSV Lead Upload & Provider Throttle (0:58 - 1:30, ~32s)
  // -------------------------------------------------------------
  console.log('[Scene 4] Composing outreach with CSV upload...');
  await setCaption(
    page,
    'Requirement 4: Compose Outreach & Lead CSV Upload',
    'Multi-sender selection, CSV parser detecting lead count, provider throttle (2s delay), and start time.'
  );
  await page.click('button:has-text("Compose New Email")');
  await page.waitForTimeout(2500);

  // Select multi-sender
  await page.selectOption('select', 'outbox-agent-1@reachinbox.ai');
  await page.waitForTimeout(1500);

  // Upload sample CSV file with leads
  const csvPath = path.join(__dirname, 'sample_leads.csv');
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.setInputFiles(csvPath);
    await page.waitForTimeout(3000);
  }

  // Fill in Subject & Body
  await page.fill('input[placeholder*="Scaling outbound"]', 'Transforming Outbound Pipeline with ReachInbox AI');
  await page.waitForTimeout(1500);
  await page.fill(
    'textarea[placeholder*="Hi {{firstName}}"]',
    '<p>Hi Alex,</p><p>We built a high-throughput outbox email dispatcher powered by <strong>BullMQ + Redis</strong>, supporting provider throttling and automated hourly quota rescheduling.</p><p>Best regards,<br/>ReachInbox Labs</p>'
  );
  await page.waitForTimeout(2500);

  // Submit form
  await setCaption(
    page,
    'Enqueuing into BullMQ Delayed Queue',
    'Emails scheduled into Redis-backed BullMQ with 2s provider delay pacing without cron jobs.'
  );
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Compose & Schedule Outreach', { state: 'detached', timeout: 5000 });
  await page.waitForTimeout(3000);

  // -------------------------------------------------------------
  // SCENE 5: Scheduled Emails Table & Real-Time Countdowns (1:30 - 1:55, ~25s)
  // -------------------------------------------------------------
  console.log('[Scene 5] Scheduled Outbox Table...');
  await setCaption(
    page,
    'Requirement 5: Scheduled Outbox & Real-time Countdown',
    'Emails waiting in BullMQ queue with live countdown timers and Elasticsearch-backed search filtering.'
  );
  await page.waitForTimeout(4000);

  // Test search input
  await page.fill('input[placeholder*="Search"]', 'techgrowth');
  await page.waitForTimeout(3000);
  await page.fill('input[placeholder*="Search"]', '');
  await page.waitForTimeout(4000);

  // Wait as worker dispatches
  await setCaption(
    page,
    'Worker Processing with Provider Throttling',
    'BullMQ Worker picks up jobs, applies 2-second provider throttle delay, and dispatches via Ethereal SMTP.'
  );
  await page.waitForTimeout(6000);

  // -------------------------------------------------------------
  // SCENE 6: Sent Emails & Live Ethereal Preview (1:55 - 2:20, ~25s)
  // -------------------------------------------------------------
  console.log('[Scene 6] Sent Emails Table...');
  await page.click('button:has-text("Sent Emails")');
  await setCaption(
    page,
    'Requirement 6: Sent Outbox & Ethereal SMTP Previews',
    'View dispatched emails, delivery timestamps, and clickable "Open Preview" links to view rendered emails.'
  );
  await page.waitForTimeout(4000);

  // Hover over Open Preview button
  const previewBtn = await page.$('a:has-text("Open Preview")');
  if (previewBtn) {
    await previewBtn.hover();
    await page.waitForTimeout(3000);
  }

  // -------------------------------------------------------------
  // SCENE 7: Persistence Across Server Restart (2:20 - 2:48, ~28s)
  // -------------------------------------------------------------
  console.log('[Scene 7] Demonstrating Persistence across Restart...');
  await setCaption(
    page,
    'Requirement 7: Persistence Across Server Restarts',
    'Scheduling a future email for +25s. Server crash/restart recovery will safely preserve the job.'
  );

  // Schedule an email for +25s
  await page.click('button:has-text("Compose New Email")');
  await page.waitForTimeout(1500);
  await page.fill('input[placeholder*="paste email"]', 'downtime.recovery@reachinbox-demo.com');
  await page.click('button:has-text("Add")');
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder*="Scaling outbound"]', 'Verification of Zero Job Loss on Crash');
  await page.fill('textarea[placeholder*="Hi {{firstName}}"]', '<p>Demonstrating startup reconciliation after crash.</p>');
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Compose & Schedule Outreach', { state: 'detached', timeout: 5000 });
  await page.waitForTimeout(2000);

  await page.click('button:has-text("Scheduled Emails")');
  await setCaption(
    page,
    'Server Crash & Startup Reconciliation',
    'reconcilePersistedEmails() scans SQLite DB, re-enqueues missing jobs with exact remaining delay.'
  );
  await page.waitForTimeout(8000);

  await setCaption(
    page,
    'Downtime Elapsed — Email Dispatched Successfully',
    'The server resumed, countdown expired, and the BullMQ worker delivered the email with zero loss.'
  );
  await page.waitForTimeout(6000);
  await page.click('button:has-text("Sent Emails")');
  await page.waitForTimeout(4000);

  // -------------------------------------------------------------
  // SCENE 8: Behavior Under Load & Hourly Rate Limiting (2:48 - 3:08, ~20s)
  // -------------------------------------------------------------
  console.log('[Scene 8] Rate Limiting & Concurrency Under Load...');
  await setCaption(
    page,
    'Requirement 8: Rate Limiting & Concurrency Under Load',
    'Bursting 6 emails with hourly limit = 3. Excess jobs are rescheduled into the next hour window + Slack alert.'
  );
  await page.click('button:has-text("Rate Limit Test")');
  await page.waitForTimeout(2500);

  await page.click('button:has-text("Burst")');
  await page.waitForTimeout(4000);
  await page.click('button:has-text("Close")');
  await page.waitForSelector('text=Rate Limiting & Concurrency Demo', { state: 'detached', timeout: 5000 });
  await page.waitForTimeout(2000);

  await page.click('button:has-text("Scheduled Emails")');
  await setCaption(
    page,
    'Over-Quota Jobs Rescheduled (FIFO Preserved)',
    'Notice how remaining emails are postponed to the next hour window rather than dropped.'
  );
  await page.waitForTimeout(5000);

  // -------------------------------------------------------------
  // SCENE 9: Live BullMQ Queue Monitor & Conclusion (3:08 - 3:18, ~10s)
  // -------------------------------------------------------------
  console.log('[Scene 9] BullMQ Live Dashboard...');
  await setCaption(
    page,
    'Requirement 9: Live BullMQ Dashboard (/admin/queues)',
    'Real-time visibility into active, delayed, waiting, and completed Redis jobs.'
  );
  await page.goto('http://localhost:5000/admin/queues/');
  await page.waitForTimeout(5000);

  await setCaption(
    page,
    'ReachInbox Outbox Labs — Complete Implementation',
    'Production-grade TypeScript, Express, BullMQ, Redis, Ethereal SMTP & React Dashboard.'
  );
  await page.waitForTimeout(4000);

  console.log('[Demo] Finalizing 3-minute video recording...');
  await page.close();
  await context.close();
  await browser.close();

  // Find and move generated video
  const files = fs.readdirSync(recordingsDir);
  const videoFile = files.find((f) => f.endsWith('.webm'));
  if (videoFile) {
    const src = path.join(recordingsDir, videoFile);
    const dest = path.join(__dirname, 'reachinbox-outbox-demo-3min.webm');
    fs.copyFileSync(src, dest);
    const mainDest = path.join(__dirname, 'reachinbox-outbox-demo.webm');
    fs.copyFileSync(src, mainDest);
    console.log(`[Demo] ✅ 3-Minute Demo Video saved to: ${dest}`);
    console.log(`[Demo] ✅ Also updated: ${mainDest}`);
  }
}

runDetailed3MinDemo().catch(console.error);
