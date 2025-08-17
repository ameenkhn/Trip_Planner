import sys
import io
import asyncio
import json
import random
from datetime import datetime
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

# Fix Windows console Unicode issue 
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

class BookingScraper:
    def __init__(self):
        self.base_url = "https://www.booking.com"
    
    async def init_browser(self, playwright):
        browser = await playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox", "--disable-setuid-sandbox",
                "--disable-dev-shm-usage", "--disable-gpu",
                "--no-first-run", "--no-zygote",
                "--disable-blink-features=AutomationControlled"
            ]
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
            java_script_enabled=True,
        )
        await context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => undefined })"
        )
        return browser, context

    def format_duration(self, checkin_date, checkout_date):
        try:
            d1 = datetime.strptime(checkin_date, "%Y-%m-%d")
            d2 = datetime.strptime(checkout_date, "%Y-%m-%d")
            days = (d2 - d1).days
            if days <= 0:
                return "Same day stay"
            return f"{days} day{'s' if days != 1 else ''} {days} night{'s' if days != 1 else ''}"
        except Exception:
            return ""

    async def scrape_hotels(self, location, checkin_date, checkout_date,
                            num_adults, num_children, children_ages):
        async with async_playwright() as pw:
            browser, context = await self.init_browser(pw)
            try:
                page = await context.new_page()

                # Build search URL
                q = location.replace(" ", "+")
                ages_str = "&".join([f"age={a}" for a in (children_ages or [])])
                url = (
                    f"{self.base_url}/searchresults.html?"
                    f"ss={q}&checkin={checkin_date}&checkout={checkout_date}"
                    f"&group_adults={num_adults}&no_rooms=1&group_children={num_children}"
                )
                if ages_str:
                    url += f"&{ages_str}"

                await page.goto(url, wait_until="domcontentloaded")

                # Wait for at least one property card
                try:
                    await page.wait_for_selector("[data-testid='property-card']", timeout=15000)
                except Exception:
                    pass

                # Scroll to trigger lazy load
                await page.wait_for_timeout(random.randint(1500, 2500))
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await page.wait_for_timeout(1500)

                # Parse HTML
                html = await page.content()
                soup = BeautifulSoup(html, "html.parser")
                cards = soup.select("[data-testid='property-card']")

                results = []
                for card in cards:
                    name_el = card.select_one("[data-testid='title']")
                    price_el = card.select_one("span[data-testid='price-and-discounted-price']")
                    if not price_el:
                        price_el = card.select_one("span[class*='price']")

                    name = name_el.text.strip() if name_el else "N/A"
                    price = price_el.text.strip() if price_el else "N/A"

                    children_part = ""
                    if num_children > 0:
                        ages_txt = ", ".join(map(str, children_ages or [])) if children_ages else "N/A"
                        children_part = f", {num_children} children (ages: {ages_txt})"

                    results.append({
                        "name": name,
                        "price": price,
                        "duration": self.format_duration(checkin_date, checkout_date),
                        "person_details": f"{num_adults} adults{children_part}",
                    })

                return results
            finally:
                await context.close()
                await browser.close()

# CLI entry point
async def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Expected JSON params in argv"}))
        return

    try:
        params = json.loads(sys.argv[1])
    except Exception as e:
        print(json.dumps({"error": f"Invalid params JSON: {e}"}))
        return

    scraper = BookingScraper()
    try:
        hotels = await scraper.scrape_hotels(
            params.get("location", ""),
            params.get("checkin_date", ""),
            params.get("checkout_date", ""),
            int(params.get("num_adults", 1)),
            int(params.get("num_children", 0)),
            params.get("children_ages", []),
        )
        print(json.dumps(hotels, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())