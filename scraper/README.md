# Escucha de medios — scraper

Starter module for the media-listening layer: pulls posts from public news
outlets on Instagram and Facebook and turns their captions into a
topic/keyword frequency table. Separate from `backend/` (the Ecuador IVD
API) since this is meant to grow beyond Ecuador and beyond a single
platform.

## Setup

```bash
cd scraper
pip install -r requirements.txt
cp .env.example .env
# edit .env: set IG_USERNAME / IG_PASSWORD, and FB_COOKIES if using Facebook
```

**Instagram** — edit `NEWS_ACCOUNTS` in `instagram_scraper.py` with the
outlet handles you want to track (no `@`), then:

```bash
python instagram_scraper.py   # writes output/posts.json
```

**Facebook** — via [kevinzg/facebook-scraper](https://github.com/kevinzg/facebook-scraper)
(free, no API key, `pip install facebook-scraper`). Note the script is
called `fb_scraper.py`, not `facebook_scraper.py` - naming it the same as
the library it imports would shadow the real package.

This library **needs your Facebook cookies to work** - confirmed by testing
it directly: anonymous requests get redirected to a login wall and silently
return zero posts, no error. Get cookies one of two ways:
  1. Log into Facebook in your normal browser, export `facebook.com` cookies
     with an extension like "Get cookies.txt LOCALLY," save as
     `scraper/facebook_cookies.txt`, point `FB_COOKIES` at that path.
  2. Or `pip install browser_cookie3` and set `FB_COOKIES=from_browser` if
     you're logged into Facebook in a browser on this same machine.

This scrapes as your logged-in account - the same ban-risk mitigations as
the Instagram scraper apply (see below), maybe more so since this can't run
without an authenticated session at all. Then edit `NEWS_PAGES` in
`fb_scraper.py` and run:

```bash
python fb_scraper.py          # writes output/facebook_posts.json
```

**Topics** — once you have posts from either source:

```bash
python topics.py              # reads output/posts.json, writes output/topics.json
```

(`topics.py` currently only reads the Instagram output; point it at
`facebook_posts.json` too, or merge both files, once you're running both
scrapers.)

## Notes

- **Public accounts/pages only.** This is built for monitoring news outlets,
  not scraping private users — keep it that way.
- **`topics.py` is intentionally crude** (word frequency + a short Spanish
  stopword list, no real NLP). It's a placeholder to get "what's being
  talked about" flowing end-to-end; swap in something better once the
  pipeline itself is proven out.

### Keeping the account from getting banned

If you're running either scraper on a throwaway account, these still
matter — a challenged/banned account is a dead end regardless of whether it
was "important." (Facebook-specific: since `fb_scraper.py` needs real
cookies to work at all, there's no anonymous fallback if the account gets
flagged - budget accordingly.)

**Instagram** (`instagram_scraper.py`):
- `client.delay_range = [2, 5]` makes instagrapi pause 2-5s between its own
  internal requests instead of firing them back-to-back.
- An extra 10-30s pause **between accounts** breaks up the "steady burst"
  pattern automation detection looks for.
- `POSTS_PER_ACCOUNT` defaults to **8**, on purpose.
- On a challenge (`ChallengeRequired`, `PleaseWaitFewMinutes`,
  `FeedbackRequired`), the script stops immediately instead of retrying —
  retrying into a challenge is how accounts go from "rate-limited" to
  "permanently banned."

**Facebook** (`fb_scraper.py`) — this library has no built-in throttle, so
the pacing is entirely manual:
- 3-7s sleep **between every post fetched**, not just between pages -
  `get_posts()` is a lazy generator, so sleeping before asking it for the
  next post is what actually spaces out the underlying page requests.
- An extra 20-45s pause **between Facebook pages** you're tracking.
- `POSTS_PER_PAGE` defaults to **8**.
- On `TemporarilyBanned` or `AccountDisabled`, the script stops immediately
  rather than retrying - same reasoning as Instagram, worse consequences
  here since there's no anonymous fallback mode to fall back to.

**Both:** scale up gradually across days, not within one run. Best real
mitigation isn't in any code at all: use the account normally (like a real
person would - browse, like a few things, across a few days) before
pointing a scraper at it. A brand-new account that's immediately 100%
automated is the pattern that gets flagged fastest, on either platform.

## Where this goes next

Once `output/topics.json` looks like something worth showing, the natural
next step is the same pattern used for the IVD data: hand the output over
and it gets wired into the backend as a new endpoint + a panel in the
frontend (`frontend/src/lib/organisms/`). Nothing on the consuming side
exists yet — this module doesn't write into `backend/` or `frontend/` on its
own.
