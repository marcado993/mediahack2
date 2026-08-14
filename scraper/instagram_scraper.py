"""
Starter scraper for the "escucha de medios" module: pulls recent posts from
public news-portal Instagram accounts so their captions/hashtags can feed a
topic/keyword layer alongside the IVD dashboard.

Only scrapes public accounts you list explicitly (news outlets, not private
users) - this is a media-monitoring tool, not a general-purpose account
scraper. Respect Instagram's rate limits and terms of service; this is for
research/hackathon use, not high-volume harvesting.

Ban-risk mitigations (read this if you're running this on a throwaway
account - it still helps, a flagged/challenged account is a dead end
either way):
  - `client.delay_range` makes instagrapi sleep a random 2-5s between every
    internal request it makes, instead of firing them back-to-back.
  - An extra random pause between accounts (not just between requests)
    breaks up the "scraping N accounts in one steady burst" pattern.
  - ChallengeRequired/PleaseWaitFewMinutes abort the run immediately rather
    than retrying - retrying into a challenge is how accounts get
    permanently banned, not just rate-limited.
  - Start with a LOW POSTS_PER_ACCOUNT (default 8) and a SHORT NEWS_ACCOUNTS
    list on a brand-new account. Scale up gradually over days, not in one
    session. Ideally, log into the account from the real Instagram app a
    few times first so it doesn't look brand-new-and-immediately-automated.

Usage:
    python instagram_scraper.py

Fill NEWS_ACCOUNTS below with the outlets you want to track, and set
IG_USERNAME / IG_PASSWORD in a .env file (see .env.example) - instagrapi
needs a logged-in session to read most public content reliably.
"""
from __future__ import annotations

import json
import os
import random
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from instagrapi import Client
from instagrapi.exceptions import ChallengeRequired, FeedbackRequired, PleaseWaitFewMinutes

load_dotenv()

# Public news-portal accounts to monitor. Fill in real handles (no "@").
NEWS_ACCOUNTS: list[str] = [
    # "primicias.ec",
    # "elcomerciocom",
    # "eluniversocom",
]

POSTS_PER_ACCOUNT = 8  # keep this low, especially on a new/throwaway account
DELAY_RANGE = [2, 5]  # seconds, applied by instagrapi between its own internal requests
ACCOUNT_PAUSE_RANGE = (10, 30)  # seconds, an extra human-like pause between accounts

OUTPUT_PATH = Path(__file__).parent / "output" / "posts.json"
SESSION_PATH = Path(os.getenv("IG_SESSION_PATH", "./session.json"))


def get_client() -> Client:
    client = Client()
    client.delay_range = DELAY_RANGE
    if SESSION_PATH.exists():
        client.load_settings(SESSION_PATH)
    username = os.getenv("IG_USERNAME")
    password = os.getenv("IG_PASSWORD")
    if not username or not password:
        raise RuntimeError("Set IG_USERNAME and IG_PASSWORD in .env (see .env.example)")
    client.login(username, password)
    client.dump_settings(SESSION_PATH)
    return client


def scrape_account(client: Client, username: str, limit: int) -> list[dict]:
    user_id = client.user_id_from_username(username)
    medias = client.user_medias(user_id, amount=limit)
    return [
        {
            "account": username,
            "post_id": m.pk,
            "caption": m.caption_text,
            "hashtags": [w[1:] for w in (m.caption_text or "").split() if w.startswith("#")],
            "taken_at": m.taken_at.isoformat() if m.taken_at else None,
            "like_count": m.like_count,
            "comment_count": m.comment_count,
            "url": f"https://www.instagram.com/p/{m.code}/",
        }
        for m in medias
    ]


def main() -> None:
    if not NEWS_ACCOUNTS:
        raise SystemExit("NEWS_ACCOUNTS is empty - add the outlets you want to track first.")

    client = get_client()
    all_posts: list[dict] = []

    for i, account in enumerate(NEWS_ACCOUNTS):
        print(f"Scraping @{account}...")
        try:
            all_posts.extend(scrape_account(client, account, POSTS_PER_ACCOUNT))
        except (ChallengeRequired, PleaseWaitFewMinutes, FeedbackRequired) as e:
            print(
                f"Instagram pushed back ({type(e).__name__}) while scraping @{account} - "
                "stopping now instead of retrying. Wait at least a day before running again, "
                "and consider using the account normally (manually) in between runs."
            )
            break

        if i < len(NEWS_ACCOUNTS) - 1:
            pause = random.uniform(*ACCOUNT_PAUSE_RANGE)
            print(f"  pausing {pause:.0f}s before the next account...")
            time.sleep(pause)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {"scraped_at": datetime.now(timezone.utc).isoformat(), "posts": all_posts}
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(all_posts)} posts to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
