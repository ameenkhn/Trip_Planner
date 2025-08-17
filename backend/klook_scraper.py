import sys, json, time, re
from contextlib import suppress
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

params = {}
if len(sys.argv) > 1:
    try:
        params = json.loads(sys.argv)
    except:
        params = {}

target_url = params.get("url") or "https://www.klook.com/search/result/?query=popular%20destination&spm=Home.SearchStart_SearchHistory_LIST&clickId=079ac2d4a5"
limit = int(params.get("limit", 40))

BASE = "https://www.klook.com"

def safe_click(page, locator, timeout=3000):
    with suppress(Exception):
        el = page.locator(locator).first
        if el.is_visible(timeout=timeout):
            el.click()

def wait_any_selector(page, selectors, timeout_ms=60000):
    deadline = time.time() + (timeout_ms/1000)
    while time.time() < deadline:
        for sel in selectors:
            with suppress(Exception):
                if page.locator(sel).first.is_visible():
                    return sel
        time.sleep(0.5)
    raise TimeoutError(f"None of selectors became visible: {selectors}")

def progressive_scroll(page, steps=10, pause=400):
    for _ in range(steps):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(pause)

def clean_text(s):
    return re.sub(r"\s+", " ", s).strip() if s else ""

items = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(
        user_agent=("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"),
        locale="en-US",
        timezone_id="Asia/Kolkata",
    )
    page.goto(target_url, timeout=90000)
    page.wait_for_load_state("domcontentloaded")

    # Consent/cookie banners
    for btn in [
        'button:has-text("Accept")',
        'button:has-text("I agree")',
        'button:has-text("Agree")',
        'button:has-text("OK")',
        'button:has-text("Got it")',
    ]:
        safe_click(page, btn)
    page.wait_for_timeout(500)

    # Scroll to load more
    progressive_scroll(page, steps=10, pause=400)

    # Try several result container selectors (search pages vary)
    selectors = [
        "a[href*='/activity/']",        # activity/product links
        "a[href*='/city/']",            # city links sometimes appear in search
        "a[href*='/destination/']",
        "[data-testid='product-card'] a",  # hypothetical stable testid
    ]

    try:
        wait_any_selector(page, selectors, timeout_ms=90000)
    except Exception:
        with suppress(Exception):
            page.screenshot(path="klook_search_fail.png", full_page=True)
            with open("klook_search_fail.html", "w", encoding="utf-8") as f:
                f.write(page.content())
        raise

    html = page.content()
    soup = BeautifulSoup(html, "html.parser")

    # Collect anchors in priority order
    anchors = []
    for sel in ["a[href*='/activity/']", "a[href*='/city/']", "a[href*='/destination/']"]:
        anchors.extend(soup.select(sel))

    # De-duplicate by href
    seen = set()
    results = []
    for a in anchors:
        href = a.get("href") or ""
        if not href or href.startswith("#") or href.startswith("javascript:"):
            continue
        if href in seen:
            continue
        seen.add(href)
        link = urljoin(BASE, href)

        # Title/name
        title = a.get("aria-label") or a.get("title") or clean_text(a.get_text(" ", strip=True))
        if not title:
            h = a.select_one("h1,h2,h3,h4,span,strong,div")
            title = clean_text(h.get_text(" ", strip=True)) if h else ""

        # Image
        img = a.select_one("img")
        image = ""
        if img:
            image = img.get("src") or img.get("data-src") or img.get("data-lazy") or ""

        # Price (look around the link’s parent)
        price = ""
        parent = a.parent
        if parent:
            # common price classes vary; try nearby text containing currency or digits
            cand = parent.select_one(".price, .Price, [class*='price'], [data-testid*='price']")
            if cand:
                price = clean_text(cand.get_text(" ", strip=True))
            else:
                # fallback: sibling text with currency symbol
                sib_text = clean_text(parent.get_text(" ", strip=True))
                m = re.search(r"(₹|INR|\$|HK\$|S\$|RM|NT\$|₩|¥)\s?[\d,]+(?:\.\d+)?", sib_text)
                if m:
                    price = m.group(0)

        # Rating/reviews (best-effort)
        rating = ""
        reviews = ""
        if parent:
            r = parent.select_one("[aria-label*='rating'], [class*='rating'], [data-testid*='rating']")
            if r:
                rating = clean_text(r.get_text(" ", strip=True))
            rc = parent.select_one("[class*='review'], [data-testid*='review']")
            if rc:
                reviews = clean_text(rc.get_text(" ", strip=True))

        # Only keep if there is a plausible title
        if title:
            results.append({
                "title": title,
                "image": image,
                "link": link,
                "price": price,
                "rating": rating,
                "reviews": reviews
            })

        if len(results) >= limit:
            break

    browser.close()

print(json.dumps(results, ensure_ascii=False))