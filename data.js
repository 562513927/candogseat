/* ============================================================================
 * data.js — 狗粮安全判定器 数据层（测试版）
 * ----------------------------------------------------------------------------
 * 单一事实源（single source of truth）来自 03-design.md §9「首批食物库清单」。
 * 数据纪律（硬约束，勿违反）：
 *   1. 所有毒性/安全结论必须可溯源到 SOURCES 表中的权威机构页码，不得编造。
 *   2. 机构结论分歧处（avocado / spinach / kale / tomato）一律取更保守的等级，
 *      并在该条 reason 中注明分歧。
 *   3. 修改任何 level / reason 时，必须同步更新该条的 sources 与 checked 日期。
 *   4. 本文件为纯静态配置，无任何网络请求、无 API、无数据库。
 *
 * 结构：
 *   const SOURCES  — 来源溯源表（编号 → 机构/文档/URL）
 *   const CATEGORY_META — 8 大分类元数据（显示名 + 锚点 id）
 *   const LEVEL_META    — 5 级安全等级元数据（文案/图标/CSS class）
 *   const TRAITS_ENUM   — 特征引导（Guided ID）固定枚举（code + emoji）
 *   const FOODS         — 88 条食物记录（每条含 traits 特征字段）
 *
 * 最后整体人工核对日期：2026-10-03
 * ==========================================================================*/

'use strict';

/* ----------------------------------------------------------------------------
 * SOURCES — 来源溯源表
 * 编号规范：<机构缩写>-<序号>，结果卡渲染为外链（target=_blank rel=noopener noreferrer）
 * --------------------------------------------------------------------------*/
const SOURCES = {
  "ASPCA-1": {
    org: "ASPCA Animal Poison Control",
    title: "People Foods to Avoid Feeding Your Pets",
    url: "https://www.aspca.org/pet-care/animal-poison-control/people-foods-avoid-feeding-your-pets"
  },
  "AKC-2": {
    org: "AKC (American Kennel Club)",
    title: "People Foods Dogs Can and Can't Eat",
    url: "https://www.akc.org/expert-advice/nutrition/human-foods-dogs-can-and-cant-eat/"
  },
  "AKC-3": {
    org: "AKC (American Kennel Club)",
    title: "Fruits and Vegetables Dogs Can or Can't Eat",
    url: "https://www.akc.org/expert-advice/nutrition/fruits-vegetables-dogs-can-and-cant-eat/"
  },
  "AKC-4": {
    org: "AKC (American Kennel Club)",
    title: "Can Dogs Eat Grapes?",
    url: "https://www.akc.org/expert-advice/advice/can-dogs-eat-grapes/"
  },
  "PETMD-5": {
    org: "PetMD",
    title: "Dog Chocolate Toxicity Meter & Symptoms",
    url: "https://www.petmd.com/dog/chocolate-toxicity"
  },
  "VET-6": {
    org: "Veterinary practices",
    title: "Shediac Veterinary Hospital / Bayside Mobile Vet / 1800PetMeds Education (xylitol 0.1g/kg; allium ~0.5% body weight)",
    url: "https://www.petmd.com/dog/emergency/poisoning-toxicity/xylitol-poisoning-dogs"
  },
  "EMERG-7": {
    org: "ASPCA / Pet Poison Helpline",
    title: "Emergency poison hotlines — ASPCA Animal Poison Control (888) 426-4435 · Pet Poison Helpline (855) 764-7661",
    url: "https://www.aspca.org/pet-care/animal-poison-control"
  }
};

/* ----------------------------------------------------------------------------
 * CATEGORY_META — 分类元数据（顺序即页面渲染顺序）
 * key 与 FOODS[].category 一一对应；anchor 用于 #browse-section 内锚点
 * --------------------------------------------------------------------------*/
const CATEGORY_META = [
  { key: "fruit",     label: "Fruits",                anchor: "cat-fruit" },
  { key: "vegetable", label: "Vegetables",            anchor: "cat-vegetable" },
  { key: "protein",   label: "Proteins",              anchor: "cat-protein" },
  { key: "dairy",     label: "Dairy & Eggs",          anchor: "cat-dairy" },
  { key: "grain",     label: "Grains & Staples",      anchor: "cat-grain" },
  { key: "nut",       label: "Nuts & Seeds",          anchor: "cat-nut" },
  { key: "drink",     label: "Drinks & Sweets",       anchor: "cat-drink" },
  { key: "processed", label: "Processed & Toxic",     anchor: "cat-processed" }
];

/* ----------------------------------------------------------------------------
 * LEVEL_META — 5 级安全等级元数据（UI 三重编码：颜色 + 图标 + 文字）
 * 颜色定义见 style.css 中的 CSS 变量；此处仅存文案与语义键
 * --------------------------------------------------------------------------*/
const LEVEL_META = {
  safe:       { badge: "SAFE",               short: "Safe",              icon: "✓",  order: 0 },
  moderation: { badge: "OK IN MODERATION",   short: "OK in moderation",  icon: "ⓘ",  order: 1 },
  caution:    { badge: "CAUTION",            short: "Caution",           icon: "⚠",  order: 2 },
  toxic:      { badge: "TOXIC",              short: "Toxic",             icon: "✕",  order: 3 },
  severe:     { badge: "SEVERE — ACT NOW",   short: "Severe",            icon: "☠",  order: 4 }
};

/* ----------------------------------------------------------------------------
 * TRAITS_ENUM — 特征引导（Guided ID）固定枚举
 * ----------------------------------------------------------------------------
 * 用途：解决「用户不知道食物中英文名」的纯前端方案（不做任何图像识别/AI）。
 * 纪律（硬约束）：
 *   1. 特征引导只是**索引辅助**：命中的食物走现有结果卡；未命中走 UNKNOWN 保守卡。
 *      **绝不引入任何“猜测等级”的逻辑** —— 安全结论 100% 来自本表 FOODS 的核验数据。
 *   2. 本表是「枚举 code」的唯一事实源；人类可读标签在 i18n.js 的 `TRAITS` 中（EN/ZH）。
 *      emoji 为语言无关图标，故留在本表。
 *   3. 每条 FOODS 记录必须携带 traits = { colors:[], shapes:[], extras:[] }，
 *      取值只能是下列 code；完整性/合法性由 selftest.js 校验（88/88 全覆盖）。
 *
 * 三组各含 code（数组顺序 = 向导中的展示顺序）：
 *   colors  颜色(8)：red green yellow orange brown black white purple
 *   shapes  形态(6)：round bunch small flat chunk liquid
 *   extras  其他(4)：peel pit snack processed
 * --------------------------------------------------------------------------*/
const TRAITS_ENUM = {
  colors: [
    { code: "red",    emoji: "🔴" },
    { code: "green",  emoji: "🟢" },
    { code: "yellow", emoji: "🟡" },
    { code: "orange", emoji: "🟠" },
    { code: "brown",  emoji: "🟤" },
    { code: "black",  emoji: "⚫" },
    { code: "white",  emoji: "⚪" },
    { code: "purple", emoji: "🟣" }
  ],
  shapes: [
    { code: "round",  emoji: "⚪" },
    { code: "bunch",  emoji: "🍇" },
    { code: "small",  emoji: "•" },
    { code: "flat",   emoji: "▬" },
    { code: "chunk",  emoji: "🧱" },
    { code: "liquid", emoji: "💧" }
  ],
  extras: [
    { code: "peel",      emoji: "🍊" },  /* 有皮·需剥 */
    { code: "pit",       emoji: "🍑" },  /* 有核 */
    { code: "snack",     emoji: "🍿" },  /* 常见零食 */
    { code: "processed", emoji: "🏭" }   /* 加工制品 */
  ]
};

/* 候选卡食物图标（视觉提示，非安全信息；未列出的食物回退通用图标） */
const FOOD_EMOJI = {
  apple: "🍎", banana: "🍌", blueberries: "🫐", strawberries: "🍓", watermelon: "🍉",
  raspberries: "🫐", blackberries: "🫐", cantaloupe: "🍈", mango: "🥭", pineapple: "🍍",
  peaches: "🍑", pears: "🍐", oranges: "🍊", cranberries: "🔴", cherries: "🍒",
  "lemons-limes": "🍋", tomatoes: "🍅", avocado: "🥑",
  carrots: "🥕", cucumbers: "🥒", "green-beans": "🫛", peas: "🫛", pumpkin: "🎃",
  "sweet-potato": "🍠", broccoli: "🥦", cauliflower: "🥦", celery: "🥬", spinach: "🥬",
  kale: "🥬", cabbage: "🥬", corn: "🌽", potatoes: "🥔", asparagus: "🥬",
  "bell-peppers": "🫑", mushrooms: "🍄",
  chicken: "🍗", turkey: "🍗", beef: "🥩", pork: "🥓", eggs: "🥚", fish: "🐟",
  salmon: "🐟", tuna: "🐟", shrimp: "🦐", ham: "🥓", "raw-meat": "🥩", bones: "🦴",
  milk: "🥛", cheese: "🧀", yogurt: "🥛", "ice-cream": "🍨",
  bread: "🍞", rice: "🍚", oatmeal: "🥣", pasta: "🍝", quinoa: "🌾", popcorn: "🍿",
  "raw-dough": "🍞",
  "macadamia-nuts": "🌰", almonds: "🌰", walnuts: "🌰", pecans: "🌰", peanuts: "🥜",
  cashews: "🥜", "peanut-butter": "🥜",
  coffee: "☕", tea: "🍵", "energy-drinks": "🥤", alcohol: "🍺", honey: "🍯",
  candy: "🍬", cake: "🍰",
  chocolate: "🍫", "dark-chocolate": "🍫", "white-chocolate": "🍫", nutella: "🍫",
  xylitol: "☠", grapes: "🍇", raisins: "🍇", onions: "🧅", garlic: "🧄",
  leeks: "🧅", chives: "🧅", scallions: "🧅", "french-fries": "🍟", pizza: "🍕",
  "hot-dogs": "🌭", ketchup: "🍅"
};

/* ----------------------------------------------------------------------------
 * FOODS — 88 条食物记录
 * 字段：id / name / aliases / category / level / reason / symptoms / advice /
 *       emergency(null 表示非毒物) / dosageNote / sources / checked / traits
 * traits：{ colors:[], shapes:[], extras:[] }，取值仅限 TRAITS_ENUM 的 code
 * --------------------------------------------------------------------------*/
const FOODS = [

  /* ========================== Fruits (18) ========================== */
  {
    id: "apple", name: "Apples",
    nameZh: "苹果",
    aliases: ["apple", "apple slices", "red apple", "green apple", "applesauce"],
    aliasesZh: ["苹果", "苹果片", "红苹果", "青苹果", "苹果泥"],
    category: "fruit", level: "safe",
    reason: "Apples are a good source of vitamin A, vitamin C and fiber for dogs. The flesh is safe — but apple seeds contain small amounts of cyanogenic compounds and the core is a choking hazard.",
    symptoms: "None from the flesh. If large amounts of seeds or core are eaten: choking, digestive upset; cyanide toxicity is only a risk in very large amounts.",
    advice: "Wash, remove the core and all seeds, then slice into bite-sized pieces. 1–2 slices is a treat — not a meal. Never feed apple pie or sweetened applesauce.",
    emergency: null,
    dosageNote: "A few slices are fine; keep treats under ~10% of daily calories.",
    traits: { colors: ["red","green"], shapes: ["round","small"], extras: ["peel","snack"] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "banana", name: "Bananas",
    nameZh: "香蕉",
    aliases: ["banana", "bananas", "mashed banana"],
    aliasesZh: ["香蕉", "香蕉泥"],
    category: "fruit", level: "safe",
    reason: "Bananas are safe in small amounts and provide potassium, vitamin B6, vitamin C and fiber. They are high in sugar, so they are a treat rather than a food.",
    symptoms: "None in small amounts. Too much can cause digestive upset or contribute to weight gain.",
    advice: "Peel first, then give 1–2 small slices. High-sugar fruit — keep it occasional, especially for overweight or diabetic dogs.",
    emergency: null,
    dosageNote: "A couple of slices; peel is not toxic but is hard to digest.",
    traits: { colors: ["yellow"], shapes: ["chunk"], extras: ["peel","snack"] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "blueberries", name: "Blueberries",
    nameZh: "蓝莓",
    aliases: ["blueberry", "blueberries", "fresh blueberries", "frozen blueberries"],
    aliasesZh: ["蓝莓", "新鲜蓝莓", "冷冻蓝莓"],
    category: "fruit", level: "safe",
    reason: "Blueberries are safe and low in sugar for a fruit, and are rich in antioxidants, vitamin C and fiber.",
    symptoms: "None expected. Very large amounts may cause mild stomach upset.",
    advice: "Fresh or frozen (plain, no sugar added) is fine. A small handful is plenty for most dogs.",
    emergency: null,
    dosageNote: "Small handful; avoid sweetened dried versions.",
    traits: { colors: ["purple","black"], shapes: ["small","bunch"], extras: ["snack"] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "strawberries", name: "Strawberries",
    nameZh: "草莓",
    aliases: ["strawberry", "strawberries", "frozen strawberries"],
    aliasesZh: ["草莓", "冷冻草莓"],
    category: "fruit", level: "safe",
    reason: "Strawberries are safe and contain vitamin C and antioxidants. They are low in calories but still contain natural sugar.",
    symptoms: "None expected; overfeeding may cause mild digestive upset.",
    advice: "Remove the leaves and stem, cut into small pieces, and feed a few at a time. Wash to remove pesticides.",
    emergency: null,
    dosageNote: "A few pieces; avoid chocolate-dipped or sugar-coated ones.",
    traits: { colors: ["red"], shapes: ["small"], extras: ["snack"] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "watermelon", name: "Watermelon",
    nameZh: "西瓜",
    aliases: ["watermelon", "melon", "seedless watermelon"],
    aliasesZh: ["西瓜", "无籽西瓜"],
    category: "fruit", level: "safe",
    reason: "Watermelon flesh is safe and hydrating, with vitamins A and C. The seeds and rind are the risk — seeds can cause blockage and the rind can cause stomach upset.",
    symptoms: "None from the flesh. Rind or large amounts of seeds: vomiting, diarrhea or intestinal blockage.",
    advice: "Remove all seeds and rind, then cube the red flesh. A great summer treat in moderation.",
    emergency: null,
    dosageNote: "A few cubes; remove seeds and rind before feeding.",
    traits: { colors: ["green","red"], shapes: ["chunk","round"], extras: ["peel","pit"] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "raspberries", name: "Raspberries",
    nameZh: "树莓",
    aliases: ["raspberry", "raspberries"],
    aliasesZh: ["树莓", "覆盆子"],
    category: "fruit", level: "safe",
    reason: "Raspberries are safe in small amounts and contain antioxidants, fiber and vitamin C. They also contain tiny amounts of natural xylitol, which is not a concern in normal fruit amounts.",
    symptoms: "None expected. Large amounts may cause mild digestive upset.",
    advice: "Feed a small handful of plain, washed berries. Avoid jams and syrups, which are high in sugar.",
    emergency: null,
    dosageNote: "A small handful; plain only.",
    traits: { colors: ["red","purple"], shapes: ["small","bunch"], extras: ["snack"] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "blackberries", name: "Blackberries",
    nameZh: "黑莓",
    aliases: ["blackberry", "blackberries"],
    aliasesZh: ["黑莓"],
    category: "fruit", level: "safe",
    reason: "Blackberries are generally considered safe in small amounts (veterinary consensus) and are rich in antioxidants and fiber.",
    symptoms: "None expected in small amounts; too many may cause loose stool.",
    advice: "Wash and give a few berries plain. Avoid any with added sugar or syrup.",
    emergency: null,
    dosageNote: "A few berries; source is veterinary consensus rather than a single ASPCA/AKC page.",
    traits: { colors: ["black","purple"], shapes: ["small","bunch"], extras: ["snack"] },
    sources: ["VET-6"], checked: "2026-10-03"
  },
  {
    id: "cantaloupe", name: "Cantaloupe",
    nameZh: "哈密瓜",
    aliases: ["cantaloupe", "rockmelon", "melon slices"],
    aliasesZh: ["哈密瓜", "甜瓜"],
    category: "fruit", level: "moderation",
    reason: "Cantaloupe flesh is non-toxic and rich in vitamins A and C, but it is high in sugar.",
    symptoms: "None in small amounts. Too much sugar: stomach upset, and it should be limited for overweight or diabetic dogs.",
    advice: "Remove the rind and seeds, cube the flesh, and give a small amount only. Rind is hard to digest — always remove it.",
    emergency: null,
    dosageNote: "A few small cubes; high sugar — occasional treat only.",
    traits: { colors: ["orange","green"], shapes: ["chunk","round"], extras: ["peel","pit"] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "mango", name: "Mango",
    nameZh: "芒果",
    aliases: ["mango", "mango slices"],
    aliasesZh: ["芒果", "芒果片"],
    category: "fruit", level: "moderation",
    reason: "Ripe mango flesh is non-toxic and full of vitamins A, B6, C and E — but it is high in sugar. The pit contains small amounts of cyanide and is a major choking/obstruction hazard.",
    symptoms: "None from the flesh. The pit can cause choking or intestinal blockage; too much fruit can cause digestive upset.",
    advice: "Peel, remove the pit completely, and cube the flesh. Small amounts only because of the sugar content.",
    emergency: null,
    dosageNote: "A few small cubes; always discard the pit.",
    traits: { colors: ["orange","yellow"], shapes: ["chunk","round"], extras: ["peel","pit"] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "pineapple", name: "Pineapple",
    nameZh: "菠萝",
    aliases: ["pineapple", "pineapple chunks"],
    aliasesZh: ["菠萝", "凤梨", "菠萝块"],
    category: "fruit", level: "moderation",
    reason: "Pineapple flesh is non-toxic and contains vitamin C, but it is high in sugar and the acidity can upset a dog's stomach.",
    symptoms: "None in small amounts. Too much: stomach upset, vomiting or diarrhea from the acid and sugar.",
    advice: "Feed fresh or plain canned (in juice, no added sugar), cut into small pieces. Avoid the spiky skin.",
    emergency: null,
    dosageNote: "A few small pieces; high sugar and acid — occasional only.",
    traits: { colors: ["yellow","brown"], shapes: ["chunk","round"], extras: ["peel"] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "peaches", name: "Peaches",
    nameZh: "桃子",
    aliases: ["peach", "peaches", "nectarine"],
    aliasesZh: ["桃子", "桃", "油桃"],
    category: "fruit", level: "moderation",
    reason: "Peach flesh is non-toxic in small amounts, but the pit, stem and leaves contain cyanide precursors and the pit is a choking and obstruction hazard.",
    symptoms: "None from small amounts of flesh. Pits/stems/leaves: choking, blockage, and in large amounts cyanide toxicity.",
    advice: "Only feed cleaned, pitted flesh cut into small pieces. Never give the pit, stem or leaves.",
    emergency: null,
    dosageNote: "A few small pieces of pitted flesh; discard pit, stem and leaves.",
    traits: { colors: ["orange","yellow"], shapes: ["round","chunk"], extras: ["pit","peel"] },
    sources: ["AKC-4"], checked: "2026-10-03"
  },
  {
    id: "pears", name: "Pears",
    nameZh: "梨",
    aliases: ["pear", "pears"],
    aliasesZh: ["梨", "梨子"],
    category: "fruit", level: "moderation",
    reason: "Pear flesh is non-toxic and a source of fiber and vitamin C, but it is high in sugar. The seeds and core contain cyanide precursors.",
    symptoms: "None from small amounts of flesh. Seeds/core: potential cyanide risk in large amounts; too much fruit causes loose stool.",
    advice: "Remove the core and seeds, slice the flesh, and give a small amount only.",
    emergency: null,
    dosageNote: "A few slices; remove core and seeds.",
    traits: { colors: ["green","yellow"], shapes: ["round","chunk"], extras: ["pit","peel"] },
    sources: ["AKC-4"], checked: "2026-10-03"
  },
  {
    id: "oranges", name: "Oranges",
    nameZh: "橙子",
    aliases: ["orange", "oranges", "mandarin", "tangerine"],
    aliasesZh: ["橙子", "橙", "橘子", "柑橘", "砂糖橘"],
    category: "fruit", level: "moderation",
    reason: "Orange flesh is non-toxic in small amounts and provides vitamin C, but the essential oils in the peel and the acidity can irritate a dog's digestive system.",
    symptoms: "Stomach upset or diarrhea from the acid. Peel and essential oils can cause more severe digestive irritation.",
    advice: "Peel fully, remove all seeds, and give a small piece of flesh. Never feed the peel or essential oil.",
    emergency: null,
    dosageNote: "One or two small segments, peeled and seeded.",
    traits: { colors: ["orange","yellow"], shapes: ["round"], extras: ["peel","pit"] },
    sources: ["AKC-4"], checked: "2026-10-03"
  },
  {
    id: "cranberries", name: "Cranberries",
    nameZh: "蔓越莓",
    aliases: ["cranberry", "cranberries", "dried cranberries"],
    aliasesZh: ["蔓越莓", "蔓越莓干"],
    category: "fruit", level: "moderation",
    reason: "Cranberries are non-toxic in small amounts and contain antioxidants, but they are acidic and often sold sweetened or dried, which adds a lot of sugar.",
    symptoms: "Stomach upset from large amounts or from added sugar. Watch for added raisins in trail mixes.",
    advice: "Fresh or frozen plain cranberries in small amounts. If dried, choose no-sugar-added and give just a few.",
    emergency: null,
    dosageNote: "A few berries; check dried versions for added sugar.",
    traits: { colors: ["red"], shapes: ["small","round"], extras: ["snack"] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "cherries", name: "Cherries",
    nameZh: "樱桃",
    aliases: ["cherry", "cherries", "bing cherries"],
    aliasesZh: ["樱桃", "车厘子"],
    category: "fruit", level: "caution",
    reason: "The flesh of a cherry is non-toxic, but the pit, stem and leaves contain cyanide precursors. The pit is also a choking and obstruction hazard. Because dogs rarely eat cherries without the pit, the safest call is to avoid them entirely.",
    symptoms: "Choking or intestinal blockage from the pit; in large amounts cyanide toxicity (dilated pupils, difficulty breathing, red gums).",
    advice: "It is safest to skip cherries altogether. If you ever feed any, it must be pitted, stemmed and cut, and only a tiny amount.",
    emergency: null,
    dosageNote: "Avoid whole cherries — the pit is the main danger.",
    traits: { colors: ["red","black"], shapes: ["small","round","bunch"], extras: ["pit","snack"] },
    sources: ["AKC-4", "VET-6"], checked: "2026-10-03"
  },
  {
    id: "lemons-limes", name: "Lemons & Limes",
    nameZh: "柠檬与青柠",
    aliases: ["lemon", "lime", "lemons", "limes", "citrus peel", "citrus"],
    aliasesZh: ["柠檬", "青柠", "柠檬皮", "柑橘皮", "柑橘"],
    category: "fruit", level: "caution",
    reason: "Citrus fruits such as lemons and limes contain citric acid and essential oils (limonene, linalool) that can irritate and even poison dogs, especially the peel, seeds and leaves. The sour flesh is also unappealing and can cause stomach upset.",
    symptoms: "Vomiting, diarrhea, drooling, skin irritation; larger amounts of peel/oil: lethargy, weakness, tremors.",
    advice: "Do not feed lemons, limes, their peel, seeds or essential oils. A tiny lick of flesh is not an emergency but is not recommended.",
    emergency: null,
    dosageNote: "Avoid citrus peel and essential oils especially.",
    traits: { colors: ["yellow","green"], shapes: ["round"], extras: ["peel","pit"] },
    sources: ["ASPCA-1"], checked: "2026-10-03"
  },
  {
    id: "tomatoes", name: "Tomatoes",
    nameZh: "番茄（西红柿）",
    aliases: ["tomato", "tomatoes", "cherry tomato", "ripe tomato"],
    aliasesZh: ["番茄", "西红柿", "圣女果", "熟番茄"],
    category: "fruit", level: "caution",
    reason: "Ripe red tomato flesh is non-toxic in small amounts, but the green parts — stems, leaves and unripe green fruit — contain solanine and tomatine, which are toxic to dogs. Sources take a conservative view of tomato overall. (Sources differ: ASPCA lists the green parts as the concern; we take the more cautious overall rating.)",
    symptoms: "From green parts: lethargy, weakness, vomiting, diarrhea, tremors, abnormal heart rate. Ripe flesh: generally none in small amounts.",
    advice: "If feeding any, use only small amounts of fully ripe red flesh, no stem or leaves. Never give green tomatoes or tomato plant parts.",
    emergency: null,
    dosageNote: "Ripe flesh only, in small amounts; green parts are toxic.",
    traits: { colors: ["red"], shapes: ["round"], extras: ["peel"] },
    sources: ["AKC-3", "VET-6"], checked: "2026-10-03"
  },
  {
    id: "avocado", name: "Avocado",
    nameZh: "牛油果（鳄梨）",
    aliases: ["avocado", "guacamole", "avocado toast"],
    aliasesZh: ["牛油果", "鳄梨", "牛油果酱", "鳄梨酱"],
    category: "fruit", level: "caution",
    reason: "Sources differ on avocado. ASPCA notes that for dogs the main risks are the high fat content (pancreatitis) and the large pit (choking/obstruction), while persin — the toxin — mainly affects birds and horses. We take the conservative position: it is best to avoid avocado, though a small accidental amount usually causes only stomach upset.",
    symptoms: "Stomach upset, vomiting, diarrhea from the fat; the pit can cause choking or blockage. Large amounts of fat can trigger pancreatitis.",
    advice: "Avoid feeding avocado. Never give the pit, skin or leaves. Keep guacamole (which often has onion and garlic) away from your dog.",
    emergency: null,
    dosageNote: "High fat + pit hazard; ASPCA/AKC views differ — conservative rating applied.",
    traits: { colors: ["green","black"], shapes: ["chunk","round"], extras: ["peel","pit"] },
    sources: ["ASPCA-1", "VET-6"], checked: "2026-10-03"
  },

  /* ======================== Vegetables (17) ======================== */
  {
    id: "carrots", name: "Carrots",
    nameZh: "胡萝卜",
    aliases: ["carrot", "carrots", "baby carrots"],
    aliasesZh: ["胡萝卜", "胡萝卜条"],
    category: "vegetable", level: "safe",
    reason: "Carrots are safe and low in calories, high in fiber and beta-carotene. They make a great crunchy snack and are good for a dog's teeth.",
    symptoms: "None. Very large amounts may cause mild stomach upset.",
    advice: "Feed raw or cooked, plain. Cut into bite-sized pieces to prevent choking — especially for small dogs.",
    emergency: null,
    dosageNote: "A few pieces; a low-calorie treat.",
    traits: { colors: ["orange"], shapes: ["chunk"], extras: ["peel"] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "cucumbers", name: "Cucumbers",
    nameZh: "黄瓜",
    aliases: ["cucumber", "cucumbers", "pickles"],
    aliasesZh: ["黄瓜", "腌黄瓜", "酸黄瓜"],
    category: "vegetable", level: "safe",
    reason: "Cucumbers are safe, low in calories and mostly water — a good treat for overweight dogs. Note that pickles are high in salt and should not be fed.",
    symptoms: "None from fresh cucumber. Pickles: excess salt can cause vomiting, diarrhea and, in large amounts, sodium toxicity.",
    advice: "Feed fresh, washed cucumber slices, plain, in small amounts. Avoid pickles and any seasoned or creamy cucumber salad.",
    emergency: null,
    dosageNote: "A few slices; avoid pickled or salted versions.",
    traits: { colors: ["green"], shapes: ["chunk"], extras: ["peel"] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "green-beans", name: "Green Beans",
    nameZh: "四季豆（青豆角）",
    aliases: ["green bean", "green beans", "string beans", "snap beans"],
    aliasesZh: ["四季豆", "青豆角", "豆角", "青刀豆"],
    category: "vegetable", level: "safe",
    reason: "Plain green beans are safe and provide fiber and vitamins. They are low in calories and often recommended for weight management.",
    symptoms: "None in plain form. Too many can cause mild digestive upset.",
    advice: "Feed fresh, frozen or cooked plain green beans — no salt, butter, oil or onion/garlic seasoning.",
    emergency: null,
    dosageNote: "Several beans; plain, unseasoned only.",
    traits: { colors: ["green"], shapes: ["small","chunk"], extras: [] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "peas", name: "Peas",
    nameZh: "豌豆",
    aliases: ["pea", "peas", "snap peas", "green peas"],
    aliasesZh: ["豌豆", "青豆", "甜豆"],
    category: "vegetable", level: "safe",
    reason: "Peas are safe in moderation and contain vitamins A, B and K plus fiber. They are a common ingredient in dog food.",
    symptoms: "None in plain form. Very large amounts may cause gas or stomach upset.",
    advice: "Feed plain, cooked or frozen-thawed peas, without salt, butter or seasoning. Remove snap pea strings.",
    emergency: null,
    dosageNote: "A small handful; plain only.",
    traits: { colors: ["green"], shapes: ["small","round"], extras: [] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "pumpkin", name: "Pumpkin",
    nameZh: "南瓜",
    aliases: ["pumpkin", "pumpkin puree", "canned pumpkin"],
    aliasesZh: ["南瓜", "南瓜泥", "南瓜罐头"],
    category: "vegetable", level: "safe",
    reason: "Plain canned or cooked pumpkin is safe and is a well-known home remedy for mild digestive upset because of its fiber content. Pumpkin pie filling is different — it contains sugar and spices and must not be fed.",
    symptoms: "None from plain pumpkin. Pie filling can cause stomach upset and, if it contains nutmeg or xylitol, more serious problems.",
    advice: "Use 100% plain pumpkin puree (not pie filling). One to a few tablespoons depending on dog size. Good for constipation or mild diarrhea.",
    emergency: null,
    dosageNote: "1 tsp–2 tbsp plain puree; never pie filling.",
    traits: { colors: ["orange"], shapes: ["chunk","round"], extras: ["peel"] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "sweet-potato", name: "Sweet Potatoes",
    nameZh: "红薯（甘薯）",
    aliases: ["sweet potato", "sweet potatoes", "yam", "yams"],
    aliasesZh: ["红薯", "甘薯", "地瓜", "番薯"],
    category: "vegetable", level: "safe",
    reason: "Cooked, plain sweet potato is safe and rich in vitamins A, B6, C and fiber. Raw sweet potato is hard to digest and a choking hazard.",
    symptoms: "None from cooked plain sweet potato. Raw: choking risk. Overfeeding: stomach upset.",
    advice: "Feed cooked, peeled, plain sweet potato in small pieces. Never feed raw, and never feed sweetened casseroles with marshmallows or syrup.",
    emergency: null,
    dosageNote: "A few small pieces; cooked and plain only.",
    traits: { colors: ["orange","brown"], shapes: ["chunk"], extras: ["peel"] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "broccoli", name: "Broccoli",
    nameZh: "西兰花",
    aliases: ["broccoli", "broccoli florets", "broccoli stalks"],
    aliasesZh: ["西兰花", "西蓝花", "花椰菜"],
    category: "vegetable", level: "moderation",
    reason: "Broccoli is non-toxic and nutritious in small amounts, but it contains isothiocyanates which can irritate the stomach in larger quantities.",
    symptoms: "Gas, stomach upset or diarrhea if fed too much. The stalks can be a choking hazard if not cut small.",
    advice: "Feed small, cut-up florets or cooked plain broccoli — no more than about 10% of a dog's daily food. Never season with salt, butter or garlic.",
    emergency: null,
    dosageNote: "A couple of small florets; too much causes gas.",
    traits: { colors: ["green"], shapes: ["chunk","bunch"], extras: [] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "cauliflower", name: "Cauliflower",
    nameZh: "花椰菜（菜花）",
    aliases: ["cauliflower", "cauliflower florets"],
    aliasesZh: ["花椰菜", "菜花", "白花菜"],
    category: "vegetable", level: "moderation",
    reason: "Cauliflower is non-toxic in small amounts and a source of fiber and vitamin C, but the florets contain compounds that can cause gas.",
    symptoms: "Gas, bloating or mild stomach upset in larger amounts.",
    advice: "Feed plain, cooked (or raw) florets cut small, in moderation. No salt, butter, cheese sauce or seasoning.",
    emergency: null,
    dosageNote: "A few small florets; plain only.",
    traits: { colors: ["white"], shapes: ["chunk","bunch"], extras: [] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "celery", name: "Celery",
    nameZh: "芹菜",
    aliases: ["celery", "celery sticks"],
    aliasesZh: ["芹菜", "西芹"],
    category: "vegetable", level: "moderation",
    reason: "Celery is non-toxic and low in calories — a crunchy snack — but stringy stalks are a choking hazard and celery has little nutritional value.",
    symptoms: "Choking risk if fed in large, stringy pieces. Overfeeding may cause mild stomach upset.",
    advice: "Cut celery into small, bite-sized pieces and remove tough strings. Plain only — never celery with peanut butter containing xylitol or with cream cheese.",
    emergency: null,
    dosageNote: "Small cut pieces; the strings are the main choking risk.",
    traits: { colors: ["green"], shapes: ["flat","chunk"], extras: [] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "spinach", name: "Spinach",
    nameZh: "菠菜",
    aliases: ["spinach", "baby spinach"],
    aliasesZh: ["菠菜", "嫩菠菜"],
    category: "vegetable", level: "moderation",
    reason: "Spinach is not toxic but it is high in oxalates, which can lead to kidney problems in dogs with existing kidney disease. It is safe in very small amounts for healthy dogs. (Conservative view applied.)",
    symptoms: "Generally none in small amounts. Long-term large amounts: risk of oxalate-based kidney/bladder problems.",
    advice: "Feed only a small amount of plain, washed spinach, and skip it entirely for dogs with kidney or bladder issues.",
    emergency: null,
    dosageNote: "A leaf or two only; avoid with kidney disease.",
    traits: { colors: ["green"], shapes: ["flat"], extras: [] },
    sources: ["AKC-3", "VET-6"], checked: "2026-10-03"
  },
  {
    id: "kale", name: "Kale",
    nameZh: "羽衣甘蓝",
    aliases: ["kale", "curly kale"],
    aliasesZh: ["羽衣甘蓝", "卷叶甘蓝"],
    category: "vegetable", level: "caution",
    reason: "Kale is debated. It contains calcium oxalate and isothiocyanates; large or frequent amounts are linked to stomach irritation and, in susceptible dogs, kidney problems. We take the conservative position and advise skipping it or feeding only tiny amounts.",
    symptoms: "Stomach upset, gas; long-term heavy feeding theoretically linked to kidney issues.",
    advice: "Best to skip kale, or feed only a tiny amount, cooked plain and cut small, occasionally.",
    emergency: null,
    dosageNote: "Conservative rating — small amount or skip.",
    traits: { colors: ["green"], shapes: ["flat"], extras: [] },
    sources: ["VET-6"], checked: "2026-10-03"
  },
  {
    id: "cabbage", name: "Cabbage",
    nameZh: "卷心菜（包菜）",
    aliases: ["cabbage", "red cabbage", "green cabbage"],
    aliasesZh: ["卷心菜", "包菜", "圆白菜", "紫甘蓝", "高丽菜"],
    category: "vegetable", level: "moderation",
    reason: "Cabbage is non-toxic and provides fiber and vitamins, but it produces gas in many dogs when fed in larger amounts.",
    symptoms: "Gas, bloating, and sometimes loose stool if fed too much.",
    advice: "Feed a small amount of plain, cooked cabbage cut small. Avoid sauerkraut (salt) and coleslaw (may contain onion and dressing).",
    emergency: null,
    dosageNote: "A small amount; cabbage causes gas.",
    traits: { colors: ["green"], shapes: ["round","chunk"], extras: [] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "corn", name: "Corn",
    nameZh: "玉米",
    aliases: ["corn", "corn kernels", "sweet corn"],
    aliasesZh: ["玉米", "玉米粒", "甜玉米"],
    category: "vegetable", level: "moderation",
    reason: "Plain cooked corn kernels are non-toxic and digestible for most dogs. The cob, however, is extremely dangerous — it cannot be digested and causes intestinal obstruction, which can be fatal.",
    symptoms: "Kernels: usually none, but some dogs pass them undigested. Corn cob: vomiting, abdominal pain, constipation, obstruction — emergency.",
    advice: "Feed only plain corn kernels off the cob. NEVER give a corn cob. Avoid canned creamed corn (sugar, salt, butter) and popcorn with toppings.",
    emergency: "If your dog swallowed a corn cob, treat it as an emergency and contact your vet or ASPCA Poison Control (888) 426-4435 immediately — do NOT induce vomiting unless told to.",
    dosageNote: "Kernels only; the cob is a severe obstruction risk.",
    traits: { colors: ["yellow"], shapes: ["small","chunk","round"], extras: ["peel"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "potatoes", name: "Potatoes",
    nameZh: "土豆（马铃薯）",
    aliases: ["potato", "potatoes", "mashed potatoes", "baked potato"],
    aliasesZh: ["土豆", "马铃薯", "洋芋", "土豆泥", "烤土豆"],
    category: "vegetable", level: "moderation",
    reason: "Cooked, plain, peeled potatoes are non-toxic in small amounts. Raw potatoes, potato skin, sprouts and green potatoes contain solanine, which is toxic.",
    symptoms: "None from cooked plain potato. Green/raw/sprouted potato: vomiting, diarrhea, lethargy, weakness, tremors; large amounts can be serious.",
    advice: "Feed only fully cooked, peeled, plain potato in small amounts. Never feed green, raw or sprouted potatoes. Watch for added butter, salt, sour cream, onion or garlic.",
    emergency: null,
    dosageNote: "Small amounts of cooked plain potato only; solanine in green/raw parts.",
    traits: { colors: ["brown","yellow"], shapes: ["chunk","round"], extras: ["peel"] },
    sources: ["AKC-3", "VET-6"], checked: "2026-10-03"
  },
  {
    id: "asparagus", name: "Asparagus",
    nameZh: "芦笋",
    aliases: ["asparagus", "asparagus spears"],
    aliasesZh: ["芦笋"],
    category: "vegetable", level: "moderation",
    reason: "Asparagus is non-toxic to dogs but offers little nutritional value and tough stalks can be a choking hazard. Cooked plain asparagus in small amounts is safe.",
    symptoms: "Choking risk from tough stalks; some dogs develop stomach upset or smelly urine (harmless).",
    advice: "If feeding any, cook plain, cut into small pieces and remove tough ends. No salt, butter or seasoning.",
    emergency: null,
    dosageNote: "A few small cooked pieces; low nutritional value.",
    traits: { colors: ["green"], shapes: ["chunk"], extras: [] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "bell-peppers", name: "Bell Peppers",
    nameZh: "甜椒（灯笼椒）",
    aliases: ["bell pepper", "bell peppers", "red pepper", "green pepper", "sweet pepper"],
    aliasesZh: ["甜椒", "灯笼椒", "彩椒", "柿子椒", "青椒", "红椒"],
    category: "vegetable", level: "moderation",
    reason: "Bell peppers are low in calories and high in vitamin C, and are safe in moderation — but remove the seeds and stem, which can be difficult to digest.",
    symptoms: "Usually none. Seeds/stem: digestive upset. Large amounts: mild stomach upset.",
    advice: "Wash, remove stem and seeds, cut into small pieces; raw or cooked plain. Avoid spicy peppers (chili, jalapeño), which irritate the stomach.",
    emergency: null,
    dosageNote: "A few small pieces; no spicy varieties.",
    traits: { colors: ["red","green","yellow"], shapes: ["chunk"], extras: [] },
    sources: ["AKC-3"], checked: "2026-10-03"
  },
  {
    id: "mushrooms", name: "Mushrooms",
    nameZh: "蘑菇",
    aliases: ["mushroom", "mushrooms", "store-bought mushrooms", "wild mushrooms"],
    aliasesZh: ["蘑菇", "野蘑菇", "香菇", "超市蘑菇"],
    category: "vegetable", level: "caution",
    reason: "Only store-bought, plain cooked mushrooms are safe in small amounts. WILD mushrooms are a different story — many species are highly toxic and can be fatal. Because it is often impossible to identify a wild mushroom, the safe rule is: never let your dog eat wild mushrooms.",
    symptoms: "From wild mushrooms: vomiting, diarrhea, drooling, seizures, liver failure, death — varies by species. From plain culinary mushrooms: usually none.",
    advice: "Feed only plain, cooked, store-bought culinary mushrooms, in small amounts. Never allow eating wild mushrooms; if your dog ate one, treat it as an emergency.",
    emergency: "If your dog ate a wild mushroom, seek emergency veterinary care immediately — call your vet or ASPCA Poison Control (888) 426-4435. Do NOT induce vomiting unless a vet tells you to.",
    dosageNote: "Store-bought cooked only; wild mushrooms are potentially fatal.",
    traits: { colors: ["white","brown"], shapes: ["round","small"], extras: [] },
    sources: ["AKC-3", "VET-6"], checked: "2026-10-03"
  },

  /* ========================= Proteins (12) ========================= */
  {
    id: "chicken", name: "Cooked Chicken",
    nameZh: "熟鸡肉",
    aliases: ["chicken", "cooked chicken", "boiled chicken", "chicken breast", "grilled chicken"],
    aliasesZh: ["鸡肉", "熟鸡肉", "水煮鸡肉", "鸡胸肉", "烤鸡肉", "白斩鸡"],
    category: "protein", level: "safe",
    reason: "Fully cooked, plain chicken is safe and a lean source of protein. It is often used with rice as a bland diet for dogs with an upset stomach. Raw chicken carries Salmonella risk, and seasoned or bone-in chicken can be dangerous.",
    symptoms: "None from plain cooked chicken. Raw: risk of Salmonella. Bones: choking or obstruction. Seasonings (onion, garlic): toxic.",
    advice: "Cook thoroughly, remove skin and ALL bones, and do not add salt, oil, onion, garlic or seasoning. Plain breast or thigh meat only.",
    emergency: null,
    dosageNote: "Plain cooked meat only; no bones, skin or seasoning.",
    traits: { colors: ["brown","white"], shapes: ["chunk"], extras: ["processed"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "turkey", name: "Turkey",
    nameZh: "火鸡肉",
    aliases: ["turkey", "cooked turkey", "turkey breast"],
    aliasesZh: ["火鸡肉", "熟火鸡肉", "火鸡胸肉"],
    category: "protein", level: "safe",
    reason: "Plain cooked turkey breast is safe and high in lean protein. Turkey is dangerous when it is seasoned or contains bones, onion or garlic, which are common in holiday stuffing.",
    symptoms: "None from plain cooked turkey. Seasoned turkey or stuffing with onion/garlic: toxic (onion/garlic poisoning). Bones: choking/obstruction.",
    advice: "Feed plain, skinless, boneless, fully cooked turkey. Never feed seasoned, stuffed or gravy-covered turkey, and never the bones.",
    emergency: null,
    dosageNote: "Plain white meat only; watch for onion/garlic in stuffing.",
    traits: { colors: ["brown","white"], shapes: ["chunk","flat"], extras: ["processed"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "beef", name: "Cooked Beef",
    nameZh: "熟牛肉",
    aliases: ["beef", "cooked beef", "ground beef", "steak"],
    aliasesZh: ["牛肉", "熟牛肉", "牛肉末", "牛排"],
    category: "protein", level: "safe",
    reason: "Lean, fully cooked, plain beef is safe and a good source of protein and iron. The danger comes from fat, seasoning and bones.",
    symptoms: "None from plain lean cooked beef. High-fat or seasoned beef: stomach upset or pancreatitis; bones: choking/obstruction.",
    advice: "Feed small amounts of lean, fully cooked beef with no salt, oil or seasoning. Cut into small pieces. Never feed fatty cuts, bones or seasoned meat.",
    emergency: null,
    dosageNote: "Lean and plain; keep portions small.",
    traits: { colors: ["brown","red"], shapes: ["chunk"], extras: ["processed"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "pork", name: "Pork",
    nameZh: "猪肉",
    aliases: ["pork", "pork chop", "cooked pork"],
    aliasesZh: ["猪肉", "猪排", "熟猪肉"],
    category: "protein", level: "moderation",
    reason: "Lean, plain, fully cooked pork is non-toxic but higher in fat than chicken or turkey, so it should be given only in small amounts. Raw or undercooked pork and seasoned pork are risky.",
    symptoms: "None from small amounts of lean cooked pork. Fatty pork: stomach upset or pancreatitis. Seasoned/bacon/ham: salt and seasoning concerns.",
    advice: "Feed only small amounts of lean, fully cooked, unseasoned pork. Avoid bacon, sausage and cured pork, which are high in salt and fat.",
    emergency: null,
    dosageNote: "Small amounts; lean and plain only.",
    traits: { colors: ["brown"], shapes: ["chunk","flat"], extras: ["processed"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "eggs", name: "Eggs",
    nameZh: "鸡蛋",
    aliases: ["egg", "eggs", "scrambled eggs", "boiled eggs", "cooked egg"],
    aliasesZh: ["鸡蛋", "蛋", "炒蛋", "水煮蛋", "熟蛋"],
    category: "protein", level: "safe",
    reason: "Fully cooked eggs are safe and a great source of protein and vitamins. Raw eggs carry Salmonella risk and raw egg white contains avidin, which interferes with biotin absorption.",
    symptoms: "None from cooked eggs. Raw eggs: Salmonella risk; long-term raw egg white can cause biotin deficiency (poor coat, skin problems).",
    advice: "Always feed fully cooked eggs — boiled, scrambled (no butter, salt or milk) or poached plain. One egg is plenty for a medium dog.",
    emergency: null,
    dosageNote: "One cooked egg; never raw.",
    traits: { colors: ["white","yellow"], shapes: ["round"], extras: ["peel"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "fish", name: "Fish",
    nameZh: "鱼肉",
    aliases: ["fish", "white fish", "cooked fish", "cod"],
    aliasesZh: ["鱼肉", "白肉鱼", "熟鱼", "鳕鱼"],
    category: "protein", level: "safe",
    reason: "Fully cooked, plain, boneless white fish is safe and a good lean protein source. Raw fish carries parasite risk, and fish should not make up too much of the diet.",
    symptoms: "None from plain cooked fish. Raw fish: parasite and bacteria risk. Bones: choking.",
    advice: "Feed fully cooked, plain, boneless fish with no seasoning. Limit to about twice a week. Never feed raw or smoked fish.",
    emergency: null,
    dosageNote: "Up to ~2 servings per week; fully cooked, boneless.",
    traits: { colors: ["white","orange"], shapes: ["flat","chunk"], extras: ["processed"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "salmon", name: "Salmon",
    nameZh: "三文鱼（鲑鱼）",
    aliases: ["salmon", "cooked salmon", "wild salmon"],
    aliasesZh: ["三文鱼", "鲑鱼", "熟三文鱼", "野生三文鱼"],
    category: "protein", level: "safe",
    reason: "Fully cooked salmon is safe and rich in omega-3 fatty acids, which support the coat and skin. RAW or undercooked salmon, however, can carry a parasite (Neorickettsia) that causes salmon poisoning disease, which can be fatal.",
    symptoms: "None from cooked salmon. Raw salmon: salmon poisoning — vomiting, diarrhea, fever, lethargy, enlarged lymph nodes, can be fatal.",
    advice: "Only ever feed fully cooked, plain, boneless salmon. Never feed raw, smoked, cured or gravlax salmon.",
    emergency: null,
    dosageNote: "Cooked only; raw salmon can be fatal (salmon poisoning).",
    traits: { colors: ["orange","red"], shapes: ["chunk","flat"], extras: ["processed"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "tuna", name: "Tuna",
    nameZh: "金枪鱼",
    aliases: ["tuna", "canned tuna", "tuna fish"],
    aliasesZh: ["金枪鱼", "吞拿鱼", "金枪鱼罐头"],
    category: "protein", level: "moderation",
    reason: "Plain tuna in water is non-toxic in small amounts, but it should be limited because of mercury and sodium content, and tuna packed in oil adds fat and calories.",
    symptoms: "None in small amounts. Large or frequent amounts: mercury accumulation risk; salted/oiled versions cause stomach upset.",
    advice: "If feeding any, choose tuna in water with no added salt, and give only a small amount occasionally. Never make tuna a regular part of the diet.",
    emergency: null,
    dosageNote: "Small amounts occasionally; mercury/sodium limits apply.",
    traits: { colors: ["brown","white"], shapes: ["chunk","small"], extras: ["processed"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "shrimp", name: "Shrimp",
    nameZh: "虾",
    aliases: ["shrimp", "prawns", "prawn"],
    aliasesZh: ["虾", "虾仁", "大虾", "明虾"],
    category: "protein", level: "moderation",
    reason: "Cooked, plain shrimp is non-toxic in small amounts and high in protein, but it is also high in cholesterol and sodium (especially if salted or fried).",
    symptoms: "None in small amounts. Too much or fried/salted shrimp: stomach upset, excess sodium and fat.",
    advice: "Feed fully cooked, peeled, deveined, unsalted shrimp with no oil or seasoning. Remove the shell, tail, legs and head, and cut into small pieces.",
    emergency: null,
    dosageNote: "One or two small peeled shrimp; fully cooked, plain only.",
    traits: { colors: ["orange","white"], shapes: ["small","chunk"], extras: ["peel","processed"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "ham", name: "Ham",
    nameZh: "火腿",
    aliases: ["ham", "sliced ham", "deli ham"],
    aliasesZh: ["火腿", "火腿片", "午餐肉"],
    category: "protein", level: "moderation",
    reason: "Ham is non-toxic but is very high in sodium and fat, and is usually cured with salt and sometimes sugar. It should only ever be an occasional tiny treat, never for dogs with heart or kidney issues.",
    symptoms: "Stomach upset; excess sodium can cause excessive thirst, vomiting, diarrhea and, in large amounts, sodium toxicity (tremors, seizures).",
    advice: "If you feed any, plain lean ham in a tiny piece only, rarely. Never feed glazed, honey-cured or heavily salted ham, and never the ham bone.",
    emergency: null,
    dosageNote: "Tiny piece, rare treat; very high in salt and fat.",
    traits: { colors: ["brown","red"], shapes: ["flat"], extras: ["processed"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "raw-meat", name: "Raw Meat",
    nameZh: "生肉",
    aliases: ["raw meat", "raw diet", "raw chicken", "raw beef"],
    aliasesZh: ["生肉", "生食", "生鸡肉", "生牛肉"],
    category: "protein", level: "caution",
    reason: "Raw meat can carry Salmonella, E. coli and other bacteria that pose a risk to both your dog and the people handling it. There is also an increased risk of spreading infection to vulnerable humans in the household.",
    symptoms: "Salmonella/E. coli: vomiting, diarrhea (sometimes bloody), fever, lethargy; can be serious in puppies, seniors and immunocompromised dogs (and people).",
    advice: "The safest choice is to avoid raw meat. If a raw diet is used, follow strict hygiene: freeze, refrigerate, sanitize surfaces, and consult your vet.",
    emergency: null,
    dosageNote: "Bacterial risk to dog and household; avoid or handle with strict hygiene.",
    traits: { colors: ["red","brown"], shapes: ["chunk"], extras: ["processed"] },
    sources: ["ASPCA-1"], checked: "2026-10-03"
  },
  {
    id: "bones", name: "Bones",
    nameZh: "骨头",
    aliases: ["bone", "bones", "cooked bones", "chicken bones", "bone"],
    aliasesZh: ["骨头", "鸡骨头", "熟骨头", "骨"],
    category: "protein", level: "caution",
    reason: "Cooked bones (especially chicken and turkey bones) become brittle and splinter, and can cause choking, mouth and throat injuries, intestinal punctures and obstruction. Raw bones carry bacterial risk and can also break teeth.",
    symptoms: "Choking, gagging, drooling, mouth bleeding, vomiting, abdominal pain, constipation, bloody stool — signs of injury or obstruction.",
    advice: "Do not feed bones. Keep bones away from your dog and secure the trash. Ask your vet about safer chew alternatives.",
    emergency: "If your dog swallowed a bone, or is choking, gagging or in pain, contact your vet or an emergency clinic immediately. ASPCA Poison Control (888) 426-4435 can advise on toxicities; for a suspected obstruction, go to the vet.",
    dosageNote: "Cooked bones are the most dangerous; avoid all bones.",
    traits: { colors: ["white","brown"], shapes: ["chunk"], extras: [] },
    sources: ["ASPCA-1"], checked: "2026-10-03"
  },

  /* ======================== Dairy & Eggs (4) ======================== */
  {
    id: "milk", name: "Milk",
    nameZh: "牛奶",
    aliases: ["milk", "cow milk", "whole milk"],
    aliasesZh: ["牛奶", "全脂牛奶", "鲜奶"],
    category: "dairy", level: "moderation",
    reason: "Milk is not toxic, but most adult dogs are lactose intolerant — they do not produce enough lactase to digest milk sugar, which can cause digestive problems. A small amount is usually fine for dogs without sensitivity.",
    symptoms: "Gas, bloating, diarrhea, occasional vomiting within hours — especially after a large amount or in lactose-intolerant dogs.",
    advice: "If your dog tolerates it, limit milk to a small amount. Watch for digestive upset. For lactose-intolerant dogs, skip milk entirely. Always avoid flavored, sweetened or chocolate milk.",
    emergency: null,
    dosageNote: "Small amount only; many adult dogs are lactose intolerant.",
    traits: { colors: ["white"], shapes: ["liquid"], extras: [] },
    sources: ["ASPCA-1", "AKC-2"], checked: "2026-10-03"
  },
  {
    id: "cheese", name: "Cheese",
    nameZh: "奶酪（芝士）",
    aliases: ["cheese", "cheddar", "cottage cheese", "mozzarella"],
    aliasesZh: ["奶酪", "芝士", "切达奶酪", "马苏里拉", "干酪"],
    category: "dairy", level: "moderation",
    reason: "Cheese is non-toxic and a good source of protein and calcium, but it is high in fat and salt, and contains lactose. Low-fat cheeses like cottage cheese are the better choice, and lactose-intolerant dogs should have none.",
    symptoms: "Gas, diarrhea or vomiting in lactose-intolerant dogs; high-fat cheese can contribute to pancreatitis or weight gain.",
    advice: "Feed small amounts of low-fat, plain cheese (e.g. cottage cheese, part-skim mozzarella). Avoid processed cheese, blue cheese and any cheese with herbs, garlic or onion.",
    emergency: null,
    dosageNote: "Small piece; low-fat varieties better; mind the lactose.",
    traits: { colors: ["yellow","white"], shapes: ["chunk","flat"], extras: ["processed"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "yogurt", name: "Yogurt",
    nameZh: "酸奶",
    aliases: ["yogurt", "yoghurt", "plain yogurt", "greek yogurt"],
    aliasesZh: ["酸奶", "原味酸奶", "希腊酸奶"],
    category: "dairy", level: "moderation",
    reason: "Plain, unsweetened yogurt is non-toxic and can be a source of protein, calcium and probiotics. Flavored or low-fat yogurt often contains added sugar and artificial sweeteners — some of which (xylitol) are extremely toxic to dogs.",
    symptoms: "Digestive upset in lactose-intolerant dogs. If the yogurt contains xylitol: vomiting, weakness, incoordination, seizures, liver damage.",
    advice: "Feed only plain, unsweetened yogurt with NO xylitol or artificial sweeteners, and check the label. Small amounts only.",
    emergency: "If the yogurt contained xylitol, contact your vet or ASPCA Poison Control (888) 426-4435 immediately.",
    dosageNote: "Plain, unsweetened only; check for xylitol on the label.",
    traits: { colors: ["white"], shapes: ["liquid"], extras: ["processed"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "ice-cream", name: "Ice Cream",
    nameZh: "冰淇淋",
    aliases: ["ice cream", "icecream", "gelato"],
    aliasesZh: ["冰淇淋", "雪糕", "意式冰淇淋"],
    category: "dairy", level: "caution",
    reason: "Ice cream combines several risks: sugar, lactose (which most dogs cannot digest) and fat. Some flavors also contain chocolate, raisins or xylitol. It is not recommended for dogs.",
    symptoms: "Stomach upset, gas, diarrhea, vomiting. Chocolate flavors add theobromine toxicity; xylitol-containing versions are severely toxic.",
    advice: "Do not feed ice cream. For a cold treat, freeze plain fruit like banana or watermelon, or use dog-specific frozen treats.",
    emergency: null,
    dosageNote: "Sugar + lactose + fat + possible chocolate/xylitol; avoid.",
    traits: { colors: ["white","brown"], shapes: ["liquid","round"], extras: ["processed","snack"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },

  /* ====================== Grains & Staples (7) ====================== */
  {
    id: "bread", name: "Bread",
    nameZh: "面包",
    aliases: ["bread", "toast", "white bread", "slice of bread"],
    aliasesZh: ["面包", "吐司", "白面包", "面包片"],
    category: "grain", level: "moderation",
    reason: "Plain bread is non-toxic in small amounts but has little nutritional value and is mostly empty calories. Bread is dangerous when it contains raisins, xylitol, nuts or other toxic additions — always read the label.",
    symptoms: "None from plain bread in small amounts. Raisin bread: grape/raisin toxicity. Xylitol bread: severe hypoglycemia and liver failure.",
    advice: "A small piece of plain bread is fine as an occasional treat. NEVER feed bread containing raisins, currants, xylitol or chocolate.",
    emergency: null,
    dosageNote: "Small plain piece only; check for raisins/xylitol.",
    traits: { colors: ["brown","white"], shapes: ["flat"], extras: ["processed"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "rice", name: "Rice",
    nameZh: "米饭",
    aliases: ["rice", "white rice", "boiled rice", "brown rice"],
    aliasesZh: ["米饭", "白米饭", "白米", "糙米"],
    category: "grain", level: "safe",
    reason: "Plain cooked white rice is safe and easily digestible, and is commonly used with boiled chicken as a bland diet for dogs recovering from stomach upset.",
    symptoms: "None. Very large amounts may cause gas or contribute to weight gain.",
    advice: "Feed plain, fully cooked white or brown rice with no butter, oil, salt or seasoning. Portion to your dog's size.",
    emergency: null,
    dosageNote: "Plain cooked rice; often used in bland diets.",
    traits: { colors: ["white"], shapes: ["small"], extras: ["processed"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "oatmeal", name: "Oatmeal",
    nameZh: "燕麦",
    aliases: ["oatmeal", "oats", "rolled oats", "porridge"],
    aliasesZh: ["燕麦", "燕麦片", "燕麦粥"],
    category: "grain", level: "safe",
    reason: "Plain cooked oatmeal is safe and a good source of soluble fiber, which can support digestive health. It must be plain — no sugar, milk or flavorings.",
    symptoms: "None from plain oatmeal. Sweetened or flavored oatmeal may cause stomach upset; some instant packets contain xylitol.",
    advice: "Cook plain oatmeal with water, no sugar, salt, butter or milk. Cool before feeding and give a small portion.",
    emergency: null,
    dosageNote: "Small portion, plain, cooked with water.",
    traits: { colors: ["brown","white"], shapes: ["small"], extras: ["processed"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "pasta", name: "Pasta",
    nameZh: "意面（意大利面）",
    aliases: ["pasta", "noodles", "spaghetti", "macaroni"],
    aliasesZh: ["意面", "意大利面", "面条", "通心粉", "意粉"],
    category: "grain", level: "moderation",
    reason: "Plain cooked pasta is non-toxic in small amounts but is mostly empty calories. Sauces and toppings are where the danger lies — many contain onion, garlic, cheese or added salt.",
    symptoms: "None from plain small amounts. Sauced pasta with onion/garlic: allium toxicity. Large amounts: stomach upset, weight gain.",
    advice: "Feed a small amount of plain cooked pasta with no sauce, salt, oil or butter. Never feed pasta with onion, garlic or cheesy cream sauces.",
    emergency: null,
    dosageNote: "Small plain portion; no sauce or seasoning.",
    traits: { colors: ["yellow","brown"], shapes: ["small"], extras: ["processed"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "quinoa", name: "Quinoa",
    nameZh: "藜麦",
    aliases: ["quinoa", "cooked quinoa"],
    aliasesZh: ["藜麦", "熟藜麦"],
    category: "grain", level: "safe",
    reason: "Plain cooked quinoa is safe and provides a complete protein plus carbohydrates, vitamins and minerals. It is sometimes used as a grain alternative in homemade dog diets.",
    symptoms: "None in plain form. Very large amounts may cause mild digestive upset.",
    advice: "Feed only plain, fully cooked quinoa with no salt, oil or seasoning. Rinse before cooking to remove bitter saponins.",
    emergency: null,
    dosageNote: "Small plain cooked portion; rinse before cooking.",
    traits: { colors: ["white","brown"], shapes: ["small"], extras: [] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "popcorn", name: "Popcorn",
    nameZh: "爆米花",
    aliases: ["popcorn", "popped corn"],
    aliasesZh: ["爆米花"],
    category: "grain", level: "moderation",
    reason: "Plain, fully popped, unsalted popcorn is non-toxic in small amounts. The dangers are butter, salt and toppings, plus unpopped kernels that can crack teeth or cause choking.",
    symptoms: "None from plain popped popcorn. Unpopped kernels: choking or tooth damage. Butter/salt toppings: digestive upset, pancreatitis, salt toxicity.",
    advice: "Feed a small amount of plain, air-popped popcorn with no butter or salt, and remove all unpopped kernels.",
    emergency: null,
    dosageNote: "A small handful; plain, no butter/salt, remove unpopped kernels.",
    traits: { colors: ["white","yellow"], shapes: ["small"], extras: ["snack","processed"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "raw-dough", name: "Raw Bread Dough",
    nameZh: "生面团",
    aliases: ["raw dough", "raw bread dough", "yeast dough", "bread dough"],
    aliasesZh: ["生面团", "面团", "发酵面团", "酵母面团"],
    category: "grain", level: "severe",
    reason: "Raw yeast dough is life-threatening. In a dog's warm stomach the yeast ferments, producing alcohol (ethanol) and large amounts of gas. This can cause alcohol poisoning and rapid stomach bloating that may twist the stomach (gastric dilatation-volvulus), which is fatal without emergency surgery.",
    reasonZh: "生酵母面团可危及生命。在狗狗温暖的胃里，酵母会发酵，产生酒精（乙醇）和大量气体。这会导致酒精中毒，并可能引起胃部迅速膨胀甚至扭转（胃扩张-扭转），若不紧急手术会致命。",
    symptoms: "Bloated, painful abdomen, retching without vomiting, weakness, incoordination, disorientation, collapsed/alcohol poisoning, coma or death.",
    symptomsZh: "腹部膨胀疼痛、干呕但吐不出、虚弱、行动失调、神志不清、虚脱/酒精中毒、昏迷甚至死亡。",
    advice: "Never let your dog eat raw dough. Keep dough out of reach while it rises and secure the trash.",
    adviceZh: "绝不要让狗狗吃生面团。面团发酵时请放到狗狗够不到的地方，并固定好垃圾桶。",
    emergency: "This is a life-threatening emergency. Take your dog to a veterinarian immediately — call your vet or ASPCA Poison Control (888) 426-4435 on the way. Do NOT induce vomiting unless a vet tells you to.",
    emergencyZh: "这是危及生命的紧急情况。请立即带狗狗去看兽医——途中致电您的兽医或 ASPCA 中毒控制中心 (888) 426-4435。除非兽医指示，否则不要催吐。",
    dosageNoteZh: "任何量都可能危险；酒精 + 胀气 + 胃扭转（GDV）风险。",
    dosageNote: "Any amount can be dangerous; alcohol + gas bloat + GDV risk.",
    traits: { colors: ["white","brown"], shapes: ["chunk"], extras: ["processed"] },
    sources: ["ASPCA-1"], checked: "2026-10-03"
  },

  /* ======================== Nuts & Seeds (7) ======================== */
  {
    id: "macadamia-nuts", name: "Macadamia Nuts",
    nameZh: "夏威夷果（澳洲坚果）",
    aliases: ["macadamia", "macadamia nuts", "macadamia nut"],
    aliasesZh: ["夏威夷果", "澳洲坚果", "夏威夷坚果"],
    category: "nut", level: "toxic",
    reason: "Macadamia nuts are toxic to dogs and are one of the most dangerous nuts. The exact toxin is unknown, but even a small number of nuts can cause serious neurological symptoms, usually within 12 hours.",
    reasonZh: "夏威夷果对狗有毒，是最危险的坚果之一。确切的毒素尚不明确，但即使少量也可能引起严重的神经系统症状，通常在 12 小时内出现。",
    symptoms: "Weakness, especially in the hind legs; tremors; wobbliness; vomiting; fever (hyperthermia); lethargy; in severe cases, difficulty standing. Signs typically appear within 12 hours.",
    symptomsZh: "虚弱（尤其后腿无力）、震颤、站立不稳、呕吐、发热（体温过高）、嗜睡；严重时无法站立。症状通常在 12 小时内出现。",
    advice: "Never feed macadamia nuts. Keep them out of reach and check cookie, candy and trail-mix ingredients. Some dogs also react badly to the high fat.",
    adviceZh: "绝不要喂夏威夷果。请放到狗狗够不到的地方，并检查饼干、糖果和什锦坚果的成分。有些狗还会因高脂肪而出现不良反应。",
    emergency: "Contact your vet or ASPCA Poison Control (888) 426-4435 immediately if your dog ate macadamia nuts. Do NOT induce vomiting unless a vet tells you to.",
    emergencyZh: "如果狗狗吃了夏威夷果，请立即联系您的兽医或 ASPCA 中毒控制中心 (888) 426-4435。除非兽医指示，否则不要催吐。",
    dosageNoteZh: "即使少量也可能中毒——误食需高度重视。",
    dosageNote: "Even a small amount can cause toxicity — treat ingestion seriously.",
    traits: { colors: ["white","brown"], shapes: ["round","small"], extras: ["peel","snack"] },
    sources: ["ASPCA-1", "AKC-2"], checked: "2026-10-03"
  },
  {
    id: "almonds", name: "Almonds",
    nameZh: "杏仁",
    // 别名收窄：删除 "salted almonds" —— 它是 "salt" 的超集候选，曾导致
    // 输入通用词 salt 被误判为 Almonds（CAUTION）。盐焗相关信息在 reason/advice/dosageNote 已有说明。
    aliases: ["almond", "almonds"],
    aliasesZh: ["杏仁", "扁桃仁"],
    category: "nut", level: "caution",
    reason: "Almonds are not highly toxic like macadamias, but they are a poor choice for dogs: whole nuts are a choking and obstruction risk, they can scratch the mouth and throat, salted almonds add excess sodium, and their high fat can trigger pancreatitis.",
    symptoms: "Choking, gagging, mouth/throat irritation, stomach upset, diarrhea; high fat can lead to pancreatitis.",
    advice: "It is best not to feed almonds. If your dog eats one or two plain almonds by accident, it is usually not serious — but watch for choking or stomach upset.",
    emergency: null,
    dosageNote: "Avoid whole and salted almonds; obstruction and fat risk.",
    traits: { colors: ["brown"], shapes: ["small"], extras: ["peel","snack"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "walnuts", name: "Walnuts",
    nameZh: "核桃",
    aliases: ["walnut", "walnuts", "black walnuts"],
    aliasesZh: ["核桃", "黑核桃"],
    category: "nut", level: "caution",
    reason: "Regular walnuts are non-toxic but high in fat and prone to mold, which can produce tremorgenic mycotoxins. BLACK walnuts are explicitly toxic to dogs. Because the difference is hard to spot, walnuts should be avoided.",
    symptoms: "From moldy walnuts: tremors, incoordination, seizures, fever. High fat: stomach upset or pancreatitis. Black walnuts: more serious neurological signs.",
    advice: "Do not feed walnuts, especially black walnuts. Keep all nuts out of reach and discard moldy ones.",
    emergency: null,
    dosageNote: "Moldy and black walnuts are the main dangers; avoid all walnuts.",
    traits: { colors: ["brown"], shapes: ["round","chunk"], extras: ["peel","snack"] },
    sources: ["ASPCA-1", "VET-6"], checked: "2026-10-03"
  },
  {
    id: "pecans", name: "Pecans",
    nameZh: "碧根果（山核桃）",
    aliases: ["pecan", "pecans", "pecan nuts"],
    aliasesZh: ["碧根果", "山核桃", "美国山核桃"],
    category: "nut", level: "caution",
    reason: "Pecans are high in fat — which can cause digestive upset or pancreatitis — and can become contaminated with mold that produces tremorgenic mycotoxins. They are not recommended for dogs.",
    symptoms: "Stomach upset, vomiting, diarrhea; possible pancreatitis; if moldy, tremors and incoordination.",
    advice: "Avoid feeding pecans. Keep them and pecan-containing pies and cookies out of reach.",
    emergency: null,
    dosageNote: "High fat + mold risk; avoid.",
    traits: { colors: ["brown"], shapes: ["round","small"], extras: ["peel","snack"] },
    sources: ["ASPCA-1"], checked: "2026-10-03"
  },
  {
    id: "peanuts", name: "Peanuts",
    nameZh: "花生",
    aliases: ["peanut", "peanuts", "unsalted peanuts", "roasted peanuts"],
    aliasesZh: ["花生", "花生米", "无盐花生", "烤花生"],
    category: "nut", level: "moderation",
    reason: "Plain, unsalted peanuts are non-toxic in small amounts and can be a source of protein and healthy fats. They are calorie-dense, and salted or flavored versions should be avoided. (Peanuts are not true nuts but legumes.)",
    symptoms: "None in small amounts. Too many: stomach upset or weight gain. Salted peanuts: excess sodium.",
    advice: "Feed only a few plain, unsalted, shelled peanuts. Never feed salted, honey-roasted or flavored peanuts.",
    emergency: null,
    dosageNote: "A few plain unsalted peanuts; high fat — small amounts.",
    traits: { colors: ["brown"], shapes: ["small"], extras: ["peel","snack"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "cashews", name: "Cashews",
    nameZh: "腰果",
    aliases: ["cashew", "cashews", "roasted cashews"],
    aliasesZh: ["腰果", "烤腰果"],
    category: "nut", level: "moderation",
    reason: "Plain, unsalted cashews are non-toxic in small amounts, but they are high in fat and calories, and salted or roasted-with-oil versions add sodium and fat that can upset a dog's stomach.",
    symptoms: "None in small amounts. Too many: stomach upset, weight gain, and their high fat can contribute to pancreatitis.",
    advice: "Feed only a few plain, unsalted cashews as a rare treat. Avoid salted, flavored or chocolate-covered cashews.",
    emergency: null,
    dosageNote: "A few plain unsalted cashews; high fat.",
    traits: { colors: ["white"], shapes: ["small"], extras: ["peel","snack"] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "peanut-butter", name: "Peanut Butter",
    nameZh: "花生酱",
    aliases: ["peanut butter", "peanutbutter", "pb", "crunchy peanut butter"],
    aliasesZh: ["花生酱", "花生抹酱", "颗粒花生酱"],
    category: "nut", level: "moderation",
    reason: "Plain, unsalted peanut butter is a good protein source in small amounts. DANGER: some brands — especially low-sugar or 'healthy' versions — contain xylitol, an artificial sweetener that is extremely toxic to dogs even in tiny amounts.",
    symptoms: "If xylitol is present: vomiting, weakness, lack of coordination, seizures (hypoglycemia), and liver damage can follow within 12–24 hours. Plain peanut butter: none in small amounts; too much can cause stomach upset or weight gain.",
    advice: "Check the label carefully — only feed peanut butter with NO xylitol (also called birch sugar) and no added salt, sugar or chocolate. Small amounts only.",
    emergency: "If your dog ate peanut butter containing xylitol, contact your vet or ASPCA Poison Control (888) 426-4435 immediately.",
    dosageNote: "A treat, not a meal — high in fat. Always check for xylitol.",
    traits: { colors: ["brown"], shapes: ["liquid"], extras: ["processed","snack"] },
    sources: ["AKC-2", "ASPCA-1"], checked: "2026-10-03"
  },

  /* ======================= Drinks & Sweets (7) ======================= */
  {
    id: "coffee", name: "Coffee",
    nameZh: "咖啡",
    aliases: ["coffee", "espresso", "coffee grounds", "coffee beans", "latte"],
    aliasesZh: ["咖啡", "浓缩咖啡", "咖啡渣", "咖啡豆", "拿铁"],
    category: "drink", level: "toxic",
    reason: "Coffee contains caffeine, a methylxanthine that stimulates the nervous system and heart. Dogs are far more sensitive to caffeine than humans; even a small amount of coffee, grounds or beans can cause serious toxicity.",
    reasonZh: "咖啡含有咖啡因，这是一种刺激神经和心脏的甲基黄嘌呤。狗对咖啡因远比人类敏感；即使少量咖啡、咖啡渣或咖啡豆也可能引起严重中毒。",
    symptoms: "Restlessness, hyperactivity, pacing, vomiting, tremors, elevated heart rate, abnormal heart rhythm, seizures; severe cases can be fatal.",
    symptomsZh: "坐立不安、过度活跃、来回踱步、呕吐、震颤、心率加快、心律失常、癫痫发作；严重时可致命。",
    advice: "Never give coffee, espresso, coffee beans or used grounds to a dog. Secure the trash and compost, and keep coffee drinks out of reach.",
    adviceZh: "绝不要给狗喝咖啡、浓缩咖啡，也不要喂咖啡豆或用过的咖啡渣。请固定好垃圾桶和堆肥，把咖啡饮品放到狗狗够不到的地方。",
    emergency: "Contact your vet or ASPCA Poison Control (888) 426-4435 immediately if your dog drank coffee or ate grounds/beans. Do NOT induce vomiting unless a vet tells you to.",
    emergencyZh: "如果狗狗喝了咖啡或吃了咖啡渣/咖啡豆，请立即联系您的兽医或 ASPCA 中毒控制中心 (888) 426-4435。除非兽医指示，否则不要催吐。",
    dosageNoteZh: "任何咖啡因摄入都需警惕；咖啡渣浓度尤其高。",
    dosageNote: "Any caffeine exposure is a concern; grounds are especially concentrated.",
    traits: { colors: ["brown","black"], shapes: ["liquid"], extras: ["processed"] },
    sources: ["ASPCA-1"], checked: "2026-10-03"
  },
  {
    id: "tea", name: "Tea",
    nameZh: "茶",
    aliases: ["tea", "green tea", "tea bags", "black tea"],
    aliasesZh: ["茶", "绿茶", "茶包", "红茶"],
    category: "drink", level: "toxic",
    reason: "Tea contains caffeine (a methylxanthine), and teas with added ingredients may contain additional concerns. Consuming tea bags or loose tea, which are concentrated, is more dangerous than a small sip of diluted tea.",
    reasonZh: "茶含有咖啡因（一种甲基黄嘌呤），添加了其他成分的茶可能还有额外隐患。吃茶包或散茶（浓度高）比小口喝淡茶更危险。",
    symptoms: "Restlessness, hyperactivity, vomiting, tremors, rapid or abnormal heart rate, seizures in severe cases.",
    symptomsZh: "坐立不安、过度活跃、呕吐、震颤、心率加快或心律失常，严重时癫痫发作。",
    advice: "Do not give tea to dogs. Keep tea bags, especially used ones, out of reach — dogs are often attracted to them.",
    adviceZh: "不要给狗喝茶。把茶包（尤其是用过的）放到够不到的地方——狗常常被它们吸引。",
    emergency: "If your dog ate tea or tea bags, contact your vet or ASPCA Poison Control (888) 426-4435. Do NOT induce vomiting unless a vet tells you to.",
    emergencyZh: "如果狗狗吃了茶或茶包，请联系您的兽医或 ASPCA 中毒控制中心 (888) 426-4435。除非兽医指示，否则不要催吐。",
    dosageNoteZh: "含咖啡因；茶包/散茶浓度更高。",
    dosageNote: "Caffeine content; tea bags/loose tea are more concentrated.",
    traits: { colors: ["brown","black"], shapes: ["liquid"], extras: ["processed"] },
    sources: ["ASPCA-1"], checked: "2026-10-03"
  },
  {
    id: "energy-drinks", name: "Energy Drinks",
    nameZh: "能量饮料",
    aliases: ["energy drink", "energy drinks", "red bull", "monster", "rockstar"],
    aliasesZh: ["能量饮料", "功能饮料", "红牛"],
    category: "drink", level: "toxic",
    reason: "Energy drinks contain high levels of caffeine plus sugar, and some contain xylitol or other additives. The combination makes them dangerous — caffeine toxicity plus potential sweetener toxicity.",
    reasonZh: "能量饮料含有大量咖啡因和糖，有些还含木糖醇或其他添加剂。这种组合使其很危险——既是咖啡因中毒，又可能叠加甜味剂中毒。",
    symptoms: "Hyperactivity, restlessness, vomiting, tremors, rapid/irregular heart rate, seizures; if xylitol is present, hypoglycemia and liver damage.",
    symptomsZh: "过度活跃、坐立不安、呕吐、震颤、心率过快/心律失常、癫痫发作；若含木糖醇，还会低血糖和肝损伤。",
    advice: "Never give energy drinks to dogs. Keep cans and bottles out of reach, and secure the trash.",
    adviceZh: "绝不要给狗喝能量饮料。把易拉罐和瓶子放到够不到的地方，并固定好垃圾桶。",
    emergency: "Contact your vet or ASPCA Poison Control (888) 426-4435 immediately. Do NOT induce vomiting unless a vet tells you to.",
    emergencyZh: "请立即联系您的兽医或 ASPCA 中毒控制中心 (888) 426-4435。除非兽医指示，否则不要催吐。",
    dosageNoteZh: "高咖啡因 + 高糖 + 可能含木糖醇。",
    dosageNote: "High caffeine + sugar + possible xylitol.",
    traits: { colors: ["yellow","black"], shapes: ["liquid"], extras: ["processed"] },
    sources: ["ASPCA-1"], checked: "2026-10-03"
  },
  {
    id: "alcohol", name: "Alcohol",
    nameZh: "酒精",
    aliases: ["alcohol", "beer", "wine", "liquor", "vodka", "whiskey"],
    aliasesZh: ["酒精", "啤酒", "葡萄酒", "白酒", "烈酒", "威士忌", "伏特加"],
    category: "drink", level: "severe",
    reason: "Alcohol (ethanol) is highly toxic to dogs and is absorbed quickly. Dogs are much smaller than humans and their bodies cannot process alcohol well. No amount of alcohol is safe — it can cause rapid central nervous system depression, low blood sugar and death.",
    reasonZh: "酒精（乙醇）对狗高度有毒，且吸收很快。狗比人小得多，身体无法很好地代谢酒精。任何量的酒精都不安全——它会迅速抑制中枢神经、引起低血糖甚至死亡。",
    symptoms: "Vomiting, disorientation, staggering/incoordination, drooling, weakness, low body temperature, difficulty breathing, tremors, coma and death — can progress quickly.",
    symptomsZh: "呕吐、神志不清、走路摇晃/行动失调、流口水、虚弱、体温过低、呼吸困难、震颤、昏迷和死亡——可能进展很快。",
    advice: "Never give any alcohol. Keep drinks, bottles and glasses out of reach, clean up spills, and be aware of alcohol in raw dough and some desserts.",
    adviceZh: "绝不要给狗任何酒精。把酒、酒瓶和杯子放到够不到的地方，及时清理洒出的酒，并留意生面团和某些甜点中的酒精。",
    emergency: "This is a life-threatening emergency. Take your dog to a veterinarian immediately. Call your vet or ASPCA Poison Control (888) 426-4435. Do NOT induce vomiting unless a vet tells you to.",
    emergencyZh: "这是危及生命的紧急情况。请立即带狗狗去看兽医。致电您的兽医或 ASPCA 中毒控制中心 (888) 426-4435。除非兽医指示，否则不要催吐。",
    dosageNoteZh: "没有安全剂量——任何酒精摄入都是急诊。",
    dosageNote: "No safe amount — any alcohol exposure is an emergency.",
    traits: { colors: ["white","yellow"], shapes: ["liquid"], extras: ["processed"] },
    sources: ["ASPCA-1"], checked: "2026-10-03"
  },
  {
    id: "honey", name: "Honey",
    nameZh: "蜂蜜",
    aliases: ["honey", "raw honey"],
    aliasesZh: ["蜂蜜", "生蜂蜜"],
    category: "drink", level: "moderation",
    reason: "Honey is non-toxic in small amounts and is sometimes used as a treat or to soothe a cough. It is essentially pure sugar, so it should be a rare, small treat.",
    symptoms: "None in small amounts. Too much sugar: stomach upset and weight gain; not suitable for diabetic dogs.",
    advice: "Feed only a small amount of plain honey, occasionally. Avoid honey with added flavorings. Do not give honey to puppies under one year (botulism risk applies to human infants; caution advised).",
    emergency: null,
    dosageNote: "A teaspoon at most, rare treat; high sugar.",
    traits: { colors: ["yellow","brown"], shapes: ["liquid"], extras: [] },
    sources: ["AKC-2"], checked: "2026-10-03"
  },
  {
    id: "candy", name: "Candy",
    nameZh: "糖果",
    aliases: ["candy", "sweets", "gummies", "candy bar"],
    aliasesZh: ["糖果", "软糖", "巧克力棒", "棒棒糖"],
    category: "drink", level: "caution",
    reason: "Candy is a mixed risk: it is high in sugar, and it often contains chocolate, xylitol or other artificial sweeteners. Sugar-free candy almost always contains xylitol, which is severely toxic to dogs.",
    symptoms: "Stomach upset from sugar. If chocolate: theobromine toxicity. If xylitol: vomiting, weakness, incoordination, seizures, liver damage.",
    advice: "Do not feed candy. Keep it out of reach, and check labels — anything 'sugar-free' should be treated as highly toxic.",
    emergency: "If your dog ate candy, especially sugar-free or chocolate candy, contact your vet or ASPCA Poison Control (888) 426-4435 immediately. Do NOT induce vomiting unless a vet tells you to.",
    dosageNote: "Sugar + possible chocolate + possible xylitol; sugar-free versions are severe.",
    traits: { colors: ["red","white"], shapes: ["small"], extras: ["snack","processed"] },
    sources: ["ASPCA-1"], checked: "2026-10-03"
  },
  {
    id: "cake", name: "Cake & Cookies",
    nameZh: "蛋糕与饼干",
    aliases: ["cake", "birthday cake", "cookies", "brownies", "biscuits"],
    aliasesZh: ["蛋糕", "生日蛋糕", "饼干", "布朗尼", "曲奇"],
    category: "drink", level: "caution",
    reason: "Cake and cookies combine sugar and fat with ingredients that are often toxic to dogs: chocolate, raisins, xylitol, macadamia nuts and nutmeg. The risk depends on the ingredients, so the safe answer is not to feed them.",
    symptoms: "Stomach upset from sugar/fat; chocolate toxicity (theobromine); xylitol toxicity; raisin/grape kidney injury — depending on ingredients.",
    advice: "Do not feed cake or cookies. For a birthday treat, use a dog-safe recipe (e.g. plain peanut butter without xylitol and no chocolate) or a dog-specific bakery treat.",
    emergency: "If your dog ate cake or cookies containing chocolate, raisins or xylitol, contact your vet or ASPCA Poison Control (888) 426-4435 immediately. Do NOT induce vomiting unless a vet tells you to.",
    dosageNote: "Ingredients vary; chocolate/raisins/xylitol make it dangerous.",
    traits: { colors: ["brown","white"], shapes: ["chunk"], extras: ["snack","processed"] },
    sources: ["ASPCA-1", "AKC-2"], checked: "2026-10-03"
  },

  /* 巧克力族（4 条）：category = drink（饮品与甜食——甜食直觉，与糖果/蛋糕同类）。
   * 毒性信息由 level/reason 表达，不靠分类强调（分类纪律见下方 processed 分组注释）。 */
  {
    id: "chocolate", name: "Chocolate",
    nameZh: "巧克力",
    aliases: ["chocolate", "milk chocolate", "chocolate bar", "chocolate chips", "choc"],
    aliasesZh: ["巧克力", "牛奶巧克力", "巧克力棒", "巧克力豆", "黑巧克力"],
    category: "drink", level: "toxic",
    reason: "Chocolate contains methylxanthines (theobromine and caffeine), which dogs cannot metabolize efficiently. The darker and more bitter the chocolate, the more theobromine it contains, so dark and baking chocolate are the most dangerous. Even milk chocolate can cause toxicity depending on the amount and the dog's size.",
    reasonZh: "巧克力含有甲基黄嘌呤（可可碱和咖啡因），狗无法有效代谢。巧克力越黑越苦，可可碱含量越高，因此黑巧克力和烘焙巧克力最危险。即使是牛奶巧克力，也取决于食用量和狗的体型，仍可能中毒。",
    symptoms: "Vomiting, diarrhea, restlessness, excessive thirst and urination, racing or abnormal heart rate, tremors, seizures; severe cases can be fatal. Signs can appear within hours.",
    symptomsZh: "呕吐、腹泻、坐立不安、极度口渴和多尿、心率过快或心律失常、震颤、癫痫发作；严重时可致命。症状可在数小时内出现。",
    advice: "Never feed chocolate of any kind. Keep chocolate out of reach, and be aware of chocolate in brownies, cookies, candy and some nut mixes.",
    adviceZh: "绝不要喂任何种类的巧克力。把巧克力放到够不到的地方，并留意布朗尼、饼干、糖果和某些混合坚果中的巧克力。",
    emergency: "Contact your vet or a pet poison hotline immediately: ASPCA Poison Control (888) 426-4435 or Pet Poison Helpline (855) 764-7661. Do NOT induce vomiting unless a vet tells you to. The darker the chocolate, the more urgent.",
    emergencyZh: "请立即联系您的兽医或宠物中毒热线：ASPCA 中毒控制中心 (888) 426-4435 或宠物中毒求助热线 (855) 764-7661。除非兽医指示，否则不要催吐。巧克力越黑越紧急。",
    dosageNoteZh: "巧克力越黑越毒——黑巧克力/烘焙巧克力/可可粉最危险。",
    dosageNote: "The darker the chocolate, the more toxic — dark/baking/cocoa are the worst.",
    traits: { colors: ["brown"], shapes: ["chunk","flat"], extras: ["snack","processed"] },
    sources: ["ASPCA-1", "AKC-2", "PETMD-5"], checked: "2026-10-03"
  },
  {
    id: "dark-chocolate", name: "Dark Chocolate",
    nameZh: "黑巧克力（烘焙巧克力）",
    aliases: ["dark chocolate", "bitter chocolate", "baking chocolate", "cocoa powder", "semisweet chocolate", "cocoa"],
    aliasesZh: ["黑巧克力", "苦巧克力", "烘焙巧克力", "可可粉", "半甜巧克力", "可可"],
    category: "drink", level: "severe",
    reason: "Dark chocolate, baking chocolate, cocoa powder and semisweet chocolate have the highest concentrations of methylxanthines (theobromine and caffeine). Even a small amount can be dangerous, and baking chocolate is among the most concentrated forms.",
    reasonZh: "黑巧克力、烘焙巧克力、可可粉和半甜巧克力含有最高浓度的甲基黄嘌呤（可可碱和咖啡因）。即使少量也可能危险，其中烘焙巧克力是浓度最高的形式之一。",
    symptoms: "Vomiting, diarrhea, restlessness, excessive thirst/urination, racing or irregular heart rate, tremors, seizures, collapse — can be fatal. Signs can appear within a few hours.",
    symptomsZh: "呕吐、腹泻、坐立不安、极度口渴/多尿、心率过快或心律失常、震颤、癫痫发作、虚脱——可致命。症状可在数小时内出现。",
    advice: "Never feed any dark, bitter, baking or cocoa-based chocolate. Treat any ingestion as an emergency and keep all such products out of reach.",
    adviceZh: "绝不要喂任何黑巧克力、苦巧克力、烘焙巧克力或含可可的巧克力。任何误食都应按急诊处理，并把这类产品放到狗狗够不到的地方。",
    emergency: "This is a serious emergency. Contact your vet or ASPCA Poison Control (888) 426-4435 / Pet Poison Helpline (855) 764-7661 immediately, and be ready to say what kind and how much was eaten. Do NOT induce vomiting unless a vet tells you to.",
    emergencyZh: "这是严重的急诊。请立即联系您的兽医或 ASPCA 中毒控制中心 (888) 426-4435 / 宠物中毒求助热线 (855) 764-7661，并准备好说明吃了哪种、吃了多少。除非兽医指示，否则不要催吐。",
    dosageNoteZh: "可可碱浓度最高——少量即可危险。",
    dosageNote: "Highest theobromine concentration — small amounts can be dangerous.",
    traits: { colors: ["black","brown"], shapes: ["chunk","flat"], extras: ["snack","processed"] },
    sources: ["ASPCA-1", "PETMD-5"], checked: "2026-10-03"
  },
  {
    id: "white-chocolate", name: "White Chocolate",
    nameZh: "白巧克力",
    aliases: ["white chocolate", "white choc"],
    aliasesZh: ["白巧克力"],
    category: "drink", level: "caution",
    reason: "White chocolate contains very little of the toxic methylxanthines found in dark chocolate, so true theobromine poisoning is uncommon. However, it is extremely high in fat and sugar, which can cause vomiting, diarrhea and pancreatitis. It is still not a food to give your dog.",
    symptoms: "Stomach upset, vomiting, diarrhea; high fat can trigger pancreatitis. Theobromine toxicity is unlikely unless a very large amount is eaten.",
    advice: "Do not feed white chocolate. It offers no benefit and carries fat/sugar risks.",
    emergency: "If your dog ate a large amount, contact your vet or ASPCA Poison Control (888) 426-4435 for guidance, particularly because of the fat content.",
    dosageNote: "Low theobromine but high fat/sugar — still avoid.",
    traits: { colors: ["white","yellow"], shapes: ["chunk","flat"], extras: ["snack","processed"] },
    sources: ["ASPCA-1"], checked: "2026-10-03"
  },
  {
    id: "nutella", name: "Nutella & Chocolate Spread",
    nameZh: "榛子巧克力酱（Nutella）",
    aliases: ["nutella", "chocolate spread", "hazelnut spread"],
    aliasesZh: ["榛子酱", "巧克力酱", "榛子巧克力酱"],
    category: "drink", level: "toxic",
    reason: "Chocolate-hazelnut spreads contain cocoa, so they carry the same methylxanthine (theobromine/caffeine) toxicity as chocolate, plus a large amount of sugar and fat.",
    reasonZh: "巧克力榛子酱含可可，因此具有与巧克力相同的甲基黄嘌呤（可可碱/咖啡因）毒性，此外还含有大量糖和脂肪。",
    symptoms: "Vomiting, diarrhea, restlessness, excessive thirst, racing heart, tremors, seizures — from the cocoa; plus stomach upset from the fat and sugar.",
    symptomsZh: "呕吐、腹泻、坐立不安、极度口渴、心跳加快、震颤、癫痫发作——来自可可；此外脂肪和糖还会引起肠胃不适。",
    advice: "Never feed chocolate spread. Keep jars out of reach and check labels on cookies and baked goods.",
    adviceZh: "绝不要喂巧克力酱。把罐子放到够不到的地方，并检查饼干和烘焙食品的标签。",
    emergency: "Contact your vet or ASPCA Poison Control (888) 426-4435 / Pet Poison Helpline (855) 764-7661 if your dog ate chocolate spread. Do NOT induce vomiting unless a vet tells you to.",
    emergencyZh: "如果狗狗吃了巧克力酱，请联系您的兽医或 ASPCA 中毒控制中心 (888) 426-4435 / 宠物中毒求助热线 (855) 764-7661。除非兽医指示，否则不要催吐。",
    dosageNoteZh: "含可可（可可碱）+ 糖 + 脂肪；按误食巧克力处理。",
    dosageNote: "Cocoa (theobromine) + sugar + fat; treat like chocolate ingestion.",
    traits: { colors: ["brown"], shapes: ["liquid"], extras: ["snack","processed"] },
    sources: ["ASPCA-1"], checked: "2026-10-03"
  },
  /* ============ 分类纪律：category 跟随「用户怎么找」（自然大类），
   * ============ 不跟随「毒性聚类」。毒性信息由 level / reason 表达。
   * ============ 本分组仅保留无自然大类可归的真加工品（5 条）：
   * ============ xylitol（人工甜味剂）/ 薯条 / 披萨 / 热狗 / 番茄酱。
   * ============ 巧克力族 → drink（见上），葡萄/葡萄干 → fruit，葱蒜族 → vegetable。 */
  {
    id: "xylitol", name: "Xylitol (Sugar-Free Sweetener)",
    nameZh: "木糖醇（无糖甜味剂）",
    // 别名收窄：裸 "sugar-free" / "sugarfree" / "sugar free" 曾导致输入通用词
    // sugar 被子串匹配到本木糖醇条目（P1-①）。仅保留带 gum/candy 的完整短语，
    // 完整短语的 triggersXylitol 会在 app.js 归一化后以词边界精确命中。
    aliases: ["xylitol", "sugar-free gum", "sugarfree gum", "sugar free gum", "birch sugar", "sugar-free candy"],
    aliasesZh: ["木糖醇", "桦木糖", "无糖口香糖", "无糖糖果", "代糖"],
    category: "processed", level: "severe",
    reason: "Xylitol is an artificial sweetener that is extremely toxic to dogs. It triggers a massive release of insulin, causing dangerously low blood sugar (hypoglycemia), and in many dogs it also causes acute liver failure. A single piece of sugar-free gum can contain 0.3–1 g of xylitol, and as little as 0.1 g per kg of body weight can cause poisoning. Xylitol is found in gum, mints, sugar-free candy, baked goods, toothpaste, some peanut butters, some yogurts and even some medications.",
    reasonZh: "木糖醇是一种人工甜味剂，对狗剧毒。它会触发胰岛素大量释放，导致危险的血糖过低（低血糖），在许多狗身上还会引起急性肝功能衰竭。一块无糖口香糖可能含 0.3–1 克木糖醇，而低至每公斤体重 0.1 克即可引起中毒。木糖醇存在于口香糖、薄荷糖、无糖糖果、烘焙食品、牙膏、部分花生酱、部分酸奶甚至某些药物中。",
    symptoms: "Vomiting, weakness, staggering/lack of coordination, lethargy, tremors, seizures (from hypoglycemia) within 30–60 minutes; liver failure can develop within 12–24 hours and may be fatal.",
    symptomsZh: "在 30–60 分钟内出现呕吐、虚弱、走路摇晃/行动失调、嗜睡、震颤、癫痫发作（由低血糖引起）；肝功能衰竭可在 12–24 小时内发生，并可能致命。",
    advice: "Keep ALL xylitol products (gum, mints, candy, toothpaste, sugar-free baked goods) completely out of reach. Always check labels on peanut butter and other foods for xylitol or 'birch sugar'.",
    adviceZh: "把所有含木糖醇的产品（口香糖、薄荷糖、糖果、牙膏、无糖烘焙食品）彻底放到狗狗够不到的地方。务必检查花生酱及其他食品标签是否含木糖醇或「桦木糖」。",
    emergency: "This is a life-threatening emergency. Take your dog to a veterinarian immediately — call your vet or ASPCA Poison Control (888) 426-4435. Do NOT induce vomiting unless a vet tells you to, and bring the product packaging with you.",
    emergencyZh: "这是危及生命的紧急情况。请立即带狗狗去看兽医——致电您的兽医或 ASPCA 中毒控制中心 (888) 426-4435。除非兽医指示，否则不要催吐，并带上产品包装。",
    dosageNoteZh: "低至 0.1 克/公斤即可中毒；一块口香糖可能含 0.3–1 克。",
    dosageNote: "As little as 0.1 g/kg can cause poisoning; a single gum piece can contain 0.3–1 g.",
    traits: { colors: ["white"], shapes: ["small"], extras: ["processed"] },
    sources: ["ASPCA-1", "VET-6"], checked: "2026-10-03"
  },
  /* 葡萄/葡萄干：天然水果（果干），归 fruit——不因肾毒性归 processed。 */
  {
    id: "grapes", name: "Grapes",
    nameZh: "葡萄",
    aliases: ["grape", "grapes", "red grapes", "green grapes", "seedless grapes", "grapes and raisins"],
    aliasesZh: ["葡萄", "红葡萄", "青葡萄", "无籽葡萄", "葡萄和葡萄干"],
    category: "fruit", level: "severe",
    reason: "Grapes (and raisins) are linked to acute kidney injury in dogs. ASPCA identifies tartaric acid — which dogs cannot process well — as the suspected toxic component. Sensitivity varies between dogs: even a small amount can be dangerous, and there is no reliable way to predict which dogs will be affected.",
    reasonZh: "葡萄（和葡萄干）与狗的急性肾损伤有关。ASPCA 认为狗难以代谢的酒石酸是疑似有毒成分。不同狗的敏感度不同：即使少量也可能危险，且无法可靠预测哪些狗会受影响。",
    symptoms: "Vomiting within 6–12 hours; diarrhea; lethargy; loss of appetite; increased thirst; little or no urine (kidney injury may show 24–72 hours later).",
    symptomsZh: "6–12 小时内呕吐；腹泻；嗜睡；食欲不振；口渴增加；尿少或无尿（肾损伤可能在 24–72 小时后才显现）。",
    advice: "Never feed grapes or raisins in any form. Check breads, pastries, trail mix, cereal and fruitcake for hidden raisins.",
    adviceZh: "绝不要喂任何形式的葡萄或葡萄干。检查面包、糕点、什锦零食、麦片和水果蛋糕中是否含有隐藏的葡萄干。",
    emergency: "Treat ANY grape or raisin ingestion as an emergency — seek veterinary care immediately rather than waiting. ASPCA Poison Control (888) 426-4435. Do NOT induce vomiting at home unless a vet instructs you to.",
    emergencyZh: "任何葡萄或葡萄干误食都应按急诊处理——请立即就医，不要等待。ASPCA 中毒控制中心 (888) 426-4435。除非兽医指示，否则不要在家中催吐。",
    dosageNoteZh: "没有已知安全剂量——极少量也与肾衰竭相关。",
    dosageNote: "No known safe dose — kidney failure has been linked to very small amounts.",
    traits: { colors: ["purple","green"], shapes: ["small","round","bunch"], extras: ["snack"] },
    sources: ["ASPCA-1", "AKC-4"], checked: "2026-10-03"
  },
  {
    id: "raisins", name: "Raisins",
    nameZh: "葡萄干",
    aliases: ["raisin", "raisins", "sultanas", "sultana", "currants", "dried grapes"],
    aliasesZh: ["葡萄干", "无核葡萄干", "苏丹娜葡萄干", "黑加仑干"],
    category: "fruit", level: "severe",
    reason: "Raisins, sultanas and currants are dried grapes and carry the same kidney-toxicity risk as fresh grapes. Because they are dried, it is easy for a dog to eat a large number quickly, and the concentrated sugar and texture make them especially appealing.",
    reasonZh: "葡萄干、苏丹娜葡萄干和黑加仑干都是葡萄干制品，具有与新鲜葡萄相同的肾毒性风险。由于经过干燥，狗狗很容易快速吃下大量，而浓缩的糖分和口感对它们格外有吸引力。",
    symptoms: "Vomiting within 6–12 hours; diarrhea; lethargy; loss of appetite; increased thirst; little or no urine (kidney injury may show 24–72 hours later).",
    symptomsZh: "6–12 小时内呕吐；腹泻；嗜睡；食欲不振；口渴增加；尿少或无尿（肾损伤可能在 24–72 小时后才显现）。",
    advice: "Never feed raisins, sultanas or currants. Check breads, bagels, cookies, muffins, granola, trail mix and stuffings for hidden raisins.",
    adviceZh: "绝不要喂葡萄干、苏丹娜葡萄干或黑加仑干。检查面包、贝果、饼干、松饼、麦片、什锦零食和馅料中是否含有隐藏的葡萄干。",
    emergency: "Treat any raisin ingestion as an emergency — seek veterinary care immediately. ASPCA Poison Control (888) 426-4435. Do NOT induce vomiting at home unless a vet instructs you to.",
    emergencyZh: "任何葡萄干误食都应按急诊处理——请立即就医。ASPCA 中毒控制中心 (888) 426-4435。除非兽医指示，否则不要在家中催吐。",
    dosageNoteZh: "没有已知安全剂量——风险与葡萄相同，且更难防范。",
    dosageNote: "No known safe dose — same risk as grapes, and harder to keep away.",
    traits: { colors: ["brown","black"], shapes: ["small"], extras: ["snack","processed"] },
    sources: ["ASPCA-1", "AKC-4"], checked: "2026-10-03"
  },
  /* 葱蒜族（5 条）：天然蔬菜，归 vegetable——不因溶血性毒性归 processed。 */
  {
    id: "onions", name: "Onions",
    nameZh: "洋葱",
    aliases: ["onion", "onions", "fried onions", "onion powder", "onion soup mix"],
    aliasesZh: ["洋葱", "炒洋葱", "洋葱粉", "洋葱汤料"],
    category: "vegetable", level: "toxic",
    reason: "Onions and other allium plants contain organosulfoxides that damage a dog's red blood cells, causing hemolytic anemia. Onions are toxic whether raw, cooked, dried or in powder form — the powder is actually more concentrated. Signs can be delayed for days.",
    reasonZh: "洋葱及其他葱属植物含有有机硫氧化物，会破坏狗的红细胞，引起溶血性贫血。洋葱无论生、熟、干制还是粉状都有毒——粉状反而更浓缩。症状可能延迟数天才出现。",
    symptoms: "Lethargy, weakness, vomiting, diarrhea, abdominal pain, pale gums, rapid breathing, dark urine; anemia can develop several days after eating. Large amounts can be fatal.",
    symptomsZh: "嗜睡、虚弱、呕吐、腹泻、腹痛、牙龈苍白、呼吸急促、尿色深；贫血可能在食用数天后才出现。大量可致命。",
    advice: "Never feed onions in any form. Watch for hidden onion in soup mixes, broths, gravies, sausages, pizza, leftovers and baby food. As little as about 0.5% of a dog's body weight can be toxic.",
    adviceZh: "绝不要喂任何形式的洋葱。留意汤料、高汤、肉汁、香肠、披萨、剩菜和婴儿食品中隐藏的洋葱。低至约占狗体重 0.5% 就可能中毒。",
    emergency: "Contact your vet or ASPCA Poison Control (888) 426-4435 if your dog ate onions — even if it was a small amount and even if your dog seems fine now. Do NOT induce vomiting unless a vet tells you to.",
    emergencyZh: "如果狗狗吃了洋葱——即使是少量、即使现在看起来没事——也请联系您的兽医或 ASPCA 中毒控制中心 (888) 426-4435。除非兽医指示，否则不要催吐。",
    dosageNoteZh: "生、熟、粉状都有毒；粉状更浓缩。约占体重 0.5% 即可中毒。",
    dosageNote: "Raw, cooked and powder all toxic; powder is concentrated. ~0.5% of body weight can poison.",
    traits: { colors: ["white","purple"], shapes: ["round"], extras: ["peel"] },
    sources: ["ASPCA-1", "VET-6"], checked: "2026-10-03"
  },
  {
    id: "garlic", name: "Garlic",
    nameZh: "大蒜",
    aliases: ["garlic", "garlic powder", "garlic cloves", "garlic salt"],
    aliasesZh: ["大蒜", "蒜", "蒜粉", "蒜头", "蒜蓉"],
    category: "vegetable", level: "toxic",
    reason: "Garlic is part of the allium family and is considered the most potent of the alliums for dogs. It damages red blood cells and can cause hemolytic anemia. Like onion, it is toxic raw, cooked or as powder, and garlic powder is especially concentrated.",
    reasonZh: "大蒜属于葱属植物，被认为是对狗毒性最强的葱属。它会破坏红细胞，引起溶血性贫血。与洋葱一样，生、熟或粉状都有毒，蒜粉尤其浓缩。",
    symptoms: "Pale gums, rapid heart rate, weakness, lethargy, vomiting, diarrhea, collapse; anemia may develop over several days.",
    symptomsZh: "牙龈苍白、心率加快、虚弱、嗜睡、呕吐、腹泻、虚脱；贫血可能在数天内逐渐出现。",
    advice: "Never feed garlic in any form — including garlic powder, garlic salt and garlic-seasoned foods. Check labels on seasonings, sauces, treats and 'natural' pet foods.",
    adviceZh: "绝不要喂任何形式的大蒜——包括蒜粉、蒜盐和用蒜调味的食物。检查调味料、酱汁、零食和「天然」宠物食品的标签。",
    emergency: "Contact your vet or ASPCA Poison Control (888) 426-4435 if your dog ate garlic, even a small amount. Do NOT induce vomiting unless a vet tells you to.",
    emergencyZh: "如果狗狗吃了大蒜，即使少量，也请联系您的兽医或 ASPCA 中毒控制中心 (888) 426-4435。除非兽医指示，否则不要催吐。",
    dosageNoteZh: "对狗毒性最强的葱属；粉状更浓缩。",
    dosageNote: "Most potent allium for dogs; powder is concentrated.",
    traits: { colors: ["white"], shapes: ["small","round"], extras: ["peel"] },
    sources: ["ASPCA-1", "AKC-2"], checked: "2026-10-03"
  },
  {
    id: "leeks", name: "Leeks",
    nameZh: "韭葱",
    aliases: ["leek", "leeks"],
    aliasesZh: ["韭葱", "大葱"],
    category: "vegetable", level: "toxic",
    reason: "Leeks belong to the allium family and share the same toxic compounds as onions and garlic, which damage red blood cells and cause anemia. Any form — raw, cooked or dried — is a risk.",
    reasonZh: "韭葱属于葱属，与洋葱和大蒜含有相同的毒性化合物，会破坏红细胞并引起贫血。无论生、熟还是干制都有风险。",
    symptoms: "Vomiting, diarrhea, weakness, pale gums, lethargy, rapid heart rate; anemia may develop over several days.",
    symptomsZh: "呕吐、腹泻、虚弱、牙龈苍白、嗜睡、心率加快；贫血可能在数天内逐渐出现。",
    advice: "Do not feed leeks. Watch for them in soups, stocks, potato dishes and leftovers.",
    adviceZh: "不要喂韭葱。留意汤、高汤、土豆菜肴和剩菜中的韭葱。",
    emergency: "Contact your vet or ASPCA Poison Control (888) 426-4435 if your dog ate leeks. Do NOT induce vomiting unless a vet tells you to.",
    emergencyZh: "如果狗狗吃了韭葱，请联系您的兽医或 ASPCA 中毒控制中心 (888) 426-4435。除非兽医指示，否则不要催吐。",
    dosageNoteZh: "葱属植物——毒性与洋葱/大蒜相同。",
    dosageNote: "Allium family — same toxicity as onion/garlic.",
    traits: { colors: ["green","white"], shapes: ["chunk"], extras: [] },
    sources: ["ASPCA-1"], checked: "2026-10-03"
  },
  {
    id: "chives", name: "Chives",
    nameZh: "细香葱（韭菜花）",
    aliases: ["chive", "chives"],
    aliasesZh: ["细香葱", "香葱", "细葱"],
    category: "vegetable", level: "toxic",
    reason: "Chives are an allium and contain the same toxic organosulfoxides as onions and garlic, causing damage to red blood cells. They are often used as a garnish, so small amounts appear in many dishes.",
    reasonZh: "细香葱属于葱属，含有与洋葱和大蒜相同的有毒有机硫氧化物，会破坏红细胞。它们常被用作点缀，因此许多菜肴中都含有少量。",
    symptoms: "Vomiting, diarrhea, weakness, pale gums, lethargy, rapid heart rate; anemia can develop days later.",
    symptomsZh: "呕吐、腹泻、虚弱、牙龈苍白、嗜睡、心率加快；贫血可能在数天后出现。",
    advice: "Do not feed chives. Check soups, dips, salads, baked potatoes and garnishes.",
    adviceZh: "不要喂细香葱。检查汤、蘸酱、沙拉、烤土豆和点缀用的配菜。",
    emergency: "Contact your vet or ASPCA Poison Control (888) 426-4435 if your dog ate chives. Do NOT induce vomiting unless a vet tells you to.",
    emergencyZh: "如果狗狗吃了细香葱，请联系您的兽医或 ASPCA 中毒控制中心 (888) 426-4435。除非兽医指示，否则不要催吐。",
    dosageNoteZh: "葱属植物——毒性与洋葱/大蒜相同。",
    dosageNote: "Allium family — same toxicity as onion/garlic.",
    traits: { colors: ["green"], shapes: ["small"], extras: [] },
    sources: ["ASPCA-1"], checked: "2026-10-03"
  },
  {
    id: "scallions", name: "Scallions & Shallots",
    nameZh: "小葱与红葱头",
    aliases: ["scallion", "scallions", "green onion", "green onions", "shallot", "shallots", "spring onion"],
    aliasesZh: ["小葱", "青葱", "香葱", "红葱头", "大葱", "火葱"],
    category: "vegetable", level: "toxic",
    reason: "Scallions (green onions) and shallots are alliums and contain the same toxic compounds as onions and garlic, which damage red blood cells and cause hemolytic anemia. All parts — including the green tops — are toxic.",
    reasonZh: "小葱（青葱）和红葱头属于葱属，含有与洋葱和大蒜相同的毒性化合物，会破坏红细胞并引起溶血性贫血。所有部位——包括绿色的葱叶——都有毒。",
    symptoms: "Vomiting, diarrhea, weakness, pale gums, lethargy, rapid heart rate; anemia may develop over several days.",
    symptomsZh: "呕吐、腹泻、虚弱、牙龈苍白、嗜睡、心率加快；贫血可能在数天内逐渐出现。",
    advice: "Do not feed scallions or shallots. Watch for them in stir-fries, salads, soups, sauces and garnishes.",
    adviceZh: "不要喂小葱或红葱头。留意炒菜、沙拉、汤、酱汁和点缀配菜中的它们。",
    emergency: "Contact your vet or ASPCA Poison Control (888) 426-4435 if your dog ate scallions or shallots. Do NOT induce vomiting unless a vet tells you to.",
    emergencyZh: "如果狗狗吃了小葱或红葱头，请联系您的兽医或 ASPCA 中毒控制中心 (888) 426-4435。除非兽医指示，否则不要催吐。",
    dosageNoteZh: "葱属植物——毒性与洋葱/大蒜相同。",
    dosageNote: "Allium family — same toxicity as onion/garlic.",
    traits: { colors: ["green","white"], shapes: ["chunk"], extras: [] },
    sources: ["ASPCA-1"], checked: "2026-10-03"
  },
  {
    id: "french-fries", name: "French Fries",
    nameZh: "炸薯条",
    aliases: ["french fries", "fries", "chips", "potato chips", "crisps"],
    aliasesZh: ["炸薯条", "薯条", "薯片", "土豆片"],
    category: "processed", level: "caution",
    reason: "French fries and chips are fried in oil and heavily salted. The high fat can trigger pancreatitis and the high salt can cause sodium-related problems. They offer no nutritional benefit and are not recommended.",
    symptoms: "Stomach upset, vomiting, diarrhea; high fat may trigger pancreatitis (abdominal pain, lethargy, vomiting). Very salty foods can cause excessive thirst and, in extreme cases, sodium toxicity.",
    advice: "Do not feed fries, chips or crisps. If your dog steals one, it is usually not dangerous — but watch for stomach upset and keep oily, salty foods away.",
    emergency: null,
    dosageNote: "High fat and salt; no nutritional value.",
    traits: { colors: ["yellow"], shapes: ["chunk","flat"], extras: ["snack","processed"] },
    sources: ["ASPCA-1", "VET-6"], checked: "2026-10-03"
  },
  {
    id: "pizza", name: "Pizza",
    nameZh: "披萨",
    aliases: ["pizza", "pizza slice", "pepperoni pizza"],
    aliasesZh: ["披萨", "比萨", "披萨片"],
    category: "processed", level: "caution",
    reason: "Pizza stacks multiple risks: the cheese is high in fat and lactose, the sauce often contains onion and garlic powder, the crust is salty and the toppings may include sausage, pepperoni or other seasoned meats. It is not a safe food for dogs.",
    symptoms: "Stomach upset, vomiting, diarrhea; high fat can trigger pancreatitis; onion/garlic can cause anemia, sometimes delayed by days.",
    advice: "Do not feed pizza. Keep boxes out of reach and secure the trash. If your dog ate pizza with onion or garlic, watch for weakness and pale gums.",
    emergency: null,
    dosageNote: "Cheese fat + onion/garlic + salt; onions make it a toxicity concern.",
    traits: { colors: ["red","yellow"], shapes: ["round","flat"], extras: ["processed"] },
    sources: ["ASPCA-1", "VET-6"], checked: "2026-10-03"
  },
  {
    id: "hot-dogs", name: "Hot Dogs & Processed Meat",
    nameZh: "热狗与加工肉",
    aliases: ["hot dog", "hot dogs", "sausage", "bacon", "deli meat", "salami", "pepperoni"],
    aliasesZh: ["热狗", "香肠", "培根", "腊肉", "萨拉米", "加工肉", "意式辣香肠"],
    category: "processed", level: "caution",
    reason: "Hot dogs, sausages, bacon and deli meats are highly processed and loaded with sodium, fat, nitrates and seasonings — sometimes including onion and garlic powder. The combination of salt and fat is a real risk, and some dogs develop pancreatitis.",
    symptoms: "Stomach upset, vomiting, diarrhea; high fat can trigger pancreatitis; high salt can cause excessive thirst and, in extreme cases, sodium toxicity; onion/garlic seasoning adds anemia risk.",
    advice: "Do not feed hot dogs, sausages, bacon or deli meat. Even 'just a little' is not recommended because of the salt, fat and seasoning.",
    emergency: null,
    dosageNote: "High sodium + fat + possible onion/garlic seasoning.",
    traits: { colors: ["red","brown"], shapes: ["chunk"], extras: ["processed"] },
    sources: ["ASPCA-1", "VET-6"], checked: "2026-10-03"
  },
  {
    id: "ketchup", name: "Ketchup",
    nameZh: "番茄酱",
    aliases: ["ketchup", "tomato sauce", "tomato ketchup", "marinara"],
    aliasesZh: ["番茄酱", "番茄沙司", "意面酱"],
    category: "processed", level: "caution",
    reason: "Ketchup and many tomato sauces contain onion powder, garlic powder, sugar and salt. The tomato itself is not the problem — the added alliums and sodium are. It should not be fed to dogs.",
    symptoms: "Stomach upset from sugar/salt/acid; if it contains onion or garlic powder, anemia risk that can be delayed by days.",
    advice: "Do not feed ketchup or seasoned tomato sauces. Plain tomato paste is a different (still unnecessary) matter, but alliums make ketchup unsuitable.",
    emergency: null,
    dosageNote: "Onion/garlic powder + sugar + salt; avoid.",
    traits: { colors: ["red"], shapes: ["liquid"], extras: ["processed"] },
    sources: ["ASPCA-1"], checked: "2026-10-03"
  }
];

/* ----------------------------------------------------------------------------
 * 导出（兼容浏览器 <script> 与 Node 测试环境）
 * 浏览器：挂到 window 上供 app.js 使用
 * Node：module.exports 供 selftest.js require
 * --------------------------------------------------------------------------*/
if (typeof window !== "undefined") {
  window.FOODS = FOODS;
  window.SOURCES = SOURCES;
  window.CATEGORY_META = CATEGORY_META;
  window.LEVEL_META = LEVEL_META;
  window.TRAITS_ENUM = TRAITS_ENUM;
  window.FOOD_EMOJI = FOOD_EMOJI;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { FOODS, SOURCES, CATEGORY_META, LEVEL_META, TRAITS_ENUM, FOOD_EMOJI };
}
