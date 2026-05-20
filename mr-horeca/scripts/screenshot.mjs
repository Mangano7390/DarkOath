import puppeteer from "puppeteer";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3002";
const OUT = "/tmp/screens";

const pages = [
  { name: "01-home", path: "/", viewport: { width: 1440, height: 900 } },
  { name: "01b-home-mobile", path: "/", viewport: { width: 414, height: 896 } },
  { name: "02-catalogue", path: "/catalogue", viewport: { width: 1440, height: 900 } },
  { name: "03-category-cuisson", path: "/c/cuisson", viewport: { width: 1440, height: 900 } },
  { name: "04-product-four-pizza", path: "/p/four-pizza-gaz-9p", viewport: { width: 1440, height: 1100 } },
  { name: "05-product-chambre-froide", path: "/p/chambre-froide-300", viewport: { width: 1440, height: 1100 } },
  { name: "06-cart-empty", path: "/cart", viewport: { width: 1440, height: 900 } },
  { name: "07-contact", path: "/contact", viewport: { width: 1440, height: 900 } },
];

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

for (const p of pages) {
  const page = await browser.newPage();
  await page.setViewport(p.viewport);
  const url = BASE + p.path;
  process.stdout.write(`→ ${url} ... `);
  try {
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: `${OUT}/${p.name}.png`, fullPage: true });
    console.log(`ok`);
  } catch (e) {
    console.log(`ERR ${e.message}`);
  }
  await page.close();
}

await browser.close();
console.log(`\nScreens dans ${OUT}/`);
