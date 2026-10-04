/* ============================================================================
 * i18n.js — 狗粮安全判定器 国际化字典（测试版）
 * ----------------------------------------------------------------------------
 * 单代码源 + 语言切换：本文件是全部 UI 文案的唯一事实源（EN/ZH 双字典）。
 * 约束：
 *   - 纯静态配置，零网络请求、无 API、无数据库。
 *   - 所有文案经 textContent 注入（app.js §5），字典值一律为纯文本。
 *   - EN/ZH 两字典必须键集合一致（selftest.js 校验，杜绝漏译空值）。
 *
 * 结构：
 *   const I18N = {
 *     en: { ... 键 -> 字符串 ... },
 *     zh: { ... 同一批键 -> 字符串 ... }
 *   };
 *   const LEVEL_LABELS — 5 级安全等级名称（EN/ZH），app.js 渲染徽章/首字母大写短名
 *
 * 命名约定（键分组，见各组注释）：
 *   meta.*      页面标题/SEO/分享
 *   nav.*       顶栏与切换
 *   hero.*      首屏
 *   search.*    搜索框
 *   levels.*    五级安全等级名称（badge 大字 / short 短名）
 *   card.*      结果卡标签与按钮
 *   unknown.*   未收录保守卡
 *   multi.*     多候选卡
 *   emergency.* 紧急指引
 *   compare.*   对比栏
 *   browse.*    分类索引区
 *   chips.*     常见食物快捷入口（按食物 id 取标签）
 *   faq.*       FAQ
 *   footer.*    页脚与免责
 *   state.*     路由/提示类
 *
 * 最后人工核对日期：2026-10-03
 * ==========================================================================*/

'use strict';

/* ----------------------------------------------------------------------------
 * LEVEL_LABELS — 五级安全等级名称（EN/ZH）
 * badge：徽章大字（英文全大写风格；中文直接用等级名）
 * short：列表/联想处的小短名
 * 图标（✓/ⓘ/⚠/✕/☠）与颜色为语言无关，保留在 data.js 的 LEVEL_META。
 * --------------------------------------------------------------------------*/
const LEVEL_LABELS = {
  en: {
    safe:       { badge: 'SAFE',             short: 'Safe' },
    moderation: { badge: 'OK IN MODERATION', short: 'OK in moderation' },
    caution:    { badge: 'CAUTION',          short: 'Caution' },
    toxic:      { badge: 'TOXIC',            short: 'Toxic' },
    severe:     { badge: 'SEVERE — ACT NOW', short: 'Severe' }
  },
  zh: {
    safe:       { badge: '安全',             short: '安全' },
    moderation: { badge: '适量',             short: '适量' },
    caution:    { badge: '谨慎',             short: '谨慎' },
    toxic:      { badge: '有毒',             short: '有毒' },
    severe:     { badge: '剧毒 — 立即行动',  short: '剧毒' }
  }
};

/* ----------------------------------------------------------------------------
 * CATEGORY_LABELS — 8 大分类名称（EN/ZH），键与 CATEGORY_META[].key 一致
 * --------------------------------------------------------------------------*/
const CATEGORY_LABELS = {
  en: {
    fruit: 'Fruits', vegetable: 'Vegetables', protein: 'Proteins',
    dairy: 'Dairy & Eggs', grain: 'Grains & Staples', nut: 'Nuts & Seeds',
    drink: 'Drinks & Sweets', processed: 'Processed & Toxic'
  },
  zh: {
    fruit: '水果', vegetable: '蔬菜', protein: '蛋白质',
    dairy: '乳制品与蛋类', grain: '谷物与主食', nut: '坚果与种子',
    drink: '饮品与甜食', processed: '加工食品与毒物'
  }
};

/* ----------------------------------------------------------------------------
 * TRAITS — 特征引导（Guided ID）固定枚举的双语标签
 * ----------------------------------------------------------------------------
 * 结构：TRAITS[lang][group][code] = 人类可读标签
 *   group ∈ { colors, shapes, extras }，code 为纯 ASCII 语义键（与 data.js
 *   的 TRAITS_ENUM 完全一致；data.js 的食物 traits 字段只存 code）。
 * 纪律：这是**固定枚举**，禁止散落硬编码；data.js 只引用 code，标签唯一来源在此。
 * 与枚举的键集合一致性由 selftest.js 校验（数据枚举 vs 本表 EN/ZH）。
 * --------------------------------------------------------------------------*/
const TRAITS = {
  en: {
    colors: {
      red: 'Red', green: 'Green', yellow: 'Yellow', orange: 'Orange',
      brown: 'Brown', black: 'Black', white: 'White', purple: 'Purple'
    },
    shapes: {
      round: 'Round', bunch: 'Bunch / cluster', small: 'Small pieces',
      flat: 'Flat / slices', chunk: 'Large chunk', liquid: 'Liquid'
    },
    extras: {
      peel: 'Has peel / shell',     /* 有皮·需剥 */
      pit: 'Has pit / core',        /* 有核 */
      snack: 'Common snack',        /* 常见零食 */
      processed: 'Processed'        /* 加工制品 */
    }
  },
  zh: {
    colors: {
      red: '红色', green: '绿色', yellow: '黄色', orange: '橙色',
      brown: '棕色', black: '黑色', white: '白色', purple: '紫色'
    },
    shapes: {
      round: '圆的', bunch: '成串', small: '小颗粒',
      flat: '片状', chunk: '大块', liquid: '液体'
    },
    extras: {
      peel: '有皮·需剥', pit: '有核', snack: '常见零食', processed: '加工制品'
    }
  }
};

/* ----------------------------------------------------------------------------
 * I18N — EN/ZH 双字典（键集合必须完全一致）
 * --------------------------------------------------------------------------*/
const I18N = {

  /* ============================================================ EN ======= */
  en: {
    /* ---- meta ---- */
    'meta.title': 'Can Dogs Eat That? Dog Food Safety Checker — Safe or Toxic',
    'meta.skipToSearch': 'Skip to search',

    /* ---- nav ---- */
    'nav.home': 'CanDogsEat home',
    'nav.brand': 'CanDogsEat',
    'nav.emergencyLink': 'Emergency? Read this',
    'nav.langGroupLabel': 'Language',
    'nav.langEn': 'EN',
    'nav.langZh': '中文',

    /* ---- hero ---- */
    'hero.title': 'Can dogs eat that?',
    'hero.sub': 'Type a food — get an instant safe / toxic verdict, the reason, symptoms and what to do. Sourced from ASPCA & AKC. No sign-up. Works offline.',

    /* ---- search ---- */
    'search.label': 'Search a food',
    'search.placeholder': 'e.g. chocolate, grapes, apple…',
    'search.button': 'Check',
    'search.hint': 'Start typing to see suggestions, or pick a common food below.',
    'search.suggestListLabel': 'Food suggestions',
    'search.noMatchSuggest': 'No match — press Enter for the safe answer.',
    'search.resultSectionLabel': 'Safety result',
    'search.matchedPart': 'matched part of your input',
    'search.notePrefix': 'Note: ',

    /* ---- card ---- */
    'card.why': 'Why',
    'card.symptoms': 'Symptoms to watch for',
    'card.whatToDo': 'What to do',
    'card.doseNote': 'Dose note',
    'card.sources': 'Sources: ',
    'card.more': 'More about this food',
    'card.categoryLine': 'Category: {cat}. Also searched as: {aliases}.',
    'card.verdictLevel': 'Verdict level: {level}.',
    'card.addCompare': '＋ Add to compare',
    'card.emergencySteps': '⚠ Emergency steps',
    'card.yourSearch': 'your search: {q}',
    'card.severeBanner': 'SEVERE — act now. This can be life-threatening.',
    'card.toxicBanner': 'TOXIC — do not feed. Contact a vet if eaten.',
    'card.disclaimer': 'General information only — not veterinary advice. If your dog may have eaten something toxic, contact your vet or ASPCA Poison Control (888) 426-4435. ',
    'card.disclaimerLink': 'Full disclaimer',
    'card.emptyStrong': 'Type a food to check if it is safe for dogs.',
    'card.emptySub': 'Try "chocolate", "grapes" or "apple" — or tap a common food below.',
    'card.emergencyTitleNormal': 'Emergency guidance',
    'card.emergencyTitleSevere': 'Act now — emergency',
    'card.emergencyNoVomit': 'Do NOT make your dog vomit at home unless a veterinarian tells you to.',

    /* ---- xylitol alert ---- */
    'xyl.title': '☠ Warning: "sugar-free" often means xylitol — highly toxic to dogs',
    'xyl.body': 'Xylitol (also called birch sugar) causes dangerous hypoglycemia and liver failure in dogs. It is found in sugar-free gum, mints, candy, baked goods, toothpaste and some peanut butters. Even a tiny amount — as little as 0.1 g per kg of body weight — can be an emergency.',
    'xyl.noVomit': 'Do NOT induce vomiting unless a veterinarian tells you to.',
    'xyl.button': 'See the full xylitol page',

    /* ---- unknown ---- */
    'unknown.badge': 'UNKNOWN — NOT IN OUR DATABASE',
    'unknown.title': 'Not in our database',
    'unknown.text': "We don't have this food in our database yet — and that does NOT mean it's safe.",
    'unknown.rules': 'General rules: no fatty, salty or sugary foods, nothing with onion, garlic or artificial sweeteners, and nothing heavily processed or seasoned. When in doubt, ask your vet.',
    'unknown.searched': 'You searched: "{q}"',
    'unknown.neverGuess': 'This checker never guesses a safety level. If you are unsure whether a food is safe, do not feed it, and ask your veterinarian.',
    'unknown.emergency': 'If your dog may have eaten something unsafe, do not wait for symptoms. Contact your vet or a pet poison hotline now.',

    /* ---- multi ---- */
    'multi.title': 'Did you mean…?',
    'multi.intro': 'We found several matches',
    'multi.introFor': 'We found several matches for "{q}". Pick one to see the full verdict.',
    'multi.pick': 'Pick one to see the full verdict.',

    /* ---- emergency ---- */
    'emergency.summary': 'My dog ate something toxic — what now?',
    'emergency.sectionLabel': 'Emergency guidance',
    'emergency.step1': 'Write down {{what}} your dog ate, {{howMuch}}, and {{when}}.',
    'emergency.step1What': 'what', 'emergency.step1HowMuch': 'how much', 'emergency.step1When': 'when',
    'emergency.step2a': 'Call your vet, or a 24/7 pet poison hotline:',
    'emergency.hotline1': 'ASPCA Animal Poison Control: (888) 426-4435',
    'emergency.hotline1Fee': '(consultation fee may apply)',
    'emergency.hotline2': 'Pet Poison Helpline: (855) 764-7661',
    'emergency.step3': '{{noVomit}} unless a veterinarian instructs you to.',
    'emergency.step3NoVomit': 'Do NOT make your dog vomit at home',
    'emergency.step4': 'Keep the packaging or a sample of the food for the vet.',

    /* ---- compare ---- */
    'compare.heading': 'Compare foods',
    'compare.upTo4': '(up to 4)',
    'compare.trayLabel': 'Foods queued for comparison',
    'compare.remove': 'Remove {name} from comparison',

    /* ---- browse ---- */
    'browse.heading': 'Browse all 88 foods',
    'browse.desc': 'Every food we cover, with its verdict. Click any row for full details, symptoms and sources.',
    'browse.categoryNavLabel': 'Food categories',

    /* ---- chips ---- */
    'chips.heading': 'Common foods',
    'chips.groupLabel': 'Common foods shortcuts',

    /* ---- faq ---- */
    'faq.heading': 'Frequently asked questions',
    'faq.q1': 'What foods are most toxic to dogs?',
    'faq.a1': 'The most dangerous foods include chocolate (especially dark and baking chocolate), grapes and raisins, xylitol (an artificial sweetener in sugar-free gum and candy), onions and garlic, macadamia nuts, alcohol, and raw yeast dough. Always contact a veterinarian or a pet poison hotline if your dog eats any of these.',
    'faq.q2': 'My dog ate something toxic — what should I do first?',
    'faq.a2': 'Write down what your dog ate, how much and when. Call your vet, or ASPCA Animal Poison Control at (888) 426-4435 or Pet Poison Helpline at (855) 764-7661 (both 24/7; a consultation fee may apply). Do not make your dog vomit at home unless a veterinarian tells you to, and keep the packaging or a sample for the vet.',
    'faq.q3': 'Is peanut butter safe for dogs?',
    'faq.a3': 'Plain, unsalted peanut butter is generally safe in small amounts, but some brands — especially low-sugar or "healthy" versions — contain xylitol, an artificial sweetener that is extremely toxic to dogs. Always read the label and choose a brand with no xylitol (also called birch sugar).',
    'faq.q4': 'Can dogs eat grapes or raisins?',
    'faq.a4': 'No. Grapes and raisins can cause acute kidney injury in dogs, and there is no known safe dose — even a small amount can be dangerous. Treat any grape or raisin ingestion as an emergency and contact your vet or a pet poison hotline.',
    'faq.q5': 'Is this tool veterinary advice?',
    'faq.a5': 'No. This tool provides general information only and is not a veterinary diagnosis or medical advice, and it cannot account for your dog\'s weight, breed or health conditions. If your dog may have eaten something toxic, contact your veterinarian immediately.',

    /* ---- footer ---- */
    'footer.disclaimerHeading': 'Disclaimer — please read',
    'footer.disclaimer1': 'This tool provides {{strong1}}. It is {{strong2}} and is no substitute for a consultation with a licensed veterinarian.',
    'footer.disclaimer1S1': 'general information only', 'footer.disclaimer1S2': 'not veterinary advice, diagnosis or treatment',
    'footer.disclaimer2': '{{strong1}}, or a 24/7 pet poison hotline: ASPCA Animal Poison Control {{hl1}} or Pet Poison Helpline {{hl2}} (a consultation fee may apply).',
    'footer.disclaimer2S1': 'In an emergency, contact your veterinarian immediately',
    'footer.disclaimer3': 'Verdicts are compiled from public guidance published by ASPCA, AKC, PetMD and veterinary practices. {{strong1}} — your dog\'s weight, breed, age and existing health conditions — can change the real risk, and dose matters.',
    'footer.disclaimer3S1': 'Individual factors',
    'footer.disclaimer4': 'Do not use this tool to decide whether to delay seeking care. When in doubt, call your vet. Data last reviewed: {{date}}.',
    'footer.sourcesHeading': 'Sources',
    'footer.testBadge': 'Test build — not launched',
    'footer.bottom': 'CanDogsEat · Educational tool · No cookies, no tracking, no sign-up.',

    /* ---- guided identify (feature wizard) ---- */
    'identify.cta': "I don't know the name",
    'identify.panelLabel': 'Guided food finder',
    'identify.title': "Don't know the name? Find it by looks",
    'identify.intro': 'Pick where it came from, then tap what it looks like. We only show foods we have already checked — we never guess a safety level.',
    'identify.close': 'Close',
    'identify.back': 'Back',
    'identify.reset': 'Start over',
    'identify.step1Title': 'Where is it from?',
    'identify.step1Hint': 'Choose one category.',
    'identify.step2Title': 'What does it look like?',
    'identify.step2Hint': 'Optional — pick any features that match. You can skip.',
    'identify.step2Optional': 'optional, multi-select',
    'identify.step3Title': 'Is it one of these?',
    'identify.step3Hint': 'Tap a food to see the full verdict.',
    'identify.groupColors': 'Colour',
    'identify.groupShapes': 'Shape',
    'identify.groupExtras': 'Other',
    'identify.skip': 'Skip this step',
    'identify.code': 'Step {n} of 3',
    'identify.resultCount': '{n} possible match(es)',
    'identify.resultCountOne': '1 possible match',
    'identify.refine': 'None of these — go back / change features',
    'identify.showTraits': 'Shown by: {traits}',
    'identify.emptyTitle': 'No match with those features',
    'identify.emptyBody': "We still don't have this food in our database — and that does NOT mean it's safe. Try fewer features, or check the name directly.",
    'identify.emptyActions': 'Go back and change features',

    /* ---- state / misc ---- */
    'state.dataFailed': 'Data failed to load. Please reload the page.',
    'state.emergencyLine': 'ASPCA Animal Poison Control: (888) 426-4435 · Pet Poison Helpline: (855) 764-7661'
  },

  /* ============================================================ ZH ======= */
  zh: {
    /* ---- meta ---- */
    'meta.title': '狗狗能吃吗？宠物食品（狗粮）安全判定器 — 安全还是有毒',
    'meta.skipToSearch': '跳到搜索',

    /* ---- nav ---- */
    'nav.home': 'CanDogsEat 首页',
    'nav.brand': 'CanDogsEat',
    'nav.emergencyLink': '紧急？点这里',
    'nav.langGroupLabel': '语言',
    'nav.langEn': 'EN',
    'nav.langZh': '中文',

    /* ---- hero ---- */
    'hero.title': '狗狗能吃这个吗？',
    'hero.sub': '输入一个食物，立刻得到「安全 / 有毒」判定，以及原因、症状和应对方法。资料来自 ASPCA 与 AKC。无需注册，离线可用。',

    /* ---- search ---- */
    'search.label': '搜索食物',
    'search.placeholder': '例如：巧克力、葡萄、苹果…',
    'search.button': '检查',
    'search.hint': '开始输入即可看到建议，也可以点下面的常见食物。',
    'search.suggestListLabel': '食物建议',
    'search.noMatchSuggest': '没有匹配项 — 按回车查看保守答案。',
    'search.resultSectionLabel': '安全判定结果',
    'search.matchedPart': '命中了您输入的一部分',
    'search.notePrefix': '提示：',

    /* ---- card ---- */
    'card.why': '原因',
    'card.symptoms': '需要留意的症状',
    'card.whatToDo': '应对建议',
    'card.doseNote': '剂量提示',
    'card.sources': '来源：',
    'card.more': '关于这种食物的更多信息',
    'card.categoryLine': '分类：{cat}。其他可搜词：{aliases}。',
    'card.verdictLevel': '判定等级：{level}。',
    'card.addCompare': '＋ 加入对比',
    'card.emergencySteps': '⚠ 紧急处理步骤',
    'card.yourSearch': '您的搜索：{q}',
    'card.severeBanner': '剧毒 — 立即行动。这可能危及生命。',
    'card.toxicBanner': '有毒 — 请勿喂食。若已误食请联系兽医。',
    'card.disclaimer': '仅供参考 — 不构成兽医建议。若狗狗可能误食了有毒物质，请联系兽医或 ASPCA 中毒控制中心 (888) 426-4435。',
    'card.disclaimerLink': '完整免责声明',
    'card.emptyStrong': '输入一个食物，检查狗狗能不能吃。',
    'card.emptySub': '试试「巧克力」「葡萄」或「苹果」— 也可以点下面的常见食物。',
    'card.emergencyTitleNormal': '紧急处理指引',
    'card.emergencyTitleSevere': '立即行动 — 紧急',
    'card.emergencyNoVomit': '除非兽医指示，否则不要在家中给狗狗催吐。',

    /* ---- xylitol alert ---- */
    'xyl.title': '☠ 警告：「无糖」往往就是木糖醇 — 对狗剧毒',
    'xyl.body': '木糖醇（又称桦木糖）会导致狗狗严重的低血糖和肝功能衰竭。它存在于无糖口香糖、薄荷糖、糖果、烘焙食品、牙膏和部分花生酱中。哪怕极少量——低至每公斤体重 0.1 克——都可能是急诊。',
    'xyl.noVomit': '除非兽医指示，否则不要催吐。',
    'xyl.button': '查看木糖醇完整页面',

    /* ---- unknown ---- */
    'unknown.badge': '未知 — 不在我们的数据库中',
    'unknown.title': '不在我们的数据库中',
    'unknown.text': '我们的数据库里暂时没有这种食物——这并不代表它安全。',
    'unknown.rules': '通用原则：不要喂高脂、高盐、高糖的食物；不要喂含洋葱、大蒜或人工甜味剂的食物；不要喂重加工或重调味的食物。如有疑问，请咨询兽医。',
    'unknown.searched': '您的搜索：「{q}」',
    'unknown.neverGuess': '本工具绝不猜测安全等级。如果您不确定某种食物是否安全，请不要喂食，并咨询您的兽医。',
    'unknown.emergency': '如果狗狗可能误食了不安全的食物，不要等出现症状。请立即联系兽医或宠物中毒热线。',

    /* ---- multi ---- */
    'multi.title': '您想找的是…？',
    'multi.intro': '我们找到了多个匹配项',
    'multi.introFor': '我们为「{q}」找到了多个匹配项。请选择一项查看完整判定。',
    'multi.pick': '请选择一项查看完整判定。',

    /* ---- emergency ---- */
    'emergency.summary': '狗狗误食了有毒的东西 — 现在怎么办？',
    'emergency.sectionLabel': '紧急处理指引',
    'emergency.step1': '记下狗狗{{what}}、{{howMuch}}，以及{{when}}。',
    'emergency.step1What': '吃了什么', 'emergency.step1HowMuch': '吃了多少', 'emergency.step1When': '什么时候吃的',
    'emergency.step2a': '联系您的兽医，或拨打 24 小时宠物中毒热线：',
    'emergency.hotline1': 'ASPCA 动物中毒控制中心：(888) 426-4435',
    'emergency.hotline1Fee': '（可能收取咨询费）',
    'emergency.hotline2': '宠物中毒求助热线：(855) 764-7661',
    'emergency.step3': '除非兽医指示，否则{{noVomit}}。',
    'emergency.step3NoVomit': '不要在家中给狗狗催吐',
    'emergency.step4': '保留包装或食物样本，交给兽医。',

    /* ---- compare ---- */
    'compare.heading': '食物对比',
    'compare.upTo4': '（最多 4 种）',
    'compare.trayLabel': '已加入对比的食物',
    'compare.remove': '从对比中移除 {name}',

    /* ---- browse ---- */
    'browse.heading': '浏览全部 88 种食物',
    'browse.desc': '我们收录的每一种食物及其判定。点击任意一行查看完整详情、症状和来源。',
    'browse.categoryNavLabel': '食物分类',

    /* ---- chips ---- */
    'chips.heading': '常见食物',
    'chips.groupLabel': '常见食物快捷入口',

    /* ---- faq ---- */
    'faq.heading': '常见问题',
    'faq.q1': '哪些食物对狗最毒？',
    'faq.a1': '最危险的食物包括巧克力（尤其是黑巧克力和烘焙巧克力）、葡萄和葡萄干、木糖醇（无糖口香糖和糖果中的人工甜味剂）、洋葱和大蒜、夏威夷果、酒精，以及生面团。如果狗狗吃了其中任何一种，请务必联系兽医或宠物中毒热线。',
    'faq.q2': '狗狗误食了有毒的东西 — 我应该先做什么？',
    'faq.a2': '记下狗狗吃了什么、吃了多少、什么时候吃的。联系您的兽医，或拨打 ASPCA 动物中毒控制中心 (888) 426-4435 或宠物中毒求助热线 (855) 764-7661（均 24 小时；可能收取咨询费）。除非兽医指示，否则不要在家中给狗狗催吐，并保留包装或样本交给兽医。',
    'faq.q3': '花生酱对狗安全吗？',
    'faq.a3': '原味、无盐的花生酱少量一般是安全的，但一些品牌——尤其是低糖或「健康」版本——含有木糖醇，这种人工甜味剂对狗剧毒。请务必查看标签，选择不含木糖醇（又称桦木糖）的品牌。',
    'faq.q4': '狗能吃葡萄或葡萄干吗？',
    'faq.a4': '不能。葡萄和葡萄干会导致狗急性肾损伤，且没有已知的安全剂量——即使少量也可能危险。任何葡萄或葡萄干误食都应按紧急情况处理，并联系您的兽医或宠物中毒热线。',
    'faq.q5': '这个工具给出的是兽医建议吗？',
    'faq.a5': '不是。本工具仅提供一般性信息，不是兽医诊断或医疗建议，也无法考虑您狗狗的体重、品种或健康状况。如果狗狗可能误食了有毒物质，请立即联系您的兽医。',

    /* ---- footer ---- */
    'footer.disclaimerHeading': '免责声明 — 请阅读',
    'footer.disclaimer1': '本工具仅提供{{strong1}}，{{strong2}}，也不能替代执业兽医的诊疗。',
    'footer.disclaimer1S1': '一般性信息', 'footer.disclaimer1S2': '不构成兽医建议、诊断或治疗',
    'footer.disclaimer2': '{{strong1}}，或拨打 24 小时宠物中毒热线：ASPCA 动物中毒控制中心 {{hl1}} 或宠物中毒求助热线 {{hl2}}（可能收取咨询费）。',
    'footer.disclaimer2S1': '紧急情况下，请立即联系您的兽医',
    'footer.disclaimer3': '判定结果整理自 ASPCA、AKC、PetMD 及兽医诊所公开发布的资料。{{strong1}}——您狗狗的体重、品种、年龄和既有健康状况——会改变实际风险，剂量也很重要。',
    'footer.disclaimer3S1': '个体因素',
    'footer.disclaimer4': '不要用本工具来决定是否推迟就医。如有疑问，请致电兽医。数据最后审核日期：{{date}}。',
    'footer.sourcesHeading': '资料来源',
    'footer.testBadge': '测试版 — 未上线',
    'footer.bottom': 'CanDogsEat · 教育用途工具 · 无 cookie、无追踪、无需注册。',

    /* ---- guided identify (feature wizard) ---- */
    'identify.cta': '不认识食物的名字',
    'identify.panelLabel': '特征引导查询',
    'identify.title': '不记得叫什么？按外形找找看',
    'identify.intro': '先选它是哪一类，再点它看起来像什么。我们只列出已经核验过的食物——绝不猜测安全等级。',
    'identify.close': '关闭',
    'identify.back': '返回上一步',
    'identify.reset': '重新开始',
    'identify.step1Title': '它属于哪一类？',
    'identify.step1Hint': '请选择一个大类。',
    'identify.step2Title': '它长什么样？',
    'identify.step2Hint': '可选——勾选符合的特征，也可以直接跳过。',
    'identify.step2Optional': '可选，可多选',
    'identify.step3Title': '是这些中的一种吗？',
    'identify.step3Hint': '点选某个食物查看完整判定。',
    'identify.groupColors': '颜色',
    'identify.groupShapes': '形态',
    'identify.groupExtras': '其他',
    'identify.skip': '跳过这一步',
    'identify.code': '第 {n} 步，共 3 步',
    'identify.resultCount': '可能的匹配：{n} 种',
    'identify.resultCountOne': '可能的匹配：1 种',
    'identify.refine': '都不对——返回上一步 / 改特征',
    'identify.showTraits': '匹配特征：{traits}',
    'identify.emptyTitle': '这些特征没有匹配到食物',
    'identify.emptyBody': '我们的数据库里还没有这种食物——这并不代表它安全。可以少选几个特征，或直接用名字搜索。',
    'identify.emptyActions': '返回上一步修改特征',

    /* ---- state / misc ---- */
    'state.dataFailed': '数据加载失败，请重新加载页面。',
    'state.emergencyLine': 'ASPCA 动物中毒控制中心：(888) 426-4435 · 宠物中毒求助热线：(855) 764-7661'
  }
};

/* ----------------------------------------------------------------------------
 * 导出（兼容浏览器 <script> 与 Node 测试环境）
 * --------------------------------------------------------------------------*/
if (typeof window !== 'undefined') {
  window.I18N = I18N;
  window.LEVEL_LABELS = LEVEL_LABELS;
  window.CATEGORY_LABELS = CATEGORY_LABELS;
  window.TRAITS = TRAITS;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { I18N, LEVEL_LABELS, CATEGORY_LABELS, TRAITS };
}
