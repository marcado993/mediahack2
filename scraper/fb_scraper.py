"""
Facebook side of the "escucha de medios" module, using kevinzg/facebook-scraper
(https://github.com/kevinzg/facebook-scraper) - free, no API key, pip install.

Confirmed by testing directly: anonymous requests (no cookies) get redirected
from m.facebook.com to www.facebook.com and hit a login wall - zero posts,
no error, just an empty result. The library's own README says so too: "If
something isn't working as expected, try pass cookies." So this needs your
Facebook cookies to work; there's no way around that with this library.

Getting cookies (pick one):
  1. Log into Facebook in your normal browser, export cookies.txt for
     facebook.com with an extension like "Get cookies.txt LOCALLY", save it
     as scraper/facebook_cookies.txt (Netscape format - the extension does
     this automatically).
  2. Or, if you're logged into Facebook in a browser installed on this same
     machine: pip install browser_cookie3, then set FB_COOKIES=from_browser
     in .env - the library will pull cookies straight from your browser.

Either way this scrapes AS your logged-in account, on your behalf. Unlike
Instagram's instagrapi, this library has NO built-in delay/throttle option,
so the pacing below (sleep per post, longer pause per page) is entirely
manual - see the "ban-risk mitigations" note in the README before running
this against an account you care about.

Usage:
    python fb_scraper.py
"""
from __future__ import annotations

import json
import os
import random
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from facebook_scraper import get_posts, set_cookies
from facebook_scraper.exceptions import AccountDisabled, LoginRequired, TemporarilyBanned

load_dotenv()

# Public news-portal Facebook pages to monitor (page username/slug, not full URL).
NEWS_PAGES: list[str] = [
    # "primicias.ec",
    # "elcomerciocom",
]

POSTS_PER_PAGE = 8  # keep this low, especially on a new/throwaway account
POST_DELAY_RANGE = (3, 7)  # seconds, between each post fetched (throttles pagination)
PAGE_PAUSE_RANGE = (20, 45)  # seconds, an extra human-like pause between Facebook pages

OUTPUT_PATH = Path(__file__).parent / "output" / "facebook_posts.json"


def configure_cookies() -> None:
    cookies = os.environ.get("FB_COOKIES")
    if not cookies:
        raise RuntimeError(
            "Set FB_COOKIES in .env - either a path to a cookies.txt file, or "
            "the literal value 'from_browser' (see the module docstring)."
        )
    set_cookies(cookies)


def scrape_page(page: str, limit: int) -> list[dict]:
    posts = []
    for post in get_posts(page, pages=max(2, limit // 4)):
        posts.append(
            {
                "page": page,
                "post_id": post.get("post_id"),
                "text": post.get("text"),
                "time": post.get("time").isoformat() if post.get("time") else None,
                "likes": post.get("likes"),
                "comments": post.get("comments"),
                "shares": post.get("shares"),
                "post_url": post.get("post_url"),
            }
        )
        if len(posts) >= limit:
            break
        # get_posts() is a lazy generator - sleeping here, before asking for
        # the next post, is what actually throttles the underlying page
        # fetches instead of firing them back-to-back.
        time.sleep(random.uniform(*POST_DELAY_RANGE))
    return posts


def main() -> None:
    if not NEWS_PAGES:
        raise SystemExit("NEWS_PAGES is empty - add the outlets you want to track first.")

    configure_cookies()
    all_posts: list[dict] = []

    for i, page in enumerate(NEWS_PAGES):
        print(f"Scraping {page}...")
        try:
            all_posts.extend(scrape_page(page, POSTS_PER_PAGE))
        except LoginRequired:
            print(
                f"  Facebook demanded a login for {page} even with cookies set - "
                "they may have expired. Re-export cookies.txt and try again."
            )
        except (TemporarilyBanned, AccountDisabled) as e:
            print(
                f"  Account flagged ({type(e).__name__}) while scraping {page} - "
                "stopping now instead of retrying. Wait at least a day before running "
                "again, and use the account normally (manually) in between runs."
            )
            break

        if i < len(NEWS_PAGES) - 1:
            pause = random.uniform(*PAGE_PAUSE_RANGE)
            print(f"  pausing {pause:.0f}s before the next page...")
            time.sleep(pause)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {"scraped_at": datetime.now(timezone.utc).isoformat(), "posts": all_posts}
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(f"Wrote {len(all_posts)} posts to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
