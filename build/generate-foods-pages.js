#!/usr/bin/env node
/* ============================================================================
 * generate-foods-pages.js — 静态落地页 / sitemap / robots 生成器
 * ----------------------------------------------------------------------------
 * 目的：为 88 种食物各生成一个「纯静态、不依赖 JS」的落地页，供搜索引擎爬虫
 *       直接读取完整判定内容，提升真实 URL 可索引性（替代原 hash 路由方案）。
 *
 * 数据同源（硬约束）：
 *   本脚本 **只从 ../data.js 读取数据**（SOURCES / CATEGORY_META / LEVEL_META /
 *   FOODS），绝不手抄复制任何判定文本。数据更新后**重跑本脚本即可**，
 *   落地页、sitemap 与首页落地页索引区一并刷新，杜绝数据漂移。
 *
 * 用法：
 *   node build/generate-foods-pages.js                      # 用占位域名
 *   node build/generate-foods-pages.js https://your-domain  # 用真实域名
 *   或：SITE_URL=https://your-domain node build/generate-foods-pages.js
 *
 * 产物：
 *   ../foods/<id>.html      ×  88   每个食物一个静态落地页
 *   ../sitemap.xml                 主页 + 88 落地页
 *   ../robots.txt                  允许全部爬虫 + 指向 sitemap
 *
 * 手工运行一次生成；CI/部署时也可作为构建前置步骤。
 * ==========================================================================*/

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = ROOT;                 // 产物落回站点根目录
const FOODS_DIR = path.join(ROOT, 'foods');

/* ----------------------------------------------------------------------------
 * 0. 站点基础信息 + 域名参数
 * --------------------------------------------------------------------------
 * 域名优先级：命令行参数 > 环境变量 SITE_URL > 占位域名。
 * 手册会指导用户上线后用真实域名重跑一次即可批量替换。
 * --------------------------------------------------------------------------*/
const PLACEHOLDER_HOST = 'https://www.example.com';

function normalizeBaseUrl(raw) {
  let u = String(raw || '').trim();
  if (!u) return PLACEHOLDER_HOST;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u.replace(/\/+$/, '');
}

const cliArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const SITE_URL = normalizeBaseUrl(cliArg || process.env.SITE_URL || PLACEHOLDER_HOST);
const IS_PLACEHOLDER = SITE_URL === PLACEHOLDER_HOST;

const SITE_NAME = 'CanDogsEat';
const SITE_TAGLINE = 'Dog Food Safety Checker';

/* ----------------------------------------------------------------------------
 * 1. 从 data.js 载入数据（唯一事实源）
 * --------------------------------------------------------------------------
 * data.js 是浏览器脚本，用顶层 const 定义变量；Node 里用 vm 在沙箱中求值，
 * 再取出需要的全局，避免污染本脚本作用域。
 * --------------------------------------------------------------------------*/
const vm = require('vm');

// data.js / i18n.js 用顶层 const 声明，const 不会挂到 vm sandbox 对象上。
// 做法：在源码末尾追加一行把需要的变量显式赋给 globalThis，再读取。
function loadVars(file, varNames) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const expose = '\n;' + varNames.map((n) => `globalThis.${n} = ${n};`).join('\n');
  const sandbox = { module: { exports: {} }, console, window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src + expose, sandbox, { filename: file });
  const out = {};
  varNames.forEach((n) => { out[n] = sandbox[n]; });
  return out;
}

const DATA = loadVars('data.js', ['SOURCES', 'CATEGORY_META', 'LEVEL_META', 'TRAITS_ENUM', 'FOODS']);
const SOURCES = DATA.SOURCES;
const CATEGORY_META = DATA.CATEGORY_META;
const LEVEL_META = DATA.LEVEL_META;
const FOODS = DATA.FOODS;

/* i18n.js 里的等级名 / 分类名（EN+ZH 双语文案唯一来源） */
const I18NV = loadVars('i18n.js', ['LEVEL_LABELS', 'CATEGORY_LABELS']);
const LEVEL_LABELS = I18NV.LEVEL_LABELS;
const CATEGORY_LABELS = I18NV.CATEGORY_LABELS;

if (!Array.isArray(FOODS) || FOODS.length === 0) {
  console.error('✗ 未能从 data.js 读取 FOODS，终止。');
  process.exit(1);
}

const CAT_BY_KEY = CATEGORY_META.reduce((m, c) => { m[c.key] = c; return m; }, {});

/* ----------------------------------------------------------------------------
 * 2. 工具函数
 * --------------------------------------------------------------------------*/
// HTML 文本转义（防止数据里的 & < > " 破坏结构；所有插值一律走此函数）
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 属性值转义（用于 href/content 等）
function escAttr(s) { return esc(s); }

// 相对根路径的绝对 URL
function absUrl(p) {
  const clean = String(p || '/').replace(/^\/+/, '');
  return SITE_URL + '/' + clean;
}

// 症状/建议转列表项（与 app.js toList 同规则：按分号切分，无分号则整段）
function toItems(text) {
  if (!text) return [];
  const parts = String(text).split(/[;；]\s*/).map((x) => x.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [String(text).trim()];
}

// 语言回退（与 app.js f* 同规则：ZH 优先，缺失回退 EN）
function zhOr(field, zhField) { return field && field[zhField] ? field[zhField] : field; }

const SITEMAP_LASTMOD = (() => {
  // 取全库最大 checked 日期作为 lastmod（数据整体核对日）
  const dates = FOODS.map((f) => f.checked).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : new Date().toISOString().slice(0, 10);
})();

/* ----------------------------------------------------------------------------
 * 3. 落地页 HTML 模板
 * --------------------------------------------------------------------------
 * 原则：
 *   - 全部判定内容为**纯静态 HTML 文本**，不依赖 JS 执行即可被爬虫读取。
 *   - EN 为主，ZH 附后（双侧 <h2> 分隔）。
 *   - 顶部醒目免责声明。
 *   - canonical 指向自身；JSON-LD（WebPage/Article）。
 *   - 内链：主页 + 其余食物（相关食物 + 全量索引）。
 * --------------------------------------------------------------------------*/
function levelName(lang, level) {
  return (LEVEL_LABELS[lang] && LEVEL_LABELS[lang][level])
    ? LEVEL_LABELS[lang][level].badge
    : LEVEL_META[level].badge;
}

function renderSourceList(sourceIds, lang) {
  const items = (sourceIds || []).map((sid) => {
    const s = SOURCES[sid];
    if (!s) return '';
    return `        <li><a href="${escAttr(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.org)}</a> — ${esc(s.title)}</li>`;
  }).filter(Boolean).join('\n');
  return items;
}

// 相关食物：同分类，排除自己，按 level 严重度排序，取最多 6 个
function relatedFoods(food) {
  const order = { severe: 0, toxic: 1, caution: 2, moderation: 3, safe: 4 };
  return FOODS
    .filter((f) => f.category === food.category && f.id !== food.id)
    .sort((a, b) => (order[a.level] - order[b.level]) || a.name.localeCompare(b.name))
    .slice(0, 6);
}

function renderFoodPage(food) {
  const cat = CAT_BY_KEY[food.category] || { label: food.category, key: food.category };
  const catEn = (CATEGORY_LABELS.en && CATEGORY_LABELS.en[food.category]) || cat.label;
  const catZh = (CATEGORY_LABELS.zh && CATEGORY_LABELS.zh[food.category]) || cat.label;
  const lvlEn = levelName('en', food.level);
  const lvlZh = levelName('zh', food.level);

  const title = `Can Dogs Eat ${food.name}? ${lvlEn} — Safety Verdict, Symptoms & Advice`;
  const metaDesc = `Can dogs eat ${food.name.toLowerCase()}? Verdict: ${lvlEn}. ${
    String(food.reason || '').slice(0, 120).replace(/\s+/g, ' ').trim()
  }… Sourced from ASPCA & AKC.`;

  // 分数值文本
  const reasonEn = food.reason;
  const symptomsEn = food.symptoms;
  const adviceEn = food.advice;
  const doseEn = food.dosageNote;
  const emergEn = food.emergency;

  const reasonZh = zhOr(food, 'reasonZh');
  const symptomsZh = zhOr(food, 'symptomsZh');
  const adviceZh = zhOr(food, 'adviceZh');
  const doseZh = zhOr(food, 'dosageNoteZh');
  const emergZh = food.emergencyZh;

  const symptomsListEn = toItems(symptomsEn).map((x) => `            <li>${esc(x)}</li>`).join('\n');
  const adviceListEn = toItems(adviceEn).map((x) => `            <li>${esc(x)}</li>`).join('\n');
  const symptomsListZh = toItems(symptomsZh).map((x) => `            <li>${esc(x)}</li>`).join('\n');
  const adviceListZh = toItems(adviceZh).map((x) => `            <li>${esc(x)}</li>`).join('\n');

  const sourcesEnHtml = renderSourceList(food.sources, 'en');

  // 相关食物内链
  const related = relatedFoods(food);
  const relatedHtml = related.map((r) =>
    `        <li><a href="/foods/${escAttr(r.id)}">Can dogs eat ${esc(r.name)}? (${esc(levelName('en', r.level))})</a></li>`
  ).join('\n');

  // 全量索引内链（SEO 内链网）：按分类分组
  const indexHtml = CATEGORY_META.map((c) => {
    const list = FOODS.filter((f) => f.category === c.key && f.id !== food.id)
      .map((f) => `<a href="/foods/${escAttr(f.id)}">${esc(f.name)}</a>`).join(' · ');
    return `      <p class="allcat"><strong>${esc(c.label)}:</strong> ${list}</p>`;
  }).join('\n');

  const emergBlock = (emergEn && (food.level === 'toxic' || food.level === 'severe'))
    ? `
      <div class="emerg">
        <h3>${food.level === 'severe' ? 'Act now — emergency' : 'Emergency guidance'}</h3>
        <p>${esc(emergEn)}</p>
        <p class="hot">ASPCA Animal Poison Control: (888) 426-4435 · Pet Poison Helpline: (855) 764-7661</p>
        <p>Do NOT make your dog vomit at home unless a veterinarian instructs you to.</p>
      </div>`
    : '';

  const doseBlockEn = doseEn ? `<p class="dose"><strong>Dose note:</strong> ${esc(doseEn)}</p>` : '';
  const doseBlockZh = doseZh ? `<p class="dose"><strong>剂量提示：</strong>${esc(doseZh)}</p>` : '';

  const zhEmergencyNote = (emergZh && (food.level === 'toxic' || food.level === 'severe'))
    ? `<div class="emerg"><h3>立即行动 — 紧急</h3><p>${esc(emergZh)}</p></div>` : '';

  /* JSON-LD：Article + 关于宠物健康的事实性声明（about MedicalCondition 之外用 aboutThing 保守描述） */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: `Can Dogs Eat ${food.name}? ${lvlEn}`,
        about: {
          '@type': 'Thing',
          name: `${food.name} safety for dogs`,
          description: `${food.name} for dogs: ${lvlEn}.`
        },
        description: metaDesc,
        inLanguage: 'en',
        isAccessibleForFree: true,
        dateModified: food.checked || SITEMAP_LASTMOD,
        datePublished: food.checked || SITEMAP_LASTMOD,
        author: { '@type': 'Organization', name: SITE_NAME },
        publisher: { '@type': 'Organization', name: SITE_NAME },
        mainEntityOfPage: { '@type': 'WebPage', '@id': absUrl(`foods/${food.id}`) },
        citation: (food.sources || []).map((sid) => SOURCES[sid] && SOURCES[sid].url).filter(Boolean)
      },
      {
        '@type': 'WebPage',
        '@id': absUrl(`foods/${food.id}`),
        url: absUrl(`foods/${food.id}`),
        name: title,
        description: metaDesc,
        inLanguage: ['en', 'zh'],
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: absUrl('/') }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: absUrl('/') },
          { '@type': 'ListItem', position: 2, name: catEn, item: absUrl(`#${cat.anchor}`) },
          { '@type': 'ListItem', position: 3, name: `Can dogs eat ${food.name}?`, item: absUrl(`foods/${food.id}`) }
        ]
      }
    ]
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${escAttr(metaDesc)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${escAttr(absUrl(`foods/${food.id}`))}">

  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="Can Dogs Eat ${escAttr(food.name)}? ${escAttr(lvlEn)}">
  <meta property="og:description" content="${escAttr(metaDesc)}">
  <meta property="og:url" content="${escAttr(absUrl(`foods/${food.id}`))}">
  <meta property="og:site_name" content="${escAttr(SITE_NAME)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Can Dogs Eat ${escAttr(food.name)}? ${escAttr(lvlEn)}">
  <meta name="twitter:description" content="${escAttr(metaDesc)}">
  <!-- og:image intentionally omitted (no image asset yet) -->

  <link rel="stylesheet" href="/style.css">

  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2).split('\n').map((l) => '  ' + l).join('\n')}
  </script>

  <style>
    /* 落地页少量补充样式（复用站点 CSS 变量与等级配色） */
    .lp-wrap { max-width: 860px; margin: 0 auto; padding: 24px 16px 64px; }
    .lp-top-disclaimer { border: 2px solid var(--c-toxic); border-radius: 10px;
      padding: 12px 16px; margin: 0 0 20px; background: #fff5f5; color: #7f0000; font-size: 15px; line-height: 1.5; }
    .lp-top-disclaimer strong { color: #7f0000; }
    .lp-breadcrumb { font-size: 13px; color: #555; margin: 0 0 14px; }
    .lp-breadcrumb a { color: #2e7d32; }
    .lp-badge { display: inline-block; color: #fff; font-weight: 800; letter-spacing: .03em;
      padding: 8px 14px; border-radius: 8px; font-size: 18px; }
    .lp-badge.badge--safe { background: var(--c-safe); }
    .lp-badge.badge--moderation { background: var(--c-mod); }
    .lp-badge.badge--caution { background: var(--c-caution); }
    .lp-badge.badge--toxic { background: var(--c-toxic); }
    .lp-badge.badge--severe { background: var(--c-severe); }
    .lp-h1 { font-size: 1.7rem; margin: 12px 0 6px; }
    .lp-block { margin: 18px 0; }
    .lp-block h3 { font-size: 1.05rem; margin: 0 0 6px; }
    .lp-block ul { margin: 6px 0 0; padding-left: 20px; }
    .lp-block li { margin: 4px 0; line-height: 1.55; }
    .lp-zh { margin-top: 40px; padding-top: 20px; border-top: 2px dashed #ccc; }
    .lp-zh h2 { font-size: 1.3rem; }
    .lp-emerg, .emerg { border: 2px solid var(--c-severe); border-radius: 10px;
      padding: 12px 16px; margin: 18px 0; background: #fff0f0; }
    .lp-emerg h3, .emerg h3 { margin: 0 0 6px; color: var(--c-severe); }
    .dose { background: #f4f6f4; border-radius: 8px; padding: 8px 12px; }
    .lp-sources a { color: #2e7d32; }
    .lp-related, .lp-allcat { margin-top: 28px; }
    .lp-related li, .allcat { line-height: 1.9; }
    .lp-allcat p { margin: 6px 0; font-size: 14px; }
    .lp-allcat a { color: #2e7d32; white-space: nowrap; }
    .lp-back { display: inline-block; margin-top: 24px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="lp-wrap">

    <!-- 顶部醒目免责声明（爬虫与用户都能看到） -->
    <div class="lp-top-disclaimer" role="note">
      <strong>⚠ General information only — not veterinary advice.</strong>
      This page is not a veterinary diagnosis or treatment. If your dog may have eaten something toxic,
      contact your veterinarian immediately, or call ASPCA Animal Poison Control <strong>(888) 426-4435</strong>
      or Pet Poison Helpline <strong>(855) 764-7661</strong> (both 24/7; a consultation fee may apply).
      Do not induce vomiting unless a veterinarian tells you to.
    </div>

    <nav class="lp-breadcrumb" aria-label="Breadcrumb">
      <a href="/">${esc(SITE_NAME)} — ${esc(SITE_TAGLINE)}</a> ›
      <a href="/#${escAttr(cat.anchor)}">${esc(catEn)}</a> ›
      <span>Can dogs eat ${esc(food.name)}?</span>
    </nav>

    <article>
      <span class="lp-badge badge--${escAttr(food.level)}">${esc(lvlEn)}</span>
      <h1 class="lp-h1">Can Dogs Eat ${esc(food.name)}?</h1>
      <p class="lp-sub">Category: <a href="/#${escAttr(cat.anchor)}">${esc(catEn)}</a> ·
         Verdict: <strong>${esc(lvlEn)}</strong> · Last reviewed: ${esc(food.checked || SITEMAP_LASTMOD)}</p>

      <div class="lp-block">
        <h3>Why</h3>
        <p>${esc(reasonEn)}</p>
      </div>

      <div class="lp-block">
        <h3>Symptoms to watch for</h3>
        <ul>
${symptomsListEn}
        </ul>
      </div>

      <div class="lp-block">
        <h3>What to do</h3>
        <ul>
${adviceListEn}
        </ul>
        ${doseBlockEn}
      </div>
${emergBlock}

      <div class="lp-block lp-sources">
        <h3>Sources</h3>
        <ul>
${sourcesEnHtml}
        </ul>
        <p class="lp-disclaimer-note">General information only — not veterinary advice.
          See the <a href="/#disclaimer-full">full disclaimer</a>.</p>
      </div>
    </article>

    <!-- 中文内容（EN 为主，ZH 附后） -->
    <section class="lp-zh" lang="zh">
      <h2>狗能吃${esc(food.nameZh || food.name)}吗？</h2>
      <p><span class="lp-badge badge--${escAttr(food.level)}">${esc(lvlZh)}</span>
         分类：${esc(catZh)} · 最后核对：${esc(food.checked || SITEMAP_LASTMOD)}</p>
      <div class="lp-block">
        <h3>原因</h3>
        <p>${esc(reasonZh)}</p>
      </div>
      <div class="lp-block">
        <h3>需要留意的症状</h3>
        <ul>
${symptomsListZh}
        </ul>
      </div>
      <div class="lp-block">
        <h3>应对建议</h3>
        <ul>
${adviceListZh}
        </ul>
        ${doseBlockZh}
      </div>
${zhEmergencyNote}
      <p class="lp-disclaimer-note">仅供参考 — 不构成兽医建议。完整免责声明见
        <a href="/#disclaimer-full">主页页脚</a>。</p>
    </section>

    <a class="lp-back" href="/">← Back to the full checker (88 foods)</a>

    <section class="lp-related">
      <h2>Related foods in ${esc(catEn)}</h2>
      <ul>
${relatedHtml}
      </ul>
    </section>

    <!-- 全量索引内链（SEO 内链网） -->
    <section class="lp-allcat">
      <h2>All foods</h2>
${indexHtml}
    </section>

  </div>
</body>
</html>
`;
}

/* ----------------------------------------------------------------------------
 * 4. sitemap.xml
 * --------------------------------------------------------------------------*/
function buildSitemap() {
  const urls = [];
  urls.push(`  <url>
    <loc>${esc(absUrl('/'))}</loc>
    <lastmod>${esc(SITEMAP_LASTMOD)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`);
  FOODS.forEach((f) => {
    urls.push(`  <url>
    <loc>${esc(absUrl(`foods/${f.id}`))}</loc>
    <lastmod>${esc(f.checked || SITEMAP_LASTMOD)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

/* ----------------------------------------------------------------------------
 * 5. robots.txt
 * --------------------------------------------------------------------------*/
function buildRobots() {
  return `# robots.txt — ${SITE_NAME} ${SITE_TAGLINE}
User-agent: *
Allow: /

Sitemap: ${absUrl('sitemap.xml')}
`;
}

/* ----------------------------------------------------------------------------
 * 6. index.html「落地页索引区」同步
 * --------------------------------------------------------------------------
 * 在主页 browse-section 之后插入一段静态（不依赖 JS）的落地页索引，
 * 为爬虫和「禁用 JS」用户提供到 88 个可索引 URL 的入口。
 * 用哨兵注释包裹，重跑时整体替换，绝不破坏其它现有功能。
 * --------------------------------------------------------------------------*/
const INDEX_START = '<!-- FOODS-STATIC-INDEX:START (generated by build/generate-foods-pages.js) -->';
const INDEX_END = '<!-- FOODS-STATIC-INDEX:END -->';

function buildStaticIndexSection() {
  const perCat = CATEGORY_META.map((c) => {
    const links = FOODS.filter((f) => f.category === c.key)
      .map((f) => `          <li><a href="/foods/${escAttr(f.id)}">Can dogs eat ${esc(f.name)}? <span class="si-lvl badge--${escAttr(f.level)}">${esc(levelName('en', f.level))}</span></a></li>`)
      .join('\n');
    return `      <div class="si-cat">
        <h3>${esc(c.label)}</h3>
        <ul>
${links}
        </ul>
      </div>`;
  }).join('\n');

  return `${INDEX_START}
    <section id="foods-static-index" class="block foods-static-index" aria-labelledby="foods-static-index-heading">
      <h2 id="foods-static-index-heading" class="block-title">All food guides (static pages)</h2>
      <p class="block-desc">Every food also has its own page with the full verdict, symptoms, advice and sources — readable without JavaScript.</p>
      <div class="si-grid">
${perCat}
      </div>
    </section>
${INDEX_END}`;
}

function syncIndexHtml() {
  const indexPath = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  const section = buildStaticIndexSection();

  const re = new RegExp(
    INDEX_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '[\\s\\S]*?' +
    INDEX_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );

  if (re.test(html)) {
    html = html.replace(re, section);
  } else {
    // 首次插入：放在 browse-section 结束之后（AJAX-free，纯文本拼接）
    const anchor = '    </section>\n\n    <!-- AD_SLOT_2';
    if (html.indexOf(anchor) !== -1) {
      html = html.replace(anchor, '    </section>\n\n    ' + section + '\n\n    <!-- AD_SLOT_2');
    } else {
      // 兜底：插入到 </main> 之前
      html = html.replace('  </main>', '    ' + section + '\n  </main>');
    }
  }
  fs.writeFileSync(indexPath, html, 'utf8');
  return true;
}

/* ----------------------------------------------------------------------------
 * 7. 主流程
 * --------------------------------------------------------------------------*/
function main() {
  if (!fs.existsSync(FOODS_DIR)) fs.mkdirSync(FOODS_DIR, { recursive: true });

  let count = 0;
  FOODS.forEach((food) => {
    if (!food.id) return;
    const html = renderFoodPage(food);
    fs.writeFileSync(path.join(FOODS_DIR, `${food.id}.html`), html, 'utf8');
    count++;
  });

  fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), buildSitemap(), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'robots.txt'), buildRobots(), 'utf8');
  syncIndexHtml();

  console.log('✓ 落地页生成完成');
  console.log(`  - foods/*.html : ${count} 个`);
  console.log(`  - sitemap.xml  : 主页 + ${count} 落地页 (${count + 1} 条 URL)`);
  console.log(`  - robots.txt   : Sitemap -> ${absUrl('sitemap.xml')}`);
  console.log(`  - index.html   : 已同步静态落地页索引区`);
  console.log(`  - SITE_URL     : ${SITE_URL}${IS_PLACEHOLDER ? '  (占位域名，上线后请传入真实域名重跑)' : ''}`);
  if (IS_PLACEHOLDER) {
    console.log('');
    console.log('  提示：上线后执行以下命令批量替换为真实域名：');
    console.log('    node build/generate-foods-pages.js https://your-domain.com');
  }
}

main();
