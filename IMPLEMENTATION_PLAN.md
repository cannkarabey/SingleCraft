# SignalCraft — Implementation Plan / Walkthrough

> Kaynak: `SignalCraft.pdf` (Build Brief & Workthrough, 19 bölüm).
> Bu doküman PDF'teki ürün tanımını **koda dönüştürülebilir adımlara** çevirir: önce PDF'te boş kalan ya da çelişen noktalar için alınan kararlar, sonra mimari, şema, pipeline algoritmaları, ekranlar ve fazlara bölünmüş iş listesi (her faz için "bitti" kriterleri).
> Kod yazan AI'a fazları **sırayla ve tek tek** ver; her fazın sonunda kabul kriterlerini kontrol et.

---

## 0. Bir bakışta

|                |                                                                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ürün           | Tech/AI içerik üreticileri için sinyal radarı: **Discover → Radar → Studio**                                                                          |
| Vaat           | "Her sabah 15 dakikada, paylaşmaya değer 5 konu + her biri için hazır brief"                                                                          |
| Stack          | Next.js (App Router, TS) · Tailwind + shadcn/ui · Supabase (Postgres, Auth, pgvector, Realtime) · Inngest · Resend · Vercel AI SDK · PostHog · Sentry |
| Maliyet kuralı | LLM yalnızca kümelenmiş + skorlanmış top-N story için ve kullanıcı tetiklediğinde (Studio) çalışır                                                    |
| MVP süresi     | ~6–7 hafta, 10 faz (Faz 0–9)                                                                                                                          |
| MVP dışı       | X API, otomatik yayın, video/görsel üretimi, ekip, mobil uygulama                                                                                     |

---

## 1. PDF'teki boşluklar ve verilen kararlar

PDF ürün olarak eksiksiz, ama koda geçerken netleşmesi gereken yerler var. Aşağıdaki kararlar bu planın geri kalanında varsayılır; **⚠️ işaretliler senin onayını isteyen iş/hukuk kararları.**

| #   | Konu                                      | PDF'te durum                                | Karar                                                                                                                                                                                                                                                                                                                           |
| --- | ----------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ⚠️ **Ödeme sağlayıcı**                    | Stripe                                      | Stripe, Türkiye'de kurulu şirketlere/kişilere satıcı hesabı açmıyor. Yurt dışı şirketin (ör. US LLC / Stripe Atlas) yoksa **Paddle** veya **Lemon Squeezy** (Merchant of Record, vergi/KDV'yi de onlar halleder) kullan. Kod tarafında `lib/billing/` altında sağlayıcıdan bağımsız bir arayüz yazılır; Faz 8'de karar verilir. |
| 2   | ⚠️ **Hosting**                            | Vercel Hobby                                | Hobby planı ticari kullanıma kapalı. Beta'ya kadar Hobby yeterli; ödeme almaya başladığın gün Vercel Pro'ya geç (ya da Cloudflare/Railway).                                                                                                                                                                                     |
| 3   | `users` tablosu                           | Ayrı tablo                                  | Supabase'de kullanıcılar `auth.users` içinde; uygulama verisi için `profiles` tablosu (1:1).                                                                                                                                                                                                                                    |
| 4   | `final_score` / `niche_fit_score`         | `stories` tablosunda                        | NicheFit **kullanıcıya özel**, global story tablosunda tutulamaz. `stories` → `global_score` (NicheFit hariç); Radar skoru okuma anında kullanıcının niş embedding'iyle SQL fonksiyonunda hesaplanır.                                                                                                                           |
| 5   | Velocity verisi                           | Formülde var, kaynağı yok                   | Yeni tablo `item_metrics`: HN puanı, Reddit upvote, GitHub yıldızı vb. zaman serisi snapshot'ları. Velocity bunlardan hesaplanır.                                                                                                                                                                                               |
| 6   | Trust                                     | Ranker'da var, formülde yok                 | Çarpan olarak: `score × (0.7 + 0.3 × trust)`. Trust < 0.4 → kırmızı signal bar.                                                                                                                                                                                                                                                 |
| 7   | Plan limitleri                            | "Günlük limit olmalı"                       | Yeni tablo `usage_counters` (kullanıcı/gün/tür). Free: 1 niş, Radar'da günde 3 sinyal, **günde 2 Studio brief'i** (config'den değiştirilebilir).                                                                                                                                                                                |
| 8   | Marka sesi örnekleri                      | Studio girdisi, şemada yok                  | MVP: `niches.voice_samples text[]` (en fazla 3 örnek). Ayrı tablo Pro'da.                                                                                                                                                                                                                                                       |
| 9   | "Kaç brief gerçekten yayınlandı?" metriği | En kritik metrik, ölçüm yolu yok            | Brief ekranında **"Yayınladım"** butonu + opsiyonel link → `briefs.published_at`, `published_url`. Digest'te de "dünkü brief'ini yayınladın mı?" linki.                                                                                                                                                                         |
| 10  | `/jobs/*` POST route'ları                 | Internal route                              | Inngest kullanıldığı için job'lar Inngest fonksiyonu olur (`/api/inngest` tek endpoint). Admin panelinde "manuel tetikle" butonları event gönderir.                                                                                                                                                                             |
| 11  | Studio uzun üretim                        | "HTTP içinde çalışmaz"                      | `POST /api/studio/generate` sadece `briefs` satırı açar + Inngest event'i atar (202). UI, satırın `status` alanını Supabase Realtime ile dinler.                                                                                                                                                                                |
| 12  | Studio çıktı miktarı                      | 10 hook + 3 başlık + 6 format, hepsi birden | İki paralel LLM adımı: **short pack** (hook, başlık, X thread, LinkedIn, Shorts hook+script) ve **long pack** (newsletter, blog). Seçilen platform önce gösterilir.                                                                                                                                                             |
| 13  | Reddit                                    | Kaynak listesinde var, MVP listesinde yok   | MVP'de Reddit **subreddit RSS** (`/r/x/.rss`) ile; upvote verisi için Faz 2'de opsiyonel `.json` uçları, düşük frekansla. Ticari kullanım için Reddit API şartlarını kontrol et.                                                                                                                                                |
| 14  | GitHub Trending                           | "Trending"                                  | Resmi API yok. GitHub Search API (`created:>7gün sort:stars`) + seçili repoların releases Atom feed'i.                                                                                                                                                                                                                          |
| 15  | UI dili                                   | Hero metni Türkçe, kaynaklar İngilizce      | **Onaylandı (2026-11-01): TR + EN.** `next-intl` **locale routing olmadan** (URL'de `/[locale]` segmenti yok, §3 yapısı aynen kalır): dil `NEXT_LOCALE` çerezinden, yoksa `Accept-Language`'den, varsayılan TR. Metinler `messages/tr.json` + `messages/en.json`; iki dosyanın anahtar seti test ile eşit tutulur. Story özetleri İngilizce üretilir, kullanıcı dili TR ise Studio çıktısı TR. |
| 19  | Free Radar kilidi                         | "Günde 3 radar sinyali"                     | Kilit **sunucu tarafında**: `/api/radar` Free kullanıcıya ilk 3 satırdan sonrası için yalnızca `{ locked: true, bucket }` döner; başlık/özet/skor gönderilmez. UI blur'u yalnızca görünüm.                                                                                                                                   |
| 20  | Reddit erişimi                            | —                                           | Reddit, veri merkezi IP'lerinden (Vercel) gelen anonim isteklere sık 403/429 döner. Reddit fetcher opsiyonel; hata pipeline'ı durdurmaz (5 ardışık hatada `active=false`).                                                                                                                                                      |
| 21  | Inngest kotası                            | —                                           | ~40 kaynak × 30 dk ≈ günde 2.000+ step. Faz 0'da güncel Free limitini doğrula; yetmezse aynı tipteki kaynaklar tek `step.run`'da batch'lenir.                                                                                                                                                                                   |
| 22  | Repo kökü                                 | §3 `signalcraft/` klasörü                   | Uygulama repo **köküne** kurulur; §3'teki `signalcraft/` yalnızca köke karşılık gelir.                                                                                                                                                                                                                                          |
| 16  | Discover erişimi                          | "Public veya kayıt sonrası"                 | **Public** (SEO + landing'deki canlı demo için). Aksiyon butonları (Radar'a ekle / Studio'da üret) giriş ister.                                                                                                                                                                                                                 |
| 17  | Arama                                     | "Arama"                                     | MVP: Postgres full-text search (`tsvector`) + `pg_trgm`. Semantik arama sonra.                                                                                                                                                                                                                                                  |
| 18  | Telif                                     | SSS'de geçiyor                              | `content_text` en fazla ~4.000 karakter, sadece işleme için saklanır, **asla UI'da gösterilmez**. UI'da yalnızca kendi özetimiz + kaynak linkleri.                                                                                                                                                                              |

---

## 2. Mimari

```
                ┌─────────────────────── Inngest (cron + event) ───────────────────────┐
                │                                                                       │
 sources ──► fetch/* ──► items.process ──────────────────────► stories.score ──► stories.build (LLM, top-N)
 (registry)  RSS, HN,    normalize → exact dedupe →             velocity, engagement,     title, summary,
             GitHub,     near dedupe (SimHash) → filter →       diversity, freshness,     why_it_matters,
             PH, arXiv,  embed → cluster (pgvector ≥0.85)       trust → global_score      category, angles
             YouTube,                                           + trend_scores snapshot
             Reddit      metrics.refresh (HN/Reddit/GitHub snapshot'ları) ──┘                  │
                                                                                               ▼
                                                           ┌──────────── Supabase Postgres ───────────┐
                                                           │ stories · story_clusters · trend_scores  │
                                                           └──────────────────────────────────────────┘
                                                                  │                │               │
                                                     Discover (public)    Radar (auth, SQL     Studio (auth)
                                                     ISR + FTS            radar_feed fn,       studio.generate job
                                                                          NicheFit on read)    → briefs (Realtime)
                                                                                 │
                                                                     digest.send / alerts.check → Resend
```

### Mimari prensipler (PDF §9'dan, koda yansıması)

- Her pipeline aşaması ayrı `step.run(...)` → Inngest retry'ı yalnızca başarısız adımı tekrarlar.
- **İdempotency:** `raw_items` üzerinde `unique(source_id, external_id)`; insert'ler `on conflict do nothing`. Story build, `built_source_count` değişmediyse LLM'i tekrar çağırmaz.
- **LLM korumaları:** her çağrıda timeout (30 sn), 2 retry, Zod şemasıyla structured output, `llm_usage` tablosuna token/maliyet kaydı, **günlük global bütçe** (ör. `$1/gün`) aşılınca `stories.build` duraklar.
- Inngest `concurrency` ile LLM fonksiyonları sınırlandırılır (ör. 3 eşzamanlı) — ücretsiz kotaların rate limit'ine takılmamak için.
- Kullanıcı bazlı rate limit: Studio generate için `usage_counters` + Inngest `rateLimit`/`throttle` (`key: event.data.userId`).

### LLM model seçimi (görev bazlı)

Vercel AI SDK (`ai` paketi) ile sağlayıcıdan bağımsız `lib/llm/provider.ts`. Model adları env'den gelir, kod içinde sabit yazılmaz.

| Görev          | Hacim                                   | Öneri                                                                            |
| -------------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| Embedding      | Filtreyi geçen her item (~yüzlerce/gün) | Gemini embedding (ücretsiz kota), **768 boyut** sabitle                          |
| Story builder  | 20–40 story/gün                         | Ucuz/hızlı model: Gemini Flash, Groq, veya Claude Haiku 5.5 (`claude-haiku-5-5`) |
| Studio         | Kullanıcı tetikli                       | Kalite önemli: Claude Sonnet 5.5 (`claude-sonnet-5-5`) veya eşdeğeri             |
| Personal angle | Kullanıcı başına günde ≤5               | Ucuz model, sonuç cache'lenir                                                    |

> Ücretsiz kota limitleri sık değişiyor; Faz 0'da güncel limitleri kontrol edip `.env`'e yaz.

---

## 3. Repo yapısı

```
signalcraft/
├─ app/
│  ├─ (marketing)/            page.tsx (landing), pricing/, faq/
│  ├─ (app)/                  layout.tsx (üst nav + app shell)
│  │  ├─ discover/            page.tsx, [storyId]/page.tsx
│  │  ├─ radar/               page.tsx, settings/page.tsx
│  │  ├─ studio/              page.tsx (brief listesi), new/page.tsx?story=, [briefId]/page.tsx
│  │  └─ settings/            account, billing
│  ├─ (auth)/                 login/, auth/callback/route.ts
│  ├─ onboarding/             niş kurulum sihirbazı
│  ├─ admin/                  kaynaklar, pipeline_runs, LLM harcaması (sadece admin)
│  └─ api/
│     ├─ discover/ … radar/ … studio/ …   (bkz. §7)
│     ├─ inngest/route.ts
│     └─ billing/webhook/route.ts
├─ components/
│  ├─ ui/                     shadcn bileşenleri
│  ├─ story/                  StoryCard, SignalBar, PlatformSignals, ScoreBadge, SourceList
│  ├─ radar/                  RadarRow, Sparkline, NicheForm
│  ├─ studio/                 HookList, DraftEditor, ControlPanel, SourceAttribution
│  └─ marketing/              Hero, BentoModules, PipelineSteps, ExampleOutput, PricingTable, Faq
├─ lib/
│  ├─ supabase/               server.ts, client.ts, admin.ts (service role), middleware.ts
│  ├─ pipeline/
│  │  ├─ fetchers/            rss.ts, hn.ts, github.ts, producthunt.ts, arxiv.ts, youtube.ts, reddit.ts
│  │  ├─ normalize.ts  canonical-url.ts  hash.ts  simhash.ts
│  │  ├─ filter.ts  classify.ts  embed.ts  cluster.ts
│  │  └─ score.ts             (saf fonksiyonlar, unit test'li)
│  ├─ llm/                    provider.ts, budget.ts, prompts/{story,studio-short,studio-long,angle}.ts, schemas.ts
│  ├─ billing/                provider.ts (Paddle | LemonSqueezy | Stripe adapter), plans.ts, limits.ts
│  └─ analytics/              posthog.ts
├─ inngest/
│  ├─ client.ts
│  └─ functions/              fetch-sources.ts, process-items.ts, refresh-metrics.ts, score-stories.ts,
│                             build-stories.ts, archive-stories.ts, studio-generate.ts,
│                             send-digest.ts, check-alerts.ts
├─ emails/                    DailyDigest.tsx, SignalAlert.tsx (React Email)
├─ supabase/
│  ├─ migrations/             0001_init.sql, 0002_rls.sql, 0003_functions.sql …
│  └─ seed.sql                30–40 kaynak + örnek story'ler
├─ tests/                     unit (vitest), e2e (playwright), fixtures/ (örnek RSS/HN JSON)
└─ messages/                  tr.json, en.json (next-intl)
```

---

## 4. Veritabanı şeması (revize)

PDF §8'deki tablolar korunur; **[YENİ]** ve **[DEĞİŞTİ]** işaretli olanlar §1'deki kararlardan gelir.

```sql
create extension if not exists vector;
create extension if not exists pg_trgm;

create type source_type    as enum ('rss','hn','reddit','github','producthunt','arxiv','youtube');
create type story_status   as enum ('pending','published','archived','suppressed');
create type story_category as enum ('ai_models','ai_tools','developer_tools','open_source','startups',
                                    'security','web_frontend','mobile','data_infra','other');
create type signal_action  as enum ('save','hide','boost','generate','published');
create type brief_status   as enum ('queued','generating','ready','failed');

-- [DEĞİŞTİ] users → auth.users + profiles
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  plan text not null default 'free',            -- free | creator | pro
  is_admin boolean not null default false,
  timezone text not null default 'Europe/Istanbul',
  digest_enabled boolean not null default true,
  digest_hour smallint not null default 8,      -- kullanıcının yerel saatinde
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

create table niches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  name text not null,
  keywords text[] not null default '{}',
  excluded_keywords text[] not null default '{}',
  platforms text[] not null default '{}',       -- x | linkedin | youtube | newsletter
  tone text not null default 'analytical',      -- technical | analytical | fun | contrarian | plain
  language text not null default 'tr',          -- tr | en
  tracked_channels text[] not null default '{}',-- [YENİ, PDF §3.2] takip edilen hesap/kanal
  voice_samples text[] not null default '{}',   -- [YENİ] marka sesi örnekleri (max 3)
  embedding vector(768),                        -- [YENİ] name + keywords embedding'i → NicheFit
  alert_threshold smallint not null default 85, -- [YENİ] Alert eşiği
  created_at timestamptz not null default now()
);

create table sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type source_type not null,
  url text not null,
  config jsonb not null default '{}',           -- [YENİ] subreddit, arXiv kategorisi, repo listesi vb.
  trust_weight numeric(3,2) not null default 0.7,
  fetch_interval_min int not null default 30,   -- [YENİ]
  active boolean not null default true,
  etag text, last_modified text,                -- [YENİ] koşullu GET → bant genişliği tasarrufu
  last_fetched_at timestamptz, last_error text, -- [YENİ]
  created_at timestamptz not null default now()
);

create table raw_items (
  id bigserial primary key,
  source_id uuid not null references sources,
  external_id text not null,
  url text not null,
  canonical_url text not null,
  title text not null,
  description text,
  content_text text,                            -- ≤ 4000 karakter, UI'da gösterilmez
  author text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  language text,
  content_hash text not null,
  simhash bigint,                               -- [YENİ] near-dedupe
  embedding vector(768),                        -- [YENİ] filtreyi geçince doldurulur
  filter_status text not null default 'pending',-- [YENİ] pending | accepted | rejected
  reject_reason text,                           -- [YENİ]
  raw_metadata jsonb not null default '{}',
  unique (source_id, external_id)
);
create index on raw_items (canonical_url);
create index on raw_items (content_hash);
create index on raw_items (published_at desc);

-- [YENİ] Velocity / Engagement için zaman serisi
create table item_metrics (
  raw_item_id bigint not null references raw_items on delete cascade,
  metric text not null,                         -- points | comments | upvotes | stars | votes
  value int not null,
  captured_at timestamptz not null default now(),
  primary key (raw_item_id, metric, captured_at)
);

create table stories (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text, summary text, why_it_matters text,
  category story_category,
  entities jsonb not null default '[]',
  sentiment text,
  creator_relevance smallint,                   -- LLM: 0-100
  suggested_angles jsonb not null default '[]', -- LLM
  velocity_score real default 0, engagement_score real default 0,
  source_diversity_score real default 0, freshness_score real default 0,
  trust_score real default 0,                   -- [YENİ]
  global_score real default 0,                  -- [DEĞİŞTİ] final_score yerine (NicheFit hariç)
  is_early_signal boolean default false,        -- [YENİ]
  source_count int not null default 0,
  first_seen_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  last_built_at timestamptz,                    -- [YENİ] LLM son çalışma
  built_source_count int default 0,             -- [YENİ] idempotency: değişmediyse rebuild yok
  status story_status not null default 'pending',
  search tsvector generated always as
    (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(summary,''))) stored
);
create index on stories using gin (search);
create index on stories (status, global_score desc);

create table story_sources (
  id bigserial primary key,
  story_id uuid not null references stories on delete cascade,
  raw_item_id bigint not null unique references raw_items,
  source_id uuid not null references sources
);

create table story_clusters (
  story_id uuid primary key references stories on delete cascade,
  embedding vector(768) not null,               -- centroid (üyelerin ortalaması)
  item_count int not null default 1,
  similarity_threshold real not null default 0.85,
  created_at timestamptz not null default now()
);
create index on story_clusters using hnsw (embedding vector_cosine_ops);

create table trend_scores (                     -- Radar sparkline'ı bu tablodan çizilir
  id bigserial primary key,
  story_id uuid not null references stories on delete cascade,
  metric text not null,                         -- global | velocity | engagement ...
  value real not null,
  calculated_at timestamptz not null default now()
);
create index on trend_scores (story_id, calculated_at);

create table user_signals (
  id bigserial primary key,
  user_id uuid not null references profiles on delete cascade,
  story_id uuid not null references stories on delete cascade,
  action signal_action not null,
  created_at timestamptz not null default now()
);

create table user_story_angles (                -- [YENİ] Personal angle cache'i
  user_id uuid not null references profiles on delete cascade,
  niche_id uuid not null references niches on delete cascade,
  story_id uuid not null references stories on delete cascade,
  angle text not null, created_at timestamptz not null default now(),
  primary key (user_id, niche_id, story_id)
);

create table briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  story_id uuid not null references stories,
  niche_id uuid references niches,
  platform text not null, format text not null, tone text not null,
  audience text, length text, user_take text,   -- [YENİ] Studio girdileri
  status brief_status not null default 'queued',
  output jsonb,                                 -- son LLM çıktısı (bkz. §6.2 şeması)
  edited jsonb,                                 -- [YENİ] kullanıcının düzenlediği hali
  selected_hook int,                            -- [YENİ]
  model text, tokens_in int, tokens_out int,    -- [YENİ]
  published_at timestamptz, published_url text, -- [YENİ] kritik metrik
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table brief_versions (                   -- [YENİ] "yeniden üret" geçmişi
  id bigserial primary key,
  brief_id uuid not null references briefs on delete cascade,
  output jsonb not null,
  created_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  provider text not null,                       -- [YENİ] paddle | lemonsqueezy | stripe
  provider_customer_id text, provider_subscription_id text unique,
  plan text not null, status text not null,
  current_period_end timestamptz
);

create table usage_counters (                   -- [YENİ] plan limitleri
  user_id uuid references profiles on delete cascade,
  day date not null,
  kind text not null,                           -- brief | alert | personal_angle
  count int not null default 0,
  primary key (user_id, day, kind)
);

create table llm_usage (                        -- [YENİ] maliyet bütçesi
  id bigserial primary key, job text not null, model text not null,
  tokens_in int, tokens_out int, cost_usd numeric(10,5),
  created_at timestamptz not null default now()
);

create table pipeline_runs (                    -- [YENİ] admin / kalibrasyon
  id bigserial primary key, fn text not null,
  started_at timestamptz default now(), finished_at timestamptz,
  stats jsonb, error text
);
```

**RLS (0002_rls.sql):**

- `stories`, `story_sources`, `trend_scores`: `status = 'published'` olanlar herkese okunur.
- `sources`: ad/tip herkese okunur; yazma yalnız service role.
- `raw_items`, `item_metrics`, `story_clusters`, `llm_usage`, `pipeline_runs`: client erişimi yok (yalnız service role).
- `profiles`, `niches`, `user_signals`, `user_story_angles`, `briefs`, `brief_versions`, `usage_counters`, `subscriptions`: `user_id = auth.uid()`. `subscriptions` ve `profiles.plan` kullanıcı tarafından **yazılamaz** (yalnızca webhook/service role).
- Yeni kullanıcıda `profiles` satırı `auth.users` insert trigger'ı ile oluşur.

**SQL fonksiyonları (0003_functions.sql):**

- `match_story_cluster(embedding, threshold, since)` → en yakın cluster (son 72 saat).
- `radar_feed(p_user uuid, p_niche uuid)` → son 72 saatin published story'leri; `niche_fit`, `final_score`, `bucket` döndürür (bkz. §5.6).
- `increment_usage(user, kind, limit)` → atomik sayaç; limit aşılırsa `false`.

---

## 5. Pipeline — aşama aşama

### 5.1 Fetch (`inngest/functions/fetch-sources.ts`)

- Cron `*/15 * * * *`: `sources` içinden `last_fetched_at + fetch_interval_min < now()` olanları seçer, her biri için `step.run`. Böylece tek cron, kaynak başına frekansı yönetir (Inngest çalıştırma kotasını korur).
- Varsayılan frekanslar (PDF §7.1): RSS 30 dk, HN 30 dk, GitHub 60 dk, Reddit 60 dk, Product Hunt 60 dk, arXiv 12 saat (günde bir yayınlanır), YouTube RSS 3 saat.
- Fetcher sözleşmesi: `fetch(source) → RawItemInput[]`. Hata kaynağı devre dışı bırakmaz; `last_error` yazar, 5 ardışık hatada `active=false` + admin uyarısı.
- RSS/Atom/YouTube/arXiv/Reddit-RSS: `rss-parser` veya `fast-xml-parser`, `If-None-Match`/`If-Modified-Since` başlıkları.
- HN: Algolia API (`search_by_date?tags=story` ve `tags=front_page`, `show_hn`); `points`, `num_comments` → `item_metrics`. HN item'ı dış bir URL'ye işaret ediyorsa `canonical_url` = o URL (aynı haberin bir RSS kaynağıyla eşleşmesini sağlar).
- GitHub: Search API (`created:>{7 gün önce} sort:stars`) + seçili repoların `releases.atom`. Token ile (5.000 istek/saat).
- Product Hunt: GraphQL API v2 (developer token), günün postları + `votesCount`.
- Sonuç: yeni item ID'leri ile `items/fetched` event'i.

### 5.2 Normalize

PDF §7.2'deki alanlar. Ek kurallar:

- `canonical_url`: küçük harf host, `www.` ve sondaki `/` kaldır, `utm_*`, `ref`, `fbclid` vb. sil, `<link rel=canonical>` varsa onu kullan (yalnız RSS içinde verilmişse; ekstra HTTP isteği yok).
- `content_text`: HTML temizlenir, 4.000 karaktere kesilir.
- `language`: `franc` (veya `cld3`) ile tespit.
- `content_hash = sha256(normalize(title) + first 500 chars of content_text)`.

### 5.3 Dedupe (3 aşama, PDF §7.3)

1. **Exact:** aynı `canonical_url` veya `content_hash` → mevcut item'ın story'sine kaynak olarak eklenir (yeni kart yok, ama `source_count` artar → SourceDiversity).
2. **Near:** başlık + açıklamanın 3-gram shingle'larından 64-bit SimHash; son 72 saatte Hamming mesafesi ≤ 3 → aynı story.
3. **Semantic:** filtreyi geçen item embed edilir; `match_story_cluster` ile cosine similarity ≥ 0.85 → o story'ye eklenir, centroid güncellenir: `c = (c·n + e)/(n+1)`. Eşleşme yoksa yeni `stories` (status `pending`) + `story_clusters` satırı.

### 5.4 Filter / Classify (LLM'siz, PDF §7.4)

Sırayla, ilk başarısız kural `reject_reason` yazar:

- Dil ∉ {en, tr}
- `published_at` 7 günden eski
- Başlık + içerik < 80 karakter
- Spam/yasaklı kelime listesi (`lib/pipeline/filter.ts` içinde config)
- Niş dışı: kategori anahtar kelime sözlüğüyle eşleşme yoksa ve kaynak genel amaçlıysa (ör. TechCrunch'ın AI dışı yazıları) red. Kaynak zaten nişe özelse (Hugging Face blog) kural atlanır.
- Kaynak trust < 0.3
- Ön kategori: anahtar kelime sözlüğü ile tahmini kategori (`raw_metadata.pre_category`) — LLM sonradan kesinleştirir.

### 5.5 Skorlama (`lib/pipeline/score.ts` — saf fonksiyonlar, %100 unit test)

Tüm alt skorlar 0–100. `stories.score` cron'u 30 dakikada bir son 72 saatin story'lerini yeniden hesaplar ve `trend_scores`'a snapshot yazar.

| Metrik                          | Hesap                                                                                                                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Velocity**                    | Story'nin tüm item'ları için son 6 saatteki metrik artışı (`item_metrics` farkı, platforma göre normalize) + son 6 saatte gelen yeni kaynak sayısı × ağırlık. Ham değer, son 72 saatteki story'ler arasında **persentil**e çevrilir (dağılımdan bağımsız, kalibrasyonu kolay). |
| **Engagement**                  | Platform başına log ölçek: `min(1, log10(1+x) / log10(1+cap))`; cap: HN puanı 500, HN yorum 300, Reddit upvote 2000, GitHub yıldız artışı 1000, PH oy 500. Story için en yüksek iki değerin ortalaması × 100.                                                                  |
| **SourceDiversity**             | `0.7 × min(1, (farklı_kaynak − 1) / 5) + 0.3 × min(1, farklı_kaynak_tipi / 4)` × 100                                                                                                                                                                                           |
| **Freshness**                   | `100 × 2^(−yaş_saat / 18)` (18 saatte yarıya iner)                                                                                                                                                                                                                             |
| **Trust**                       | Kaynakların `trust_weight` ortalaması (0–1)                                                                                                                                                                                                                                    |
| **NicheFit** (kullanıcıya özel) | `cosine(story_centroid, niche.embedding)` → `[0.5, 0.85]` aralığı 0–100'e lineer map + keyword eşleşmesi başına +10 (max +30) + tracked_channels'tan gelen kaynak için +15. `excluded_keywords` eşleşmesi → story hiç gösterilmez.                                             |

```
global_score = (0.35·V + 0.25·E + 0.10·D + 0.10·F) / 0.80 × (0.7 + 0.3·Trust)      -- Discover
final_score  = (0.35·V + 0.25·E + 0.20·N + 0.10·D + 0.10·F)  × (0.7 + 0.3·Trust)   -- Radar
```

Ağırlıklar `lib/pipeline/score.ts` içinde tek bir config objesinde; Faz 9'daki kalibrasyon bunlarla oynar.

### 5.6 Radar bucket'ları ve signal bar

| Bucket / renk             | Kural                                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **High signal** (yeşil)   | `final_score ≥ 75`                                                                                                                                                                 |
| **Early signal** (sarı)   | Velocity persentili ≥ 70, `source_count ≤ 3`, Engagement ≤ 50, yaş < 12 saat                                                                                                       |
| **Content gap**           | Engagement ≥ 60 (topluluk ilgisi yüksek) ama editoryal kaynak (RSS haber/blog) sayısı ≤ 1 → "konuşuluyor ama iyi anlatılmamış". LLM'in `suggested_angles`'ı açı olarak gösterilir. |
| **Düşük güven** (kırmızı) | Trust < 0.4                                                                                                                                                                        |
| **Normal** (gri)          | Diğerleri                                                                                                                                                                          |

### 5.7 Story Builder (`build-stories.ts`, PDF §7.5)

- Cron `stories.score`'dan sonra tetiklenir. Seçim: `status='pending'` veya `source_count − built_source_count ≥ 3` olan story'lerden `global_score`'a göre **top 30** (env: `STORY_BUILD_TOP_N`). Bütçe aşıldıysa çalışmaz.
- Girdi: cluster'daki en fazla 6 item'ın başlık + açıklama + ilk 800 karakteri, kaynak adları, platform sinyalleri.
- Çıktı: Zod şeması (PDF §7.5) — `title, summary (2-3 cümle), why_it_matters, category (enum), entities[], sentiment, content_creator_relevance (0-100), suggested_angles[3]`.
- Prompt kuralları: yalnızca verilen kaynaklardaki bilgiyi kullan, spekülasyon yok, kaynaklar çelişiyorsa belirt.
- Başarılıysa `status='published'`, `slug` üretilir.
- `stories.archive` (günlük): 7 günden eski → `archived`.

### 5.8 Metrik yenileme (`refresh-metrics.ts`)

Cron 30 dk: son 48 saatin HN/Reddit/GitHub/PH item'ları için güncel puanları çekip `item_metrics`'e snapshot ekler (Velocity'nin kaynağı). HN Algolia'da tek istekle çoklu ID sorgulanır.

---

## 6. LLM katmanı

### 6.1 `lib/llm/`

- `provider.ts`: `getModel(task: 'story' | 'studio' | 'angle' | 'embed')` → env'deki sağlayıcı/modeli döner.
- `budget.ts`: `assertBudget(job)` → bugünkü `llm_usage` toplamı `LLM_DAILY_BUDGET_USD`'yi aştıysa hata; her çağrıdan sonra `recordUsage`.
- Tüm çağrılar `generateObject({ schema })` ile structured output; parse hatası → 1 retry, sonra `failed`.

### 6.2 Studio çıktı şeması (`briefs.output`)

```ts
{
  hooks: string[10],
  titles: string[3],
  x_thread: string[],                 // her eleman bir tweet, ≤ 280 karakter
  linkedin_post: string,
  shorts_hooks: string[],             // 3-5 adet
  shorts_script: { hook: string, beats: string[], cta: string, duration_sec: number },
  newsletter_section: string,
  blog_draft: string,                 // markdown
  sources: { title: string, url: string, source: string }[],   // story_sources'tan, LLM üretmez
  ai_disclosure: string               // dile göre sabit şablon
}
```

- `sources` ve `ai_disclosure` **LLM'den alınmaz**, sunucu tarafında eklenir (uydurma link riski sıfır).
- Prompt'a girenler: story özeti + why_it_matters + kaynak alıntıları, platform/format/ton/hedef kitle/uzunluk, kullanıcının görüşü (`user_take`), `voice_samples`, niş dili.
- Çıktı dili = niş dili (TR/EN).

### 6.3 Studio akışı

1. `POST /api/studio/generate` → auth kontrolü → `increment_usage(user,'brief',limit)` → `briefs` insert (`queued`) → `inngest.send('studio/brief.requested')` → `202 { briefId }`.
2. `studio-generate.ts`: `status='generating'` → paralel `step.run('short-pack')`, `step.run('long-pack')` → birleştir → `brief_versions` insert → `status='ready'`. Hata → `failed` + kullanım sayacı geri alınır.
3. UI `/studio/[briefId]` Supabase Realtime ile satırı dinler; skeleton → içerik.
4. Düzenlemeler `edited` alanına debounce'lu `PUT` ile kaydedilir (otomatik kayıt + "Kaydet" butonu).
5. "Yeniden üret": aynı brief'te yeni versiyon, tek bölüm (ör. sadece hook'lar) yeniden üretilebilir.

---

## 7. API ve job'lar

PDF §10'daki route'lar korunur. Hepsi Zod ile input doğrulaması yapar.

| Route                                                        | Auth          | Not                                                                                 |
| ------------------------------------------------------------ | ------------- | ----------------------------------------------------------------------------------- |
| `GET /api/discover?category&range=today\|24h\|week&q&cursor` | Public        | Cursor pagination, `global_score` + `first_seen_at` sıralı; `q` → FTS               |
| `GET /api/discover/[storyId]`                                | Public        | Story + kaynaklar + platform sinyalleri                                             |
| `GET /api/categories`                                        | Public        | Kategori + son 24 saatteki story sayısı                                             |
| `GET /api/trending`                                          | Public        | `?panel=trending\|new_tools\|github` (sağ/sol paneller)                             |
| `GET /api/radar?niche`                                       | Auth          | `radar_feed()` → `{ high, early, gaps }`; Free'de ilk 3 sinyal açık, gerisi kilitli |
| `POST /api/radar/niches`, `PUT /api/radar/niches/[id]`       | Auth          | Kayıtta niş embedding'i yeniden hesaplanır; Free'de 1 niş limiti                    |
| `POST /api/radar/[storyId]/save` · `/hide`                   | Auth          | `user_signals`                                                                      |
| `POST /api/radar/[storyId]/angle`                            | Auth          | [YENİ] Personal angle (cache'li, günlük limitli)                                    |
| `POST /api/studio/generate`                                  | Auth          | 202 + briefId (§6.3)                                                                |
| `GET /api/studio/briefs`, `GET/PUT /api/studio/briefs/[id]`  | Auth          |                                                                                     |
| `POST /api/studio/briefs/[id]/publish`                       | Auth          | [YENİ] `published_at`, `published_url`                                              |
| `POST /api/billing/checkout`, `/portal`, `/webhook`          | Auth / imzalı | Sağlayıcı adapter'ı üzerinden                                                       |
| `POST /api/inngest`                                          | İmzalı        | Tüm job'lar                                                                         |

**Inngest fonksiyonları** (PDF'teki `/jobs/*` karşılıkları):

| Fonksiyon         | Tetikleyici                                 | PDF karşılığı                                  |
| ----------------- | ------------------------------------------- | ---------------------------------------------- |
| `fetch-sources`   | cron `*/15`                                 | `/jobs/fetch-sources`                          |
| `process-items`   | `items/fetched` (batch)                     | `/jobs/normalize-items` + `/jobs/dedupe-items` |
| `refresh-metrics` | cron `*/30`                                 | —                                              |
| `score-stories`   | cron `*/30`                                 | `/jobs/calculate-scores`                       |
| `build-stories`   | `stories/scored`                            | `/jobs/build-stories`                          |
| `check-alerts`    | `stories/built`                             | Alert                                          |
| `send-digest`     | cron saatlik (kullanıcının `digest_hour`'u) | `/jobs/send-daily-digest`                      |
| `studio-generate` | `studio/brief.requested`                    | —                                              |
| `archive-stories` | cron günlük                                 | —                                              |

---

## 8. Frontend ve tasarım sistemi ("Signal Terminal")

### 8.1 Token'lar (PDF §11 birebir)

`app/globals.css` içinde CSS değişkenleri + Tailwind theme eşlemesi; shadcn'in `--background`, `--card`, `--primary` vb. değişkenleri bu token'lara bağlanır:

```css
--color-canvas: #0a0b0d;
--color-surface-1: #111318;
--color-surface-2: #171a21;
--color-border: rgba(255, 255, 255, 0.08);
--color-text-primary: #f5f7fa;
--color-text-secondary: #9aa3b2;
--color-accent: #00e5a0;
--color-warning: #ffb224;
--color-danger: #ff5c5c;
```

- Dark-first; light mode MVP'de yok.
- Fontlar: `geist` paketi → Geist Sans (UI) + Geist Mono (yalnızca skor, zaman, kaynak sayısı, teknik etiket).
- Tipografi skalası: hero 56–72px / 600–650 / `-0.03em`; section 32–40px; story başlığı 18–20px; body 15–16px / 1.55; meta 12–13px mono.
- Accent yalnızca: primary CTA, aktif sinyal, yeni story, yüksek skor, başarılı işlem. Mor gradyan yok, glow yalnızca hover'da ve hafif.
- Hareket: 120–180ms, `ease-out`; `prefers-reduced-motion` desteği.
- İkonlar: Lucide. Sparkline: hafif inline SVG (Recharts'a gerek yok).

### 8.2 Ekranlar

**Landing (`/`)** — PDF §11'deki 8 bölüm sırasıyla: Hero (iki CTA) → **gerçek Discover ekranı** (canlı veriyle render edilen `<DiscoverPreview>` bileşeni; ekran görüntüsü değil) → Bento grid (Discover/Radar/Studio) → Problem → 5 adımlı pipeline görseli → Örnek çıktı (seed'deki gerçek bir story'den X thread / LinkedIn / Shorts hook sekmeleri) → Fiyatlandırma (Free / Creator; Pro "yakında") → SSS (kaynak doğruluğu, telif, AI kullanımı, veri güncelliği).

**Discover (`/discover`)** — PDF §12 layout'u:

- Sol: kategori listesi (sayılarla) + Trending / New tools / GitHub panelleri. Mobilde yatay kaydırmalı chip'ler + paneller alt sekmede.
- Üst: zaman filtresi (Today / 24h / This week) + arama (`⌘K`).
- `StoryCard`: sol kenarda 3px signal bar, kategori etiketi, başlık, özet, mono meta satırı (`2h ago · 14 sources · velocity 92`), platform sinyal chip'leri (`HN 412` `Reddit 238` `GitHub +1.2k`), "Neden önemli?" (açılır), aksiyonlar. Girişsiz kullanıcı aksiyona basarsa login modal.
- Sonsuz kaydırma (cursor), URL'de filtre state'i (paylaşılabilir).
- Story detail (`/discover/[storyId]`): özet, why it matters, entities, suggested angles, tüm kaynaklar (tip ikonu + zaman), skor dökümü (5 alt skor bar'ı), skor sparkline'ı; `generateMetadata` ile OG/SEO.

**Onboarding (`/onboarding`)** — 4 adım: niş adı + anahtar kelimeler (öneri chip'leri) → platformlar → dil + ton → negatif kelimeler / takip edilen kanallar (opsiyonel). Bitince ilk Radar.

**Radar (`/radar`)** — PDF §13: üç bölüm (High signal / Early signal / Content gaps). `RadarRow`: başlık, mono skor, sparkline, kaynak sayısı, "Neden önemli?", "Senin açın" (tıklayınca personal angle üretilir/cache'den gelir), "Brief oluştur". Niş seçici (birden fazla nişi olanlar için), save/hide. Free'de 3 satırdan sonrası blur + upgrade CTA.

**Studio (`/studio/[briefId]`)** — PDF §14: solda içerik (story başlığı, hook seçenekleri radio listesi, seçilen formatın editable textarea'sı, diğer formatlar sekmelerde, kaynaklar + AI beyanı), sağda kontrol paneli (platform, format, ton, hedef kitle, uzunluk, kendi görüşün, Yeniden üret, Kaydet, Kopyala, **Yayınladım**). X thread editöründe tweet başına karakter sayacı.

**Studio listesi (`/studio`)** — kayıtlı brief'ler (fikir havuzu), durum ve yayın filtresi.

**Admin (`/admin`)** — kaynak listesi (aktif/pasif, son hata, trust düzenleme), son `pipeline_runs`, günlük LLM harcaması, manuel job tetikleme, reddedilen item'ların nedenleri (filtre kalibrasyonu için).

---

## 9. Fazlar, görevler ve kabul kriterleri

PDF §17'deki 6 haftalık sıra korunur, ama "çalışan dikey dilim" mantığıyla biraz daha ince bölünür. **Her faz ayrı bir AI oturumu / PR olsun.**

### Faz 0 — Proje iskeleti (Hafta 1, 1–2 gün)

- [ ] `create-next-app` (TS, App Router, ESLint), Tailwind, shadcn/ui init, Geist fontları, §8.1 token'ları.
- [ ] Supabase CLI ile lokal proje (`supabase init/start`), `@supabase/ssr` client'ları + middleware.
- [ ] Inngest client + `/api/inngest` + lokal dev server; Vitest + Playwright kurulumu; Prettier.
- [ ] `.env.example` (§11), `README` içinde lokal çalıştırma adımları.
- [ ] App shell: üst nav (Discover / Radar / Studio + arama + CTA), boş sayfalar.

**Bitti:** `npm run dev` + `supabase start` + `npx inngest-cli dev` ile boş ama stilli shell açılıyor; lint/typecheck/test yeşil.

### Faz 1 — Veritabanı (Hafta 1, 1–2 gün)

- [ ] `0001_init.sql` (§4), `0002_rls.sql`, `0003_functions.sql`, profile trigger.
- [ ] `supabase gen types typescript` → `lib/supabase/types.ts`.
- [ ] `seed.sql`: PDF §6'daki 30–40 kaynak (trust_weight'lerle) + 1 admin kullanıcı.

**Bitti:** `supabase db reset` hatasız; RLS testleri: anon kullanıcı `raw_items` okuyamıyor, kullanıcı A, B'nin brief'ini göremiyor.

### Faz 2 — Ingestion (Hafta 1–2)

- [ ] Fetcher'lar: RSS (+ YouTube/arXiv/Reddit RSS varyantları), HN, GitHub, Product Hunt. Her biri `tests/fixtures/` üzerinden unit test'li.
- [ ] `normalize`, `canonical-url`, `hash`, `simhash`, `filter` (saf fonksiyonlar + testler).
- [ ] `fetch-sources`, `process-items` (embed hariç), `refresh-metrics` fonksiyonları; `pipeline_runs` kaydı.

**Bitti:** Lokal bir saatlik çalıştırmada yüzlerce `raw_items`, aynı URL iki kez yok, reddedilenlerin `reject_reason`'ı dolu, HN item'larının `item_metrics` snapshot'ları birikiyor.

### Faz 3 — Clustering, skorlama, story builder (Hafta 2)

- [ ] `embed.ts` (768 boyut, batch), `cluster.ts` (`match_story_cluster` + centroid güncelleme).
- [ ] `score.ts` (§5.5) + kapsamlı unit test; `score-stories` + `trend_scores` snapshot.
- [ ] `lib/llm/` (provider, budget, story prompt + şema), `build-stories` (top-N, idempotent), `archive-stories`.

**Bitti:** Aynı olayı anlatan 3 farklı kaynak tek story'de; günde LLM çağrısı ≤ 40 (`llm_usage` ile doğrula); published story'lerin hepsinde başlık/özet/kategori dolu.

### Faz 4 — Discover + landing (Hafta 2–3)

- [ ] Public API'ler (§7), `StoryCard`, `SignalBar`, `PlatformSignals`, kategori/zaman filtresi, FTS arama, sonsuz kaydırma.
- [ ] Sağ/sol paneller (Trending, New AI tools = `ai_tools` kategorisi + PH, GitHub rising).
- [ ] Story detail + SEO metadata; ISR (`revalidate: 300`).
- [ ] Landing page 8 bölüm, canlı `DiscoverPreview`.

**Bitti:** Girişsiz kullanıcı Discover'da filtreleyip arayabiliyor; Lighthouse performans ≥ 90, mobil 375px'de yatay scroll yok.

### Faz 5 — Auth, onboarding, Radar (Hafta 3)

- [ ] Supabase Auth: magic link + Google + GitHub OAuth; korumalı route'lar.
- [ ] Onboarding sihirbazı, niş CRUD (+ embedding), `/radar/settings`.
- [ ] `radar_feed()` + Radar UI (3 bölüm, sparkline, save/hide, personal angle).
- [ ] Discover kartlarında "Radar'a ekle" çalışır.

**Bitti:** "AI agents" nişli kullanıcı ile "web frontend" nişli kullanıcı Radar'da farklı sıralama görüyor; hide edilen story bir daha çıkmıyor; negatif kelime içeren story hiç görünmüyor.

### Faz 6 — Studio (Hafta 4)

- [ ] `/api/studio/generate` + `studio-generate` job (short/long pack), Realtime durum takibi.
- [ ] Studio editörü (hook seçimi, sekmeli formatlar, autosave, versiyonlar, yeniden üret, kopyala, Yayınladım).
- [ ] Studio listesi (fikir havuzu).

**Bitti:** Brief ~30 sn içinde `ready`; sayfa yenilense de düzenlemeler duruyor; kaynak linkleri story_sources ile birebir; Free kullanıcı 3. brief'te limit mesajı görüyor.

### Faz 7 — Digest ve alert (Hafta 3–4 arası, Faz 5'ten sonra herhangi bir zaman)

- [ ] React Email şablonları (Signal Terminal stilinde, koyu).
- [ ] `send-digest`: kullanıcının yerel saatinde top 5 story + "Brief oluştur" derin linkleri + dünkü brief için "yayınladın mı?" linki.
- [ ] `check-alerts`: `final_score ≥ niche.alert_threshold` → e-posta (kullanıcı başına günde ≤ 3).
- [ ] Ayarlarda digest saati / kapatma; e-postada tek tık abonelikten çıkma.

**Bitti:** Test kullanıcısı ayarladığı saatte digest alıyor; aynı story için ikinci alert gelmiyor.

### Faz 8 — Monetizasyon (Hafta 5)

- [ ] ⚠️ Sağlayıcı kararı (§1 #1). `lib/billing/provider.ts` adapter'ı + checkout, portal, webhook (imza doğrulama, idempotent).
- [ ] `lib/billing/limits.ts`: Free/Creator limitleri tek yerde; API'ler ve UI aynı kaynaktan okur.
- [ ] Pricing sayfası, billing ayarları, upgrade CTA'ları.

**Bitti:** Sandbox ödemesiyle plan `creator` oluyor, limitler kalkıyor; iptal sonrası dönem sonunda `free`'ye düşüyor.

### Faz 9 — Gözlemlenebilirlik, admin, beta (Hafta 6)

- [ ] Sentry (client + server + Inngest), PostHog event'leri: `niche_created`, `story_saved`, `brief_generated`, `brief_edited`, `brief_published`, `digest_opened`.
- [ ] Admin paneli (§8.2).
- [ ] Pipeline kalibrasyonu: skor ağırlıkları, dedupe eşikleri (0.85 / Hamming 3), filtre listeleri.
- [ ] 10–20 beta kullanıcı, feedback widget'ı.

**Bitti:** §10'daki metrikler PostHog'da dashboard olarak görülebiliyor.

---

## 10. Başarı metrikleri → event eşlemesi (PDF §18)

| Metrik                                          | Ölçüm                                         |
| ----------------------------------------------- | --------------------------------------------- |
| Niş kurulumu tamamlandı                         | `niche_created` / signup                      |
| 7 gün içinde ilk brief                          | `brief_generated` ilk zamanı − signup         |
| **Brief'ten yayınlanan içerik (kuzey yıldızı)** | `brief_published` / `brief_generated`         |
| Brief düzenleme oranı                           | `edited` alanı dolu brief'ler / tüm brief'ler |
| Günlük Discover açma, Radar'a ekleme            | `$pageview` (discover), `story_saved`         |
| D7 / D30 retention, WAU                         | PostHog retention                             |
| Digest açılma                                   | Resend webhook → `digest_opened`              |

---

## 11. Ortam değişkenleri (`.env.example`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
LLM_STORY_MODEL=            # ör. google:gemini-flash, anthropic:claude-haiku-5-5
LLM_STUDIO_MODEL=           # ör. anthropic:claude-sonnet-5-5
LLM_EMBED_MODEL=            # 768 boyutlu model
GOOGLE_GENERATIVE_AI_API_KEY=
ANTHROPIC_API_KEY=
LLM_DAILY_BUDGET_USD=1
STORY_BUILD_TOP_N=30
GITHUB_TOKEN=
PRODUCTHUNT_TOKEN=
RESEND_API_KEY=
EMAIL_FROM=
BILLING_PROVIDER=           # paddle | lemonsqueezy | stripe
BILLING_API_KEY=
BILLING_WEBHOOK_SECRET=
NEXT_PUBLIC_POSTHOG_KEY=
SENTRY_DSN=
NEXT_PUBLIC_APP_URL=
```

---

## 12. Test stratejisi

- **Unit (Vitest):** `canonical-url`, `simhash`, `filter`, `score` (sınır değerleri, bucket kuralları), fetcher parser'ları (fixture'larla), plan limitleri.
- **Entegrasyon:** lokal Supabase'e karşı `process-items` → aynı fixture iki kez işlenince satır sayısı değişmiyor (idempotency); RLS testleri.
- **LLM:** testlerde mock provider; prompt'lar için 5–10 örnek story'lik küçük bir "golden set" ile manuel kalite kontrolü.
- **E2E (Playwright):** girişsiz Discover filtreleme; signup → onboarding → Radar → brief üret → düzenle → yayınladım.

---

## 13. Riskler ve önlemler

| Risk                                                           | Önlem                                                                                                          |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Ücretsiz kotaların aşılması (Inngest çalıştırma, LLM)          | Tek cron + kaynak bazlı interval, top-N LLM, günlük bütçe kesicisi, admin'de harcama grafiği                   |
| Supabase Free projesi inaktiviteden duraklatılabilir           | Cron job'lar zaten DB'ye düzenli yazıyor; yine de beta'da Pro'ya geçişi planla                                 |
| Dedupe kalitesi (aynı haber 2 kart / farklı haberler tek kart) | Eşikler config'de, admin'de cluster üyelerini görme, Faz 9 kalibrasyonu                                        |
| LLM halüsinasyonu / yanlış bilgi                               | Yalnızca kaynak metinlerden üretim, linkler sunucu tarafında eklenir, "kaynakları doğrula" uyarısı + AI beyanı |
| Telif                                                          | Tam metin gösterilmez, özet + link; robots/ToS'a uyulur, kaynak bazlı kapatma anahtarı                         |
| Kaynak API şartları (Reddit, Product Hunt)                     | Ticari kullanım şartlarını beta öncesi kontrol et; RSS'e düşebilecek şekilde fetcher'ı izole tut               |
| Ödeme (Türkiye)                                                | §1 #1 — MoR sağlayıcı                                                                                          |

---

## 14. Kod yazan AI'a fazları verirken kullanılacak şablon

Her fazda aşağıdaki şablonu kullan; bu dosyanın tamamını da bağlam olarak ekle:

```
SignalCraft projesinde çalışıyoruz. Tüm ürün ve teknik kararlar IMPLEMENTATION_PLAN.md içinde.
Şu an yalnızca **Faz N — <ad>** üzerinde çalış (§9).

Kurallar:
- §1'deki kararlar bağlayıcıdır; PDF ile çelişirse bu plan geçerlidir.
- Şema değişikliği gerekiyorsa yeni migration dosyası ekle, eskileri değiştirme.
- Saf fonksiyonlar (score, dedupe, filter, normalize) unit test'siz bitmiş sayılmaz.
- LLM çağrısı yalnızca Inngest fonksiyonlarında; HTTP route'larında asla.
- Tasarım §8.1 token'larıyla; mor gradyan yok, accent yalnızca belirtilen yerlerde, mono yalnızca metadata.
- Faz bittiğinde §9'daki "Bitti" kriterlerini tek tek nasıl doğruladığını raporla.
```
