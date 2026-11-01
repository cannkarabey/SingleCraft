-- MVP source registry (SignalCraft.pdf §6, IMPLEMENTATION_PLAN §5.1).
-- Feed URLs are re-validated by the Faz 2 fetchers; a source that keeps failing is
-- deactivated automatically (5 consecutive failures).
insert into public.sources (name, type, url, trust_weight, fetch_interval_min, active, config) values
  -- Lab / company blogs
  ('OpenAI News',           'rss', 'https://openai.com/news/rss.xml',                               0.95, 30, true,  '{"niche_specific": true}'),
  ('Anthropic News',        'rss', 'https://www.anthropic.com/news',                                0.95, 30, false, '{"niche_specific": true, "note": "no official RSS feed; needs an HTML fetcher"}'),
  ('Google DeepMind Blog',  'rss', 'https://deepmind.google/blog/rss.xml',                          0.95, 30, true,  '{"niche_specific": true}'),
  ('Google AI Blog',        'rss', 'https://blog.google/technology/ai/rss/',                        0.90, 30, true,  '{"niche_specific": true}'),
  ('Hugging Face Blog',     'rss', 'https://huggingface.co/blog/feed.xml',                          0.90, 30, true,  '{"niche_specific": true}'),
  ('GitHub Blog',           'rss', 'https://github.blog/feed/',                                     0.90, 30, true,  '{"niche_specific": true}'),
  ('Vercel Blog',           'rss', 'https://vercel.com/atom',                                       0.85, 30, true,  '{"niche_specific": true}'),
  ('Simon Willison',        'rss', 'https://simonwillison.net/atom/everything/',                    0.85, 30, true,  '{"niche_specific": true}'),
  -- Tech press (general-purpose: off-niche items are filtered)
  ('TechCrunch AI',         'rss', 'https://techcrunch.com/category/artificial-intelligence/feed/', 0.75, 30, true,  '{"niche_specific": false}'),
  ('The Verge AI',          'rss', 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', 0.75, 30, true, '{"niche_specific": false}'),
  ('Ars Technica AI',       'rss', 'https://arstechnica.com/ai/feed/',                              0.80, 30, true,  '{"niche_specific": false}'),
  ('VentureBeat AI',        'rss', 'https://venturebeat.com/category/ai/feed/',                     0.70, 30, true,  '{"niche_specific": false}'),
  -- Product changelogs
  ('Supabase Blog',         'rss', 'https://supabase.com/rss.xml',                                  0.85, 60, true,  '{"niche_specific": true}'),
  ('Stripe Blog',           'rss', 'https://stripe.com/blog/feed.rss',                              0.85, 60, true,  '{"niche_specific": true}'),
  ('Cloudflare Blog',       'rss', 'https://blog.cloudflare.com/rss/',                              0.85, 60, true,  '{"niche_specific": true}'),
  ('Linear Changelog',      'rss', 'https://linear.app/rss/changelog.xml',                          0.80, 60, true,  '{"niche_specific": true}'),
  -- Hacker News (Algolia API)
  ('Hacker News Front Page','hn',  'https://hn.algolia.com/api/v1/search?tags=front_page',          0.75, 30, true,  '{"tags": "front_page"}'),
  ('Show HN',               'hn',  'https://hn.algolia.com/api/v1/search_by_date?tags=show_hn',     0.65, 30, true,  '{"tags": "show_hn"}'),
  -- Reddit (subreddit RSS; see plan §1 #20)
  ('r/MachineLearning',     'reddit', 'https://www.reddit.com/r/MachineLearning/.rss',              0.60, 60, true,  '{"subreddit": "MachineLearning"}'),
  ('r/LocalLLaMA',          'reddit', 'https://www.reddit.com/r/LocalLLaMA/.rss',                   0.60, 60, true,  '{"subreddit": "LocalLLaMA"}'),
  ('r/webdev',              'reddit', 'https://www.reddit.com/r/webdev/.rss',                       0.55, 60, true,  '{"subreddit": "webdev"}'),
  ('r/SideProject',         'reddit', 'https://www.reddit.com/r/SideProject/.rss',                  0.50, 60, true,  '{"subreddit": "SideProject"}'),
  ('r/singularity',         'reddit', 'https://www.reddit.com/r/singularity/.rss',                  0.45, 60, true,  '{"subreddit": "singularity"}'),
  -- Product Hunt (GraphQL v2, developer token)
  ('Product Hunt',          'producthunt', 'https://api.producthunt.com/v2/api/graphql',            0.60, 60, true,  '{"window": "today"}'),
  -- GitHub (search for rising repos + release feeds)
  ('GitHub Rising Repos',   'github', 'https://api.github.com/search/repositories',                 0.70, 60, true,  '{"mode": "search", "window_days": 7, "sort": "stars"}'),
  ('Next.js Releases',      'github', 'https://github.com/vercel/next.js/releases.atom',            0.85, 60, true,  '{"mode": "releases", "repo": "vercel/next.js"}'),
  ('Transformers Releases', 'github', 'https://github.com/huggingface/transformers/releases.atom',   0.85, 60, true,  '{"mode": "releases", "repo": "huggingface/transformers"}'),
  ('Ollama Releases',       'github', 'https://github.com/ollama/ollama/releases.atom',             0.85, 60, true,  '{"mode": "releases", "repo": "ollama/ollama"}'),
  -- arXiv (published once a day)
  ('arXiv cs.AI',           'arxiv', 'https://rss.arxiv.org/rss/cs.AI',                             0.70, 720, true, '{"category": "cs.AI"}'),
  ('arXiv cs.CL',           'arxiv', 'https://rss.arxiv.org/rss/cs.CL',                             0.70, 720, true, '{"category": "cs.CL"}'),
  ('arXiv cs.LG',           'arxiv', 'https://rss.arxiv.org/rss/cs.LG',                             0.70, 720, true, '{"category": "cs.LG"}'),
  -- YouTube (channel RSS, not the Data API)
  ('Fireship',              'youtube', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA', 0.75, 180, true, '{"channel_id": "UCsBjURrPoezykLs9EqgamOA"}'),
  ('Two Minute Papers',     'youtube', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCbfYPyITQ-7l4upoX8nvctg', 0.75, 180, true, '{"channel_id": "UCbfYPyITQ-7l4upoX8nvctg"}'),
  ('Andrej Karpathy',       'youtube', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCXUPKJO5MZQN11PqgIvyuvQ', 0.85, 180, true, '{"channel_id": "UCXUPKJO5MZQN11PqgIvyuvQ"}'),
  ('Yannic Kilcher',        'youtube', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCZHmQk67mSJgfCCTn7xBfew', 0.75, 180, true, '{"channel_id": "UCZHmQk67mSJgfCCTn7xBfew"}');
