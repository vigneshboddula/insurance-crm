// Captures screenshots of every main screen into docs/screenshots/ for the
// illustrated guide. Run with the app already serving on http://localhost:3000:
//   node scripts/screenshots.mjs
import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "docs", "screenshots");
mkdirSync(OUT, { recursive: true });

const BASE = process.env.BASE_URL || "http://localhost:3000";
const CID = process.env.CID || "";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const shots = [
  { name: "01-dashboard", path: "/", wait: 3000 },
  { name: "02-policy-holders", path: "/clients", wait: 1500 },
  { name: "03-profile", path: CID ? `/clients/${CID}` : "/clients", wait: 2000 },
  { name: "04-renewals", path: "/renewals", wait: 1500 },
  { name: "05-leads", path: "/leads", wait: 1500 },
  { name: "06-tasks", path: "/tasks", wait: 1200 },
  { name: "07-import", path: "/import", wait: 1500 },
  { name: "08-whatsapp", path: "/whatsapp", wait: 2500 },
  { name: "09-assistant", path: "/assistant", wait: 1500 },
  { name: "10-settings", path: "/settings", wait: 1500 },
];

const main = async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1360, height: 900, deviceScaleFactor: 1.25 });

  for (const s of shots) {
    try {
      await page.goto(BASE + s.path, { waitUntil: "networkidle2", timeout: 45000 });
      await sleep(s.wait);
      await page.screenshot({ path: join(OUT, s.name + ".png") });
      console.log("captured", s.name);
    } catch (e) {
      console.log("FAILED", s.name, e.message);
    }
  }

  // Bonus: the AI draft modal on a renewal (shows the one-click flow)
  try {
    await page.goto(BASE + "/renewals", { waitUntil: "networkidle2", timeout: 45000 });
    await sleep(1000);
    await page.click('button[aria-label="Draft with AI"]');
    // wait until the draft textarea has content
    await page.waitForFunction(() => {
      const ta = document.querySelector('[role="dialog"] textarea');
      return ta && ta.value && ta.value.length > 30;
    }, { timeout: 30000 });
    await sleep(500);
    await page.screenshot({ path: join(OUT, "11-ai-draft-modal.png") });
    console.log("captured", "11-ai-draft-modal");
  } catch (e) {
    console.log("FAILED", "11-ai-draft-modal", e.message);
  }

  await browser.close();
  console.log("done →", OUT);
};

main().catch((e) => { console.error(e); process.exit(1); });
