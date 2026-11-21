# SEO Roast Roadmap: classcoach.in (2026-11-21)

Verdict: the site is crawlable and the pages are good, but Google barely knows it exists. A `site:classcoach.in` search returned nothing, so traffic is an indexing and authority problem, not a content problem.

Method: the `seo-roast` workflow from Illyism/seo-skills (MIT), run against this repo and the live site.

## What passed
- robots.txt: default-allow, only private app paths blocked, sitemap listed. No public page is caught by a Disallow prefix.
- Unknown URLs return a real 404 (no soft-404 homepage clones).
- `classcoach.in` → `www.classcoach.in`, with matching canonical tags.
- Pricing is plain server-rendered HTML, readable by AI crawlers that don't run JavaScript.
- Instant value without signup: free question paper and OMR tools (no "book a demo" wall).
- Built-in backlink loop: "Made with ClassCoach" on parent reports, student pages, Live Quiz and free papers.

## Roadmap (ordered by revenue impact)

| # | Tier | Issue | Revenue impact | Fix | Owner | Status |
|---|---|---|---|---|---|---|
| 1 | FATAL | Site almost unindexed | No search traffic at all, whatever the pages say | Submit `https://www.classcoach.in/sitemap.xml` in Google Search Console, then use URL Inspection → Request indexing for `/`, `/pricing`, `/free-question-paper-generator`, `/question-paper-generator` | Akbar | next (10 min) |
| 2 | FATAL | Not submitted to Bing | Bing feeds ChatGPT search, Copilot and DuckDuckGo | IndexNow now pings Bing with every public URL after each deploy. Also add the site in Bing Webmaster Tools ("Import from Google Search Console") and set `BING_SITE_VERIFICATION` on Railway | agent + Akbar | IndexNow shipped in PR; Bing WMT next |
| 3 | REVENUE | `/question-paper-generator` served two different pages (old landing page shadowed the new class index; sitemap listed it twice) | The 38 class/language pages had no hub linking to them | Class + language grid added to the existing landing page; duplicate removed from sitemap | agent | shipped in PR |
| 4 | REVENUE | Homepage title was brand-first with no search term | Ranks for nothing but "ClassCoach" | Title now "AI Test & Question Paper Generator for Teachers \| ClassCoach"; description rewritten around the outcome | agent | shipped in PR |
| 5 | REVENUE | No `llms.txt`; product JSON-LD hand-typed and only on the homepage (missing NEET/JEE plans) | AI assistants can't quote accurate prices or features | `/llms.txt` and SoftwareApplication JSON-LD now generated from `lib/plans.js` on `/` and `/pricing`, so they can never disagree with the pricing page | agent | shipped in PR |
| 6 | REVENUE | 2 of 4 FAQ answers identical on all 38 SEO pages | Boilerplate across a template reads as thin content | FAQs now name the class, subject or language | agent | shipped in PR |
| 7 | COMPOUNDING | Almost no referring domains | New domain can't rank for competitive terms | Directory listings already planned (SaaSHub, AlternativeTo, Product Hunt, G2, Capterra/GetApp, Tekpon, SoftwareWorld, GoodFirms). Add Indian edtech and AI-tool directories next (`directory-submissions` skill has the list) | Akbar's assistant | in progress |
| 8 | COMPOUNDING | No comparison pages | Teachers search "Google Forms alternative for teachers", "Kahoot alternative India", "Quizizz alternative" | `/vs/google-forms` and `/vs/kahoot` shipped with sourced facts (seo/competitors/). Wayground (Quizizz) skipped: its pricing page couldn't be verified | agent | shipped; Wayground later |
| 9 | COMPOUNDING | Blog posts don't route readers to money pages | Blog traffic doesn't turn into signups | Run the `internal-linking` skill on published posts: 3+ in-text links each to `/free-question-paper-generator`, `/pricing` and the matching class page | agent | after #8 |
| 10 | COMPOUNDING | No video presence | YouTube is a search engine teachers use, and videos rank in Google | 30-second Shorts: "Tamil question paper in 60 seconds", "Textbook photo → graded test" (`youtube-seo` skill for titles and descriptions) | Akbar | next |

## Verify after deploy
- `https://www.classcoach.in/llms.txt` shows plans and prices
- `https://www.classcoach.in/question-paper-generator` shows the class and language grid at the bottom
- View source of `/pricing`: contains `"@type":"SoftwareApplication"` with INR offers
- Railway logs, about 30 seconds after the deploy: `[IndexNow] Submitted … URLs`
- Google Rich Results Test on `/` and a class page: FAQ and SoftwareApplication detected

## Fluff (ignore until the rows above ship)
- Image alt text on decorative emoji icons
- Meta description lengths on older landing pages
