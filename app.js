/* ============================================================================
 * app.js — 狗粮安全判定器 应用层（测试版）
 * ----------------------------------------------------------------------------
 * 依赖：data.js（FOODS / SOURCES / CATEGORY_META / LEVEL_META）
 * 约束：
 *   - 纯前端、零网络请求、无 eval、无 innerHTML 拼接用户输入
 *   - 所有动态文本走 textContent / createElement，杜绝 XSS
 *   - 本地查表 <100ms，刻意不做 loading spinner（零等待即卖点）
 *   - 未收录食物绝不给猜测等级（保守 UNKNOWN 卡）
 * ==========================================================================*/

(function () {
  'use strict';

  /* ==========================================================================
   * 0. 常量与运行时状态
   * ========================================================================*/

  // 语言与 i18n 引用（浏览器由 i18n.js 挂 window；Node 测试环境回退 require）
  var I18N_REF = (typeof I18N !== 'undefined') ? I18N
    : (typeof window !== 'undefined' && window.I18N) ? window.I18N : null;
  var LEVEL_LABELS_REF = (typeof LEVEL_LABELS !== 'undefined') ? LEVEL_LABELS
    : (typeof window !== 'undefined' && window.LEVEL_LABELS) ? window.LEVEL_LABELS : null;
  var CATEGORY_LABELS_REF = (typeof CATEGORY_LABELS !== 'undefined') ? CATEGORY_LABELS
    : (typeof window !== 'undefined' && window.CATEGORY_LABELS) ? window.CATEGORY_LABELS : null;

  var DEFAULT_LANG = 'en';           // 目标市场英文，默认 EN
  var LANG_KEY = 'cde_lang';         // localStorage 偏好键
  var SUPPORTED_LANGS = ['en', 'zh'];

  // 当前语言（init 时从 localStorage 恢复）
  var lang = DEFAULT_LANG;

  // 取翻译：t('card.why')；支持 {name} 占位插值
  function t(key, vars) {
    var dict = (I18N_REF && I18N_REF[lang]) ? I18N_REF[lang] : null;
    var fallback = (I18N_REF && I18N_REF[DEFAULT_LANG]) ? I18N_REF[DEFAULT_LANG] : {};
    var s = (dict && dict[key] !== undefined) ? dict[key]
      : (fallback[key] !== undefined ? fallback[key] : key);
    if (vars) {
      s = String(s).replace(/\{(\w+)\}/g, function (m, k) {
        return vars[k] !== undefined ? String(vars[k]) : m;
      });
    }
    return s;
  }

  // 等级名（徽章大字 / 短名），走 i18n
  function levelLabel(level, short) {
    var set = LEVEL_LABELS_REF && LEVEL_LABELS_REF[lang];
    if (set && set[level]) return short ? set[level].short : set[level].badge;
    // 回退到 data.js 的英文 LEVEL_META
    var meta = LEVEL_META_REF[level];
    return short ? meta.short : meta.badge;
  }

  // 分类名，走 i18n（回退到 CATEGORY_META.label）
  function catLabel(key) {
    var set = CATEGORY_LABELS_REF && CATEGORY_LABELS_REF[lang];
    if (set && set[key]) return set[key];
    for (var i = 0; i < CATEGORY_META_REF.length; i++) {
      if (CATEGORY_META_REF[i].key === key) return CATEGORY_META_REF[i].label;
    }
    return key;
  }

  // 食物字段访问器：中文优先，缺失回退英文（保证任何语言下都有内容）
  function fName(f) { return (lang === 'zh' && f.nameZh) ? f.nameZh : f.name; }
  function fReason(f) { return (lang === 'zh' && f.reasonZh) ? f.reasonZh : f.reason; }
  function fSymptoms(f) { return (lang === 'zh' && f.symptomsZh) ? f.symptomsZh : f.symptoms; }
  function fAdvice(f) { return (lang === 'zh' && f.adviceZh) ? f.adviceZh : f.advice; }
  function fEmergency(f) { return (lang === 'zh' && f.emergencyZh) ? f.emergencyZh : f.emergency; }
  function fDosage(f) { return (lang === 'zh' && f.dosageNoteZh) ? f.dosageNoteZh : f.dosageNote; }

  // 木糖醇·巧克力等硬规则触发词（按语言）
  function langPack() {
    return lang === 'zh' ? ZH_PACK : EN_PACK;
  }

  // 紧急热线行（语言化）
  function emergencyLine() { return t('state.emergencyLine'); }

  var POPULAR = ['chocolate', 'grapes', 'apples', 'chicken', 'cheese',
                 'bananas', 'peanut-butter', 'watermelon', 'eggs', 'strawberries'];

  // 常见食物快捷入口（label 按语言取食物名）
  var QUICK_CHIP_IDS = ['chocolate', 'grapes', 'apple', 'chicken', 'cheese',
                        'banana', 'peanut-butter', 'watermelon', 'eggs', 'strawberries'];

  var SUGGEST_LIMIT = 8;
  var COMPARE_LIMIT = 4;
  var RECENT_LIMIT = 10;

  // 索引：别名（小写）→ food 对象
  var ALIAS = new Map();
  var FOOD_BY_ID = new Map();
  // 中文索引单独一份（键为中文词），供中文查询走同一套分层匹配
  var ALIAS_ZH = new Map();

  // 数据全局引用（浏览器由 data.js 挂到 window；Node 测试环境回退到 require）
  var FOODS_REF = (typeof FOODS !== 'undefined') ? FOODS
    : (typeof window !== 'undefined' && window.FOODS) ? window.FOODS : null;
  var SOURCES_REF = (typeof SOURCES !== 'undefined') ? SOURCES
    : (typeof window !== 'undefined' && window.SOURCES) ? window.SOURCES : null;
  var LEVEL_META_REF = (typeof LEVEL_META !== 'undefined') ? LEVEL_META
    : (typeof window !== 'undefined' && window.LEVEL_META) ? window.LEVEL_META : null;
  var CATEGORY_META_REF = (typeof CATEGORY_META !== 'undefined') ? CATEGORY_META
    : (typeof window !== 'undefined' && window.CATEGORY_META) ? window.CATEGORY_META : null;
  // 特征引导枚举与候选图标（data.js / i18n.js 提供；Node 测试环境回退 require）
  var TRAITS_ENUM_REF = (typeof TRAITS_ENUM !== 'undefined') ? TRAITS_ENUM
    : (typeof window !== 'undefined' && window.TRAITS_ENUM) ? window.TRAITS_ENUM : null;
  var TRAITS_LABELS_REF = (typeof TRAITS !== 'undefined') ? TRAITS
    : (typeof window !== 'undefined' && window.TRAITS) ? window.TRAITS : null;
  var FOOD_EMOJI_REF = (typeof FOOD_EMOJI !== 'undefined') ? FOOD_EMOJI
    : (typeof window !== 'undefined' && window.FOOD_EMOJI) ? window.FOOD_EMOJI : {};

  var state = {
    query: '',
    suggestions: [],   // 当前联想候选（food 数组，≤8）
    activeIndex: -1,   // 键盘高亮联想项
    result: null,      // 当前命中结果
    compare: [],       // food id 数组，≤4
    emergencyOpen: false,
    // 特征引导（Guided ID）状态机：step ∈ {1,2,3}
    identify: { open: false, step: 1, category: null, features: {}, candidates: null }
  };

  /* ==========================================================================
   * 1. 索引构建（启动时一次）
   * ----------------------------------------------------------------------------
   * 英文索引：id / name / aliases（小写化）。
   * 中文索引：nameZh / aliasesZh（原样，中文无大小写），另附 level 兜底短语。
   * 两套索引共用同一套分层匹配算法（精确 → 词边界 → UNKNOWN）。
   * ========================================================================*/
  function buildIndex(foods) {
    ALIAS = new Map();
    FOOD_BY_ID = new Map();
    ALIAS_ZH = new Map();
    foods.forEach(function (food) {
      FOOD_BY_ID.set(food.id, food);
      // 英文注册顺序：id 优先（让 slug 可直查，如 "lemons-limes"），再 name，再 aliases
      var terms = [food.id, food.name.toLowerCase()].concat(food.aliases || []);
      terms.forEach(function (t) {
        var key = String(t).toLowerCase().trim();
        if (key && !ALIAS.has(key)) ALIAS.set(key, food); // 先注册者优先
      });
      // 中文注册：nameZh 优先，再 nameZh 的“短名”（括号前主名）、再 aliasesZh。
      // 括号补充说明（如「牛油果（鳄梨）」）另注册为别名，保证主名与全名都能命中。
      var zhTerms = [];
      if (food.nameZh) {
        zhTerms.push(food.nameZh);
        var shortZh = String(food.nameZh).split(/[（(]/)[0].trim();
        if (shortZh && shortZh !== food.nameZh) zhTerms.push(shortZh);
        // 括号内的俗称也注册（如「牛油果（鳄梨）」的「鳄梨」）
        var m = String(food.nameZh).match(/[（(]([^）)]+)[）)]/);
        if (m && m[1]) zhTerms.push(m[1].trim());
      }
      zhTerms = zhTerms.concat(food.aliasesZh || []);
      zhTerms.forEach(function (term) {
        if (term === undefined || term === null) return;
        var key = String(term).trim();
        if (key && !ALIAS_ZH.has(key)) ALIAS_ZH.set(key, food);
        // 同时注册归一化后的形态，保证带括号/标点的输出去括号后仍可命中
        var normKey = normalize(key);
        if (normKey && !ALIAS_ZH.has(normKey)) ALIAS_ZH.set(normKey, food);
      });
    });
  }

  // 按当前语言选择要匹配的索引
  function activeIndex() { return lang === 'zh' ? ALIAS_ZH : ALIAS; }

  /* ==========================================================================
   * 2. 输入归一化（与设计书 §5 一致；中文保留 CJK 字符）
   * ----------------------------------------------------------------------------
   * 英文：小写、去前后缀问句、去标点、保留连字符以支持 ID 直查。
   * 中文：**保留 CJK 字符**（否则中文查询会被全部抹成空格而永远 UNKNOWN）；
   *       同样去除“狗狗能吃/能吃/能吃吗”等中文问句前后缀。
   * 安全：仍然剥离 < > " ' ( ) 等 HTML 危险字符，XSS 防护不因中文放宽。
   * ========================================================================*/
  function normalize(raw) {
    if (raw == null) return '';
    var s = String(raw).toLowerCase().trim();
    s = s.slice(0, 80); // 硬截断到 80
    // 关键：保留 拉丁字母 / 空格 / 连字符 / CJK 统一表意文字（含扩展 A）。
    // 数字与其余字符（含 < > " ' ( ) 等危险字符）一律替为空格，杜绝 XSS，并保持
    // “纯数字/纯符号”输入归一后为空 → 走空态（与旧行为一致）。
    s = s.replace(/[^a-z\s\-\u3400-\u4dbf\u4e00-\u9fff]/g, ' ');
    // 英文问句前后缀剥离
    s = s.replace(/^(my dog ate|dog ate|dogs ate|can dogs eat|can my dog eat|is)\s+/, '');
    s = s.replace(/\s+(safe|toxic|bad|ok|okay|good|bad for dogs)$/, '');
    // 中文问句前后缀剥离（"狗狗能吃X吗" / "狗能吃X吗" / "狗可以吃X" / "X能吃吗"）
    s = s.replace(/^(狗|狗狗|小狗|猫|猫咪)?(能|可以|可)?吃(不吃|不)?/, '');
    s = s.replace(/^(能不能吃|能吃吗|可以吃吗)/, '');
    // 剥离句尾疑问词与“安全吗/有毒吗/能喂吗”等
    s = s.replace(/(能吃吗|可以吃吗|安全吗|有毒吗|能喂吗|可以喂吗|能喝吗|能吃|能吃么|可以吃|吗|呢|么)[\s]*$/, '');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  /* ==========================================================================
   * 3. 匹配漏斗 —— 匹配策略（供 search 与联想共用）
   * ----------------------------------------------------------------------------
   * 背景（测试报告 P1-①/②、P2-③/④ 的共同根因）：
   *   旧逻辑对别名做「无约束前缀 / 子串匹配」，于是任何短通用词只要碰巧是某个
   *   长别名的子串/前缀，就会被判成那条食物：
   *     sugar  ⊂ sugar-free            -> 误判 Xylitol (SEVERE)
   *     salt   ⊂ salted almonds        -> 误判 Almonds (CAUTION)
   *     water  = 前缀 of watermelon    -> 误判 Watermelon (SAFE)
   *     chocolate ⊂ white-chocolate    -> 误判 Chocolate (TOXIC)
   *
   * 策略（判定漏斗 search()，逐级从严；前缀/子串补全只保留给联想 suggest()）：
   *   ① 精确匹配   ALIAS.has(s)                 —— 整串等价，最高优先（ID 直查靠此，
   *      含连字符 slug 如 "lemons-limes"）。
   *   ② 词边界匹配 findByBoundary(sp)           —— 按「词」而非「字符」相等；
   *      "salt" 不会命中 "salted almonds"（salted≠salt），但整串 "salted almonds" 仍命中。
   *   ③ 不分词/不前缀：判定环节刻意不做字符前缀补全（"water" 是 "watermelon" 前缀，
   *      补全会把「水」判成「西瓜」），未命中即 UNKNOWN，符合「绝不猜测等级」纪律。
   *   ④ 分词       遍历完整词精确查（cooked chicken > chicken）。
   *   ⑤ 木糖醇兜底 R1 命中的触发短语（如裸 "sugarfree"）即使不在别名表，也强制落木糖醇卡。
   *   ⑥ 兜底       UNKNOWN（绝不猜测等级）。
   *   前缀/子串 findByAlphaPrefix / findBySubstring —— **仅**供联想 suggest() 召回，
   *   不进判定；子串另加词边界约束（否则下拉里输入 "salt" 会冒出 Almonds 候选）。
   *   连字符等价化：normalize 保留连字符以支持 ID 直查，判定前另做一次
   *   hyphenSpace()（连字符→空格），使 "white-chocolate" ≡ "white chocolate"（P2-④）。
   * ========================================================================*/

  // 把 key 拆成“连字符/空格/CJK 边界”分隔的段，用于判定词边界。
  // 中文：整串视为一个「词段」（CJK 不按空格分词），从而整串精确/包含判定；
  //       ASCII 部分仍按非字母数字分隔，保留英文词边界语义。
  function keySegments(key) {
    // 在 CJK 字符周围补空格，使 CJK 连写与 ASCII 词段被分别切开
    var spaced = String(key).replace(/([\u3400-\u4dbf\u4e00-\u9fff])/g, ' $1 ');
    return spaced.split(/[^a-z0-9\u3400-\u4dbf\u4e00-\u9fff]+/).filter(Boolean);
  }

  // 词边界匹配：要求 key 的每个词段都能在「输入 s 或输入的某词段的开头」以完整词出现。
  //   输入 "salt"          -> 命中 salt、salted、salt-free 等以 salt 开头的词段（仍安全，不选具体食物）；
  //                           但 "salted almonds" 的 almonds 不在输入里 → 排除。
  //   输入 "salted almonds" -> salt 与 almonds 两段都在 → 命中整条。
  //   输入 "white chocolate"-> 命中 chocolate 与 white-chocolate 两条（多候选）。
  // 中文：CJK 词段按「整段相等」判定（不做字符前缀），避免「葡萄」误命中「葡萄干」的字母前缀式放宽。
  function findByBoundary(s) {
    var sWords = keySegments(s);
    var idx = activeIndex();
    var out = [];
    idx.forEach(function (food, key) {
      var kWords = keySegments(key);
      var hit = kWords.length > 0 && kWords.every(function (kw) {
        return sWords.some(function (sw) { return sw.indexOf(kw) === 0; });
      });
      if (hit && out.indexOf(food) === -1) out.push(food);
    });
    return out;
  }

  // 前缀召回（**仅供联想 suggest()**，判定漏斗不再使用）。
  // 英文：收录所有以 s 字符级开头的 key（宽泛召回）。
  // 中文：CJK 不做字符级前缀（否则「葡萄」会召回「葡萄干」），改为「包含子串」召回。
  function findByAlphaPrefix(s) {
    var idx = activeIndex();
    var isCJK = /[\u3400-\u4dbf\u4e00-\u9fff]/.test(s);
    if (isCJK) {
      var outC = [];
      idx.forEach(function (food, key) {
        if (key.indexOf(s) !== -1 && outC.indexOf(food) === -1) outC.push(food);
      });
      return outC;
    }
    if (/[-\s]/.test(s)) return [];                    // 含连字符/空格交给词边界处理
    if (s.length < 1) return [];
    var out = [];
    idx.forEach(function (food, key) {
      if (key.indexOf(s) === 0 && out.indexOf(food) === -1) out.push(food);
    });
    return out;
  }

  // 联想召回用：子串匹配，但要求命中处处于词边界（前后非字母数字、非 CJK）。
  // 输入 "choco" 能召回 "chocolate bar"；但输入 "salt" 不会在 "salted almonds" 中间命中。
  // 中文：CJK 相邻字符不视为边界（把整条中文看作一个词），因此「葡萄」不会在「葡萄干」
  //       中间命中；但整串「葡萄干」可命中。
  function findBySubstring(s) {
    var idx = activeIndex();
    var out = [];
    var boundaryChar = function (ch) { return ch === '' || !/[a-z0-9\u3400-\u4dbf\u4e00-\u9fff]/.test(ch); };
    idx.forEach(function (food, key) {
      var i = key.indexOf(s);
      if (i === -1) return;
      var before = i === 0 ? '' : key.charAt(i - 1);
      var after = key.charAt(i + s.length);
      var wordBoundary = boundaryChar(before) && boundaryChar(after);
      if (!wordBoundary) {
        // 中文整词包含：若查询与 key 均为纯中文且 s 是 key 的子串，则允许整词包含命中
        if (/^[\u3400-\u4dbf\u4e00-\u9fff]+$/.test(s) &&
            /^[\u3400-\u4dbf\u4e00-\u9fff]+$/.test(key)) {
          wordBoundary = true;
        }
      }
      if (wordBoundary && out.indexOf(food) === -1) out.push(food);
    });
    return out;
  }

  // 连字符/空格等价化（P2-④）：normalize 保留连字符以支持 ID 直查（如 "lemons-limes"），
  // 但用户把 "white chocolate" 写成 "white-chocolate" 时应等价。判定漏斗前先把
  // 连字符视作空格，这样 "white-chocolate" 能命中别名 "white chocolate"。归一化本身
  // 不改写连字符，ID 直查（含连字符的 slug）依旧原样可命中。
  function hyphenSpace(s) { return s.replace(/-/g, ' ').replace(/\s+/g, ' ').trim(); }

  function sortByPopularity(foods) {
    return foods.slice().sort(function (a, b) {
      var ai = POPULAR.indexOf(a.id);
      var bi = POPULAR.indexOf(b.id);
      if (ai === -1) ai = 999;
      if (bi === -1) bi = 999;
      if (ai !== bi) return ai - bi;
      // 否则按等级危险度降序（更危险的先显示）
      return LEVEL_META_REF[b.level].order - LEVEL_META_REF[a.level].order;
    });
  }

  /* ==========================================================================
   * 4. 主查询（设计书 §5 伪代码逐条落地；中文场景复用同一套分层漏斗）
   * ----------------------------------------------------------------------------
   * 中文硬规则（务必在中文输入下同样生效）：
   *   R1  木糖醇：输入含「木糖醇 / 桦木糖 / 无糖口香糖 / 无糖糖果 / 代糖」→ 强制 SEVERE 警示。
   *   R2  巧克力分级：「黑巧克力/苦巧克力/烘焙巧克力/可可粉/半甜巧克力」→ SEVERE（dark 条）；
   *       「白巧克力」→ CAUTION；其余含「巧克力」→ TOXIC（默认）。
   *   R3  生食并列：输入含「生」+（肉/鸡/鱼/三文鱼/蛋/猪）→ 多候选并列。
   *   通用词保守：「盐」不得命中「夏威夷果」等下挂词；未命中一律 UNKNOWN，绝不猜等级。
   * ========================================================================*/

  // 语言包：硬规则的触发词集合（英文/中文各一套）
  var EN_PACK = {
    xylitol: /(^|\s)sugar[\s-]?free|\bxylitol\b|birch sugar/,
    chocDark: /dark|bitter|baker|baking|cocoa|semisweet|semi-sweet/,
    chocWhite: /white\s*choc/,
    chocGeneric: /\bchoc\b|chocolate/,
    rawMod: /\braw\b/,
    rawItems: /\b(chicken|egg|fish|meat|salmon|pork)\b/
  };
  var ZH_PACK = {
    xylitol: /木糖醇|桦木糖|桦糖|无糖口香糖|无糖糖果|代糖|无糖薄荷/,
    chocDark: /黑巧克力|苦巧克力|烘焙巧克力|可可粉|半甜巧克力|可可/,
    chocWhite: /白巧克力/,
    chocGeneric: /巧克力/,
    rawMod: /生/,
    rawItems: /肉|鸡|鱼|三文鱼|蛋|猪/
  };

  function search(raw) {
    var s = normalize(raw);
    var out = { exact: null, multi: null, unknown: false, xylitolAlert: false, note: null, query: raw };
    var idx = activeIndex();

    if (!s) return { empty: true, xylitolAlert: false, query: raw };

    var pack = langPack();
    var sp = hyphenSpace(s);

    // 规则 R1：木糖醇强制警示（EN/ZH 触发词）
    if (pack.xylitol.test(s)) out.xylitolAlert = true;

    // 规则 R2：巧克力子类型分级（EN/ZH）
    // 注意（P2-④）：R2 在连字符等价化后的 sp 上匹配，使 "white-chocolate" ≡ "white chocolate"。
    if (pack.chocDark.test(sp)) {
      out.exact = lookup('dark-chocolate');
      if (out.exact) return out;
    }
    if (pack.chocWhite.test(sp)) {
      out.exact = lookup('white-chocolate');
      if (out.exact) return out;
    }
    // 精确别名优先于“泛 chocolate”兜底规则：像 "chocolate spread" / 「榛子巧克力酱」这类更具体的
    // 别名，不应被泛规则截胡。子类型（dark/white）已在上方优先返回。
    if (!idx.has(s) && !idx.has(sp) && pack.chocGeneric.test(sp)) {
      out.exact = lookup('chocolate');
      if (out.exact) return out;
    }

    // 规则 R3：raw 修饰词（EN/ZH）—— 生鸡肉/生鱼等并列提示细菌/寄生虫风险，仅英文索引有效
    if (lang === 'en' && pack.rawMod.test(sp) && pack.rawItems.test(sp)) {
      var a = lookup('raw-meat');
      var b = lookup('salmon');
      var list = [a, b].filter(Boolean);
      out.multi = sortByPopularity(list.filter(function (f, i, arr) { return arr.indexOf(f) === i; }));
      return out;
    }

    // 规则 R4：匹配漏斗（精确 → 词边界 → 分词）
    // ① 精确匹配（最高优先）：整串等价。
    if (idx.has(s)) { out.exact = idx.get(s); return out; }

    // ② 词边界匹配：按「词」而非「字符」相等，杜绝短通用词误命中长别名。
    if (idx.has(sp)) { out.exact = idx.get(sp); return out; }
    var cands = findByBoundary(sp);
    if (cands.length === 1) { out.exact = cands[0]; return out; }
    if (cands.length > 1) { out.multi = sortByPopularity(cands); return out; }

    // ③ 判定漏斗不做「前缀补全」（"water" 是 "watermelon" 前缀，补全会把「水」判成「西瓜」）。
    //    中文同理：「葡萄」不做字符前缀补全，避免命中「葡萄干」的误放宽。

    // ④ 分词：整个输入未命中时，取完整词逐个精确查（如 "cooked chicken" > chicken）。
    var tokens = s.split(' ');
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i] && idx.has(tokens[i])) {
        out.exact = idx.get(tokens[i]);
        out.note = t('search.matchedPart');
        return out;
      }
    }

    // ⑤ 木糖醇强制兜底（R1 叠加）：即便输入的“裸形”不在别名表里，也必须落到木糖醇 SEVERE 卡。
    if (out.xylitolAlert) {
      out.exact = lookup('xylitol');
      out.note = t('search.matchedPart');
      return out;
    }

    // ⑥ 兜底：未收录 —— 绝不猜测等级
    out.unknown = true;
    return out;
  }

  // lookup：优先按当前语言索引查（如 'dark-chocolate' id 在两种语言下都能命中，
  // 因为英文 id 作为 key 也存在于 EN；R2 用 id 直查，与语言无关）。
  function lookup(term) {
    var key = String(term).toLowerCase().trim();
    // id 直查始终走英文索引（id 是语言无关的 slug）
    if (ALIAS.has(key)) return ALIAS.get(key);
    if (ALIAS_ZH.has(String(term).trim())) return ALIAS_ZH.get(String(term).trim());
    return null;
  }

  // 联想：与 search 的匹配引擎同源，取前 8
  // 注意：suggest 只用于「下拉候选」，不做判定，保留子串召回以支持输入中段词（如 "choco"）。
  // 但子串已加词边界约束（findBySubstring），避免 "salt" 在下拉里冒出 "salted almonds" 这类误导候选。
  function suggest(raw) {
    var s = normalize(raw);
    if (!s) return [];
    var idx = activeIndex();
    var out = [];
    var seen = new Set();
    function push(list) {
      for (var i = 0; i < list.length && out.length < SUGGEST_LIMIT; i++) {
        if (!seen.has(list[i].id)) { seen.add(list[i].id); out.push(list[i]); }
      }
    }
    // 精确命中优先放最前（含连字符等价归一）
    if (idx.has(s)) { seen.add(idx.get(s).id); out.push(idx.get(s)); }
    var sp = hyphenSpace(s);
    if (idx.has(sp) && !seen.has(idx.get(sp).id)) { seen.add(idx.get(sp).id); out.push(idx.get(sp)); }
    push(sortByPopularity(findByAlphaPrefix(s)));
    push(sortByPopularity(findByBoundary(sp)));
    push(sortByPopularity(findBySubstring(s)));
    return out.slice(0, SUGGEST_LIMIT);
  }

  /* ==========================================================================
   * 5. DOM 工具（全部 textContent 安全路径）
   * ========================================================================*/
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text); // 安全
    return node;
  }

  function clear(node) { if (!node) return; while (node.firstChild) node.removeChild(node.firstChild); }

  function badgeClass(level) { return 'badge--' + level; }

  // 生成等级徽章（色块 + 图标 + 文字）
  function levelBadge(level, opts) {
    opts = opts || {};
    var meta = LEVEL_META_REF[level];
    var b = el('span', 'level-badge ' + badgeClass(level));
    var icon = el('span', 'icon', meta.icon);
    icon.setAttribute('aria-hidden', 'true');
    b.appendChild(icon);
    b.appendChild(el('span', 'text', levelLabel(level, false)));
    return b;
  }

  // 生成来源外链列表
  function sourcesBlock(sourceIds) {
    var box = el('div', 'card-sources');
    box.appendChild(el('span', null, t('card.sources')));
    var ul = el('ul');
    (sourceIds || []).forEach(function (sid) {
      if (!SOURCES_REF[sid]) return;
      var src = SOURCES_REF[sid];
      var li = el('li');
      var a = el('a', 'src-link', src.org);
      a.href = src.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';   // 安全外链
      a.title = src.title;
      li.appendChild(a);
      ul.appendChild(li);
    });
    box.appendChild(ul);
    return box;
  }

  // 通用免责行
  function disclaimerLine() {
    var p = el('p', 'card-disclaimer');
    p.appendChild(document.createTextNode(t('card.disclaimer') + ' '));
    var a = el('a', null, t('card.disclaimerLink'));
    a.href = '#disclaimer-full';
    p.appendChild(a);
    p.appendChild(document.createTextNode('.'));
    return p;
  }

  // 紧急横幅（卡内）
  function emergencyBlock(emergencyText, level) {
    var box = el('div', 'card-emergency');
    box.appendChild(el('h3', null, level === 'severe' ? t('card.emergencyTitleSevere') : t('card.emergencyTitleNormal')));
    box.appendChild(el('p', null, emergencyText));
    var hot = el('p', 'hotlines', emergencyLine());
    box.appendChild(hot);
    box.appendChild(el('p', null, t('card.emergencyNoVomit')));
    return box;
  }

  // 症状/建议文本转列表：英文按分号切分；中文按分号/中文逗号切分（无分号则不拆）
  function toList(text) {
    if (!text) return null;
    var parts = String(text).split(/[;；]\s*/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (parts.length <= 1) return null;
    var ul = el('ul');
    parts.forEach(function (p) { ul.appendChild(el('li', null, p)); });
    return ul;
  }

  /* ==========================================================================
   * 6. 渲染：结果卡
   * ========================================================================*/
  function renderEmptyCard() {
    var box = el('div', 'result-empty');
    var p = el('p');
    p.appendChild(el('strong', null, t('card.emptyStrong')));
    box.appendChild(p);
    box.appendChild(el('p', null, t('card.emptySub')));
    return box;
  }

  function renderCard(food, opts) {
    opts = opts || {};
    var card = el('div', 'card card--' + food.level + ' card-anim');

    // SEVERE 卡顶紧急横幅
    if (food.level === 'severe') {
      var b = el('div', 'severe-banner');
      var ic = el('span', 'icon', '☠'); ic.setAttribute('aria-hidden', 'true');
      b.appendChild(ic);
      b.appendChild(document.createTextNode(' ' + t('card.severeBanner')));
      card.appendChild(b);
    }
    if (food.level === 'toxic') {
      var b2 = el('div', 'severe-banner');
      b2.style.background = 'var(--c-toxic)';
      var ic2 = el('span', 'icon', '✕'); ic2.setAttribute('aria-hidden', 'true');
      b2.appendChild(ic2);
      b2.appendChild(document.createTextNode(' ' + t('card.toxicBanner')));
      card.appendChild(b2);
    }

    var head = el('div', 'card-head');
    head.appendChild(levelBadge(food.level));
    var h2 = el('h2', 'card-title', fName(food));
    h2.id = 'result-name';
    if (opts.echo && opts.echo !== fName(food)) {
      var echo = el('span', 'echo', t('card.yourSearch', { q: opts.echo }));
      h2.appendChild(echo);
    }
    head.appendChild(h2);
    card.appendChild(head);

    var body = el('div', 'card-body');

    // 原因
    var reasonBlock = el('div', 'card-block');
    reasonBlock.appendChild(el('h3', null, t('card.why')));
    reasonBlock.appendChild(el('p', null, fReason(food)));
    body.appendChild(reasonBlock);

    // 症状
    var sympBlock = el('div', 'card-block');
    sympBlock.appendChild(el('h3', null, t('card.symptoms')));
    var sympText = fSymptoms(food);
    var sympList = toList(sympText);
    sympBlock.appendChild(sympList || el('p', null, sympText));
    body.appendChild(sympBlock);

    // 应对建议
    var advBlock = el('div', 'card-block');
    advBlock.appendChild(el('h3', null, t('card.whatToDo')));
    var advText = fAdvice(food);
    var advList = toList(advText);
    advBlock.appendChild(advList || el('p', null, advText));
    body.appendChild(advBlock);

    // 剂量备注
    var doseText = fDosage(food);
    if (doseText) {
      var dose = el('div', 'dosage-note');
      dose.appendChild(el('strong', null, t('card.doseNote')));
      dose.appendChild(document.createTextNode(doseText));
      body.appendChild(dose);
    }

    // 紧急处理（toxic / severe）
    if (food.emergency && (food.level === 'toxic' || food.level === 'severe')) {
      body.appendChild(emergencyBlock(fEmergency(food), food.level));
    }

    // 详情展开（折叠展示别名与分类）
    var details = el('details', 'card-details');
    details.appendChild(el('summary', null, t('card.more')));
    var dBody = el('div');
    var aliasSource = (lang === 'zh')
      ? [(food.nameZh || food.name)].concat(food.aliasesZh || [])
      : (food.aliases || []);
    dBody.appendChild(el('p', null, t('card.categoryLine', {
      cat: catLabel(food.category),
      aliases: aliasSource.join(lang === 'zh' ? '、' : ', ')
    })));
    // 安全等级完整说明
    dBody.appendChild(el('p', null, t('card.verdictLevel', { level: levelLabel(food.level, true) })));
    details.appendChild(dBody);
    body.appendChild(details);

    // 来源
    body.appendChild(sourcesBlock(food.sources));

    // 操作
    var actions = el('div', 'card-actions');
    var addBtn = el('button', 'btn btn--primary', t('card.addCompare'));
    addBtn.type = 'button';
    addBtn.setAttribute('data-add-compare', food.id);
    actions.appendChild(addBtn);

    var emergBtn = el('button', 'btn btn--danger', t('card.emergencySteps'));
    emergBtn.type = 'button';
    emergBtn.setAttribute('data-emergency-jump', '1');
    actions.appendChild(emergBtn);
    body.appendChild(actions);

    // 免责行
    body.appendChild(disclaimerLine());

    card.appendChild(body);
    return card;
  }

  function renderXylitolAlert() {
    var box = el('div', 'xylitol-alert');
    box.appendChild(el('h3', null, t('xyl.title')));
    box.appendChild(el('p', null, t('xyl.body')));
    box.appendChild(el('p', 'hotlines', emergencyLine()));
    box.appendChild(el('p', null, t('xyl.noVomit')));
    var a = el('button', 'btn btn--danger', t('xyl.button'));
    a.type = 'button';
    a.setAttribute('data-open', 'xylitol');
    box.appendChild(a);
    return box;
  }

  function renderUnknownCard(query) {
    var card = el('div', 'card card--unknown card-anim');
    var head = el('div', 'card-head');

    var b = el('span', 'level-badge badge--unknown');
    var ic = el('span', 'icon', '?'); ic.setAttribute('aria-hidden', 'true');
    b.appendChild(ic);
    b.appendChild(el('span', 'text', t('unknown.badge')));
    head.appendChild(b);

    var h2 = el('h2', 'card-title', t('unknown.title'));
    head.appendChild(h2);
    card.appendChild(head);

    var body = el('div', 'card-body');
    var note = el('div', 'unknown-note');
    note.appendChild(el('strong', null, t('unknown.text')));
    note.appendChild(el('p', null, t('unknown.rules')));
    if (query) note.appendChild(el('p', null, t('unknown.searched', { q: query })));
    body.appendChild(note);

    body.appendChild(el('p', null, t('unknown.neverGuess')));

    var emerg = emergencyBlock(t('unknown.emergency'), 'toxic');
    body.appendChild(emerg);

    body.appendChild(disclaimerLine());
    card.appendChild(body);
    return card;
  }

  function renderMultiCard(multi, query) {
    var card = el('div', 'card card--moderation card-anim');
    var head = el('div', 'card-head');
    var h2 = el('h2', 'card-title', t('multi.title'));
    h2.id = 'result-name';
    head.appendChild(h2);
    head.appendChild(el('p', null, query
      ? t('multi.introFor', { q: query })
      : t('multi.intro') + '. ' + t('multi.pick')));
    card.appendChild(head);

    var body = el('div', 'card-body');
    var ul = el('ul', 'candidate-list');
    multi.slice(0, SUGGEST_LIMIT).forEach(function (food) {
      var li = el('li');
      var btn = el('button');
      btn.type = 'button';
      btn.setAttribute('data-open', food.id);
      var nameSpan = el('span', 'suggest-name', fName(food));
      btn.appendChild(nameSpan);
      var lb = el('span', 'suggest-level ' + badgeClass(food.level), levelLabel(food.level, true));
      btn.appendChild(lb);
      li.appendChild(btn);
      ul.appendChild(li);
    });
    body.appendChild(ul);
    body.appendChild(disclaimerLine());
    card.appendChild(body);
    return card;
  }

  // 主渲染派发
  function renderResult(result) {
    var container = $('#result-card');
    clear(container);
    container.className = 'result-card';

    // 木糖醇警示置顶（R1）
    if (result.xylitolAlert) {
      container.appendChild(renderXylitolAlert());
    }

    if (result.empty) {
      container.appendChild(renderEmptyCard());
      setLive(container, 'polite');
      return;
    }
    if (result.exact) {
      var card = renderCard(result.exact, { echo: result.query });
      if (result.note) {
        var note = el('p', 'search-hint', t('search.notePrefix') + result.note);
        card.insertBefore(note, card.firstChild);
      }
      container.appendChild(card);
      // toxic/severe → aria-live=assertive，并滚动到结果卡
      setLive(container, isUrgent(result.exact.level) ? 'assertive' : 'polite');
      scrollToResult();
      pushRecent(result.exact);
      return;
    }
    if (result.multi && result.multi.length) {
      container.appendChild(renderMultiCard(result.multi, result.query));
      setLive(container, 'polite');
      scrollToResult();
      return;
    }
    if (result.unknown) {
      container.appendChild(renderUnknownCard(result.query));
      setLive(container, 'polite');
      scrollToResult();
      return;
    }
    // 理论兜底
    container.appendChild(renderEmptyCard());
  }

  function isUrgent(level) { return level === 'toxic' || level === 'severe'; }

  function setLive(container, mode) {
    container.setAttribute('aria-live', mode);
  }

  function scrollToResult() {
    var section = $('#result-section');
    if (!section) return;
    var y = section.getBoundingClientRect().top + window.pageYOffset - 120;
    try { window.scrollTo({ top: y < 0 ? 0 : y, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, y); }
  }

  /* ==========================================================================
   * 7. 联想下拉渲染
   * ========================================================================*/
  function renderSuggest(list, rawQuery) {
    var ul = $('#suggest-list');
    clear(ul);
    state.suggestions = list;
    state.activeIndex = -1;

    if (!list.length) {
      if (rawQuery && normalize(rawQuery)) {
        var li0 = el('li', 'suggest-empty');
        li0.setAttribute('role', 'option');
        li0.setAttribute('aria-disabled', 'true');
        li0.textContent = t('search.noMatchSuggest');
        ul.appendChild(li0);
        showSuggest(true);
      } else {
        showSuggest(false);
      }
      return;
    }

    list.forEach(function (food, i) {
      var li = el('li');
      li.setAttribute('role', 'option');
      li.setAttribute('id', 'opt-' + i);
      li.setAttribute('data-index', String(i));
      li.setAttribute('data-food', food.id);

      var nameSpan = el('span', 'suggest-name');
      nameSpan.appendChild(highlight(fName(food), rawQuery));
      li.appendChild(nameSpan);

      var lb = el('span', 'suggest-level ' + badgeClass(food.level), levelLabel(food.level, true));
      li.appendChild(lb);

      ul.appendChild(li);
    });
    showSuggest(true);
  }

  // 高亮命中片段（安全：拆分为文本节点 + <strong>）
  function highlight(text, rawQuery) {
    var s = normalize(rawQuery);
    var frag = document.createDocumentFragment();
    if (!s) { frag.appendChild(document.createTextNode(text)); return frag; }
    var lower = text.toLowerCase();
    var idx = lower.indexOf(s);
    if (idx === -1) { frag.appendChild(document.createTextNode(text)); return frag; }
    frag.appendChild(document.createTextNode(text.slice(0, idx)));
    var strong = el('strong', null, text.slice(idx, idx + s.length));
    frag.appendChild(strong);
    frag.appendChild(document.createTextNode(text.slice(idx + s.length)));
    return frag;
  }

  function showSuggest(show) {
    var ul = $('#suggest-list');
    var input = $('#food-input');
    ul.hidden = !show;
    input.setAttribute('aria-expanded', show ? 'true' : 'false');
    if (!show) state.activeIndex = -1;
  }

  function setActive(index) {
    var ul = $('#suggest-list');
    var items = $all('li[data-index]', ul);
    if (!items.length) return;
    if (index < 0) index = items.length - 1;
    if (index >= items.length) index = 0;
    state.activeIndex = index;
    items.forEach(function (li, i) {
      li.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
    var input = $('#food-input');
    input.setAttribute('aria-activedescendant', items[index].id);
    items[index].scrollIntoView({ block: 'nearest' });
  }

  /* ==========================================================================
   * 8. 交互：搜索框
   * ========================================================================*/
  function doSearch(raw) {
    var result = search(raw);
    state.query = raw;
    state.result = result;
    renderResult(result);
    showSuggest(false);
    if (!result.empty && !result.multi && !result.unknown && result.exact && !result.multi) {
      // 单卡命中：把输入框回填为食物名，便于确认
      if (!$('#food-input').value) $('#food-input').value = fName(result.exact);
    }
  }

  var debounceTimer = null;
  function onInput(e) {
    var val = e.target.value;
    if (val.length > 80) { e.target.value = val.slice(0, 80); val = e.target.value; }
    state.query = val;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      renderSuggest(suggest(val), val);
    }, 80);
  }

  function onKeydown(e) {
    var ul = $('#suggest-list');
    var open = !ul.hidden;
    if (e.key === 'ArrowDown') {
      if (!open) { renderSuggest(suggest($('#food-input').value), $('#food-input').value); }
      else { e.preventDefault(); setActive(state.activeIndex + 1); }
    } else if (e.key === 'ArrowUp') {
      if (open) { e.preventDefault(); setActive(state.activeIndex - 1); }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && state.activeIndex >= 0) {
        var items = $all('li[data-index]', ul);
        var target = items[state.activeIndex];
        if (target) { openFood(target.getAttribute('data-food')); return; }
      }
      var raw = $('#food-input').value;
      if (!normalize(raw)) { shakeInput(); renderResult({ empty: true, xylitolAlert: false }); return; }
      doSearch(raw);
    } else if (e.key === 'Escape') {
      showSuggest(false);
    }
  }

  function shakeInput() {
    var input = $('#food-input');
    input.classList.remove('shake');
    // 触发重排以重启动画
    void input.offsetWidth;
    input.classList.add('shake');
    input.focus();
  }

  // 打开某食物（chips / 联想 / 候选 / 索引 / 对比卡 共用）
  function openFood(id) {
    var food = FOOD_BY_ID.get(id);
    if (!food) return;
    var input = $('#food-input');
    input.value = fName(food);
    state.query = fName(food);
    var result = { exact: food, xylitolAlert: false, query: fName(food) };
    state.result = result;
    renderResult(result);
    showSuggest(false);
    updateRoute(food.id);
    pushRecent(food);
  }

  /* ==========================================================================
   * 9. 快捷入口 / 索引 / FAQ 渲染
   * ========================================================================*/
  function renderChips() {
    var box = $('#quick-chips');
    clear(box);
    QUICK_CHIP_IDS.forEach(function (id) {
      var food = FOOD_BY_ID.get(id);
      if (!food) return;
      var btn = el('button', 'chip', fName(food));
      btn.type = 'button';
      btn.setAttribute('data-open', id);
      box.appendChild(btn);
    });
  }

  function renderCategoryNav() {
    var nav = $('#category-nav');
    clear(nav);
    CATEGORY_META_REF.forEach(function (cat) {
      var a = el('a', null, catLabel(cat.key));
      a.href = '#' + cat.anchor;
      a.setAttribute('data-anchor', cat.anchor);
      nav.appendChild(a);
    });
  }

  // 一行食物：名称 + 等级小徽章 + 一句话（可索引文本）
  function foodRow(food) {
    var btn = el('button', 'food-row');
    btn.type = 'button';
    btn.setAttribute('data-open', food.id);

    var lb = el('span', 'row-badge ' + badgeClass(food.level), levelLabel(food.level, true));
    btn.appendChild(lb);

    var txt = el('span', 'row-text');
    var name = el('span', 'row-name', fName(food));
    txt.appendChild(name);
    var line = el('span', 'row-line');
    line.textContent = levelLabel(food.level, true) + ': ' + firstSentence(fReason(food));
    txt.appendChild(line);
    btn.appendChild(txt);

    return btn;
  }

  function firstSentence(text) {
    if (!text) return '';
    // 中文：取到第一个句号/分号/换行为止；英文：取到第一个 '.'
    var zh = String(text).match(/^[^。；;\n]{1,80}[。；;]?/);
    if (zh && /[\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) return zh[0];
    var m = String(text).match(/^[^.]+\./);
    return m ? m[0] : String(text).slice(0, 140) + '…';
  }

  function renderBrowseIndex() {
    var box = $('#browse-index');
    clear(box);
    CATEGORY_META_REF.forEach(function (cat) {
      var section = el('section', 'cat-group');
      section.id = cat.anchor;
      var h3 = el('h3', null, catLabel(cat.key));
      h3.id = cat.anchor + '-heading';
      section.setAttribute('aria-labelledby', h3.id);
      section.appendChild(h3);

      FOODS.filter(function (f) { return f.category === cat.key; })
        .forEach(function (food) { section.appendChild(foodRow(food)); });

      box.appendChild(section);
    });
  }

  function renderFooterSources() {
    var ul = $('#footer-sources');
    clear(ul);
    Object.keys(SOURCES).forEach(function (sid) {
      var src = SOURCES_REF[sid];
      var li = el('li');
      var a = el('a', null, src.org + ' — ' + src.title);
      a.href = src.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      li.appendChild(a);
      ul.appendChild(li);
    });
  }

  /* ==========================================================================
   * 10. localStorage（try/catch 降级；仅存食物名/id）
   * ========================================================================*/
  var memRecent = [];
  var memCompare = [];

  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, val) {
    try { window.localStorage.setItem(key, val); return true; } catch (e) { return false; }
  }

  function pushRecent(food) {
    var list = readRecent();
    list = list.filter(function (x) { return x.id !== food.id; });
    list.unshift({ id: food.id, name: food.name, ts: Date.now() });
    list = list.slice(0, RECENT_LIMIT);
    memRecent = list;
    safeSet('cde_recent', JSON.stringify(list));
  }

  function readRecent() {
    var raw = safeGet('cde_recent');
    if (!raw) return memRecent.slice();
    try {
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return memRecent.slice(); }
  }

  function readCompare() {
    var raw = safeGet('cde_compare');
    if (!raw) return memCompare.slice();
    try {
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(0, COMPARE_LIMIT) : [];
    } catch (e) { return memCompare.slice(); }
  }

  function saveCompare(ids) {
    memCompare = ids.slice();
    safeSet('cde_compare', JSON.stringify(ids));
  }

  /* ==========================================================================
   * 11. 对比栏
   * ========================================================================*/
  function addToCompare(id) {
    if (!FOOD_BY_ID.has(id)) return;
    var list = readCompare();
    if (list.indexOf(id) !== -1) return;
    if (list.length >= COMPARE_LIMIT) {
      // 超出上限：移除最早的，加入最新
      list.shift();
    }
    list.push(id);
    saveCompare(list);
    renderCompare();
    flashCompare();
  }

  function removeFromCompare(id) {
    var list = readCompare().filter(function (x) { return x !== id; });
    saveCompare(list);
    renderCompare();
  }

  function renderCompare() {
    var ids = readCompare();
    var tray = $('#compare-tray');
    var grid = $('#compare-grid');
    clear(tray); clear(grid);

    ids.forEach(function (id) {
      var food = FOOD_BY_ID.get(id);
      if (!food) return;
      // tray chip
      var chip = el('span', 'tray-chip ' + badgeClass(food.level), fName(food));
      chip.style.background = 'var(--c-' + levelColorKey(food.level) + ')';
      var x = el('button', null, '×');
      x.type = 'button';
      x.setAttribute('data-remove-compare', id);
      x.setAttribute('aria-label', t('compare.remove', { name: fName(food) }));
      chip.appendChild(x);
      tray.appendChild(chip);

      // grid card
      var card = el('button', 'compare-card');
      card.type = 'button';
      card.setAttribute('data-open', id);
      card.style.borderTopColor = 'var(--c-' + levelColorKey(food.level) + ')';
      var badge = el('span', 'cc-badge', levelLabel(food.level, true));
      badge.style.background = 'var(--c-' + levelColorKey(food.level) + ')';
      card.appendChild(badge);
      card.appendChild(el('span', 'cc-name', fName(food)));
      card.appendChild(el('span', 'cc-line', firstSentence(fReason(food))));
      grid.appendChild(card);
    });
  }

  function levelColorKey(level) {
    return level === 'moderation' ? 'mod' : level;
  }

  function flashCompare() {
    var section = $('#compare-section');
    if (!section) return;
    try { section.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
  }

  /* ==========================================================================
   * 11.5 特征引导查询（Guided ID）—— 纯前端索引辅助，无图像识别/AI
   * ----------------------------------------------------------------------------
   * 目标：解决「用户不知道食物的英文名/中文名」的问题。
   * 纪律（硬约束）：
   *   - 只是「索引辅助」：命中的候选走既有 openFood() / renderCard()；未命中走
   *     renderUnknownCard() 保守卡。**绝不引入任何“猜测等级”的逻辑** —— 安全结论
   *     100% 来自核验过的 FOODS 数据。
   *   - 特征枚举唯一来源：data.js 的 TRAITS_ENUM（code+emoji）；标签唯一来源：
   *     i18n.js 的 TRAITS（EN/ZH）。此处不做任何硬编码标签。
   *   - 渲染全部走 textContent / createElement 安全路径。
   *   - 交互：向导式 step1→2→3，可返回上一步、可随时关闭；移动端优先。
   * ========================================================================*/

  // 特征标签（当前语言）——回退默认语言 → 最后回退 code，保证任何语言都有文案
  function traitLabel(group, code) {
    var set = TRAITS_LABELS_REF && TRAITS_LABELS_REF[lang] && TRAITS_LABELS_REF[lang][group];
    if (set && set[code]) return set[code];
    var fb = TRAITS_LABELS_REF && TRAITS_LABELS_REF[DEFAULT_LANG] && TRAITS_LABELS_REF[DEFAULT_LANG][group];
    if (fb && fb[code]) return fb[code];
    return code;
  }

  // 特征 code 的 emoji（data.js 枚举）；未知 code 回退空串
  function traitEmoji(group, code) {
    if (!TRAITS_ENUM_REF || !TRAITS_ENUM_REF[group]) return '';
    for (var i = 0; i < TRAITS_ENUM_REF[group].length; i++) {
      if (TRAITS_ENUM_REF[group][i].code === code) return TRAITS_ENUM_REF[group][i].emoji || '';
    }
    return '';
  }

  function foodEmoji(id) {
    return (FOOD_EMOJI_REF && FOOD_EMOJI_REF[id]) ? FOOD_EMOJI_REF[id] : '🍽';
  }

  // 特征过滤（纯函数，可被 selftest 直接调用）：
  //   大类相等 AND 每个已选分组内至少命中一个 code（分组之间为 AND，组内为 OR）。
  //   features 形如 { colors:[...], shapes:[...], extras:[...] }，缺省视为「不限」。
  function filterByTraits(foods, category, features) {
    features = features || {};
    return (foods || []).filter(function (f) {
      if (category && f.category !== category) return false;
      var groups = ['colors', 'shapes', 'extras'];
      for (var g = 0; g < groups.length; g++) {
        var want = features[groups[g]];
        if (!want || !want.length) continue;
        var have = (f.traits && f.traits[groups[g]]) || [];
        var hit = want.some(function (code) { return have.indexOf(code) !== -1; });
        if (!hit) return false;
      }
      return true;
    });
  }

  // 进入下一步时按「危险度降序 + 常见度」排序候选，让更需警惕的排在前
  function sortCandidates(list) {
    return list.slice().sort(function (a, b) {
      var d = LEVEL_META_REF[b.level].order - LEVEL_META_REF[a.level].order;
      if (d !== 0) return d;
      var ai = POPULAR.indexOf(a.id), bi = POPULAR.indexOf(b.id);
      if (ai === -1) ai = 999; if (bi === -1) bi = 999;
      if (ai !== bi) return ai - bi;
      return fName(a).localeCompare(fName(b));
    });
  }

  function identifyReset() {
    state.identify = { open: state.identify.open, step: 1, category: null, features: {}, candidates: null };
  }

  // 打开/关闭向导
  function openIdentify() {
    var overlay = $('#identify-overlay');
    if (!overlay) return;
    state.identify = { open: true, step: 1, category: null, features: {}, candidates: null };
    overlay.hidden = false;
    document.body.classList.add('identify-lock');
    var cta = $('#identify-open');
    if (cta) cta.setAttribute('aria-expanded', 'true');
    setRoute('#/identify');
    renderIdentify();
    focusIdentify();
  }

  function closeIdentify() {
    var overlay = $('#identify-overlay');
    if (!overlay) return;
    state.identify.open = false;
    overlay.hidden = true;
    document.body.classList.remove('identify-lock');
    var cta = $('#identify-open');
    if (cta) cta.setAttribute('aria-expanded', 'false');
    // 关闭后回到默认路由（若当前是 #/identify）
    if (window.location.hash === '#/identify') setRoute('#/');
    if (cta) { try { cta.focus(); } catch (e) {} }
  }

  function focusIdentify() {
    var panel = $('#identify-panel');
    if (!panel) return;
    var target = panel.querySelector('.chip--select[aria-pressed="true"]') ||
                 panel.querySelector('.identify-choice, .candidate-card, #identify-close');
    if (target) { try { target.focus(); } catch (e) {} }
  }

  function setRoute(hash) {
    try {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', hash);
      } else if (window.location.hash !== hash) {
        window.location.hash = hash;
      }
    } catch (e) { /* 忽略 */ }
  }

  // 主渲染派发：渲染 step 指示 + 主体 + 导航
  function renderIdentify() {
    var body = $('#identify-body');
    var nav = $('#identify-nav');
    var codeEl = $('#identify-stepcode');
    if (!body || !nav) return;
    clear(body); clear(nav);
    var st = state.identify;
    if (codeEl) codeEl.textContent = t('identify.code', { n: st.step });

    if (st.step === 1) renderIdentifyStep1(body);
    else if (st.step === 2) renderIdentifyStep2(body);
    else renderIdentifyStep3(body);

    renderIdentifyNav(nav, st.step);
  }

  // ---- step 1：选大类（单选）----
  function renderIdentifyStep1(body) {
    var card = el('div', 'identify-step');
    var h = el('h3', 'identify-step-title', t('identify.step1Title'));
    h.id = 'identify-step1-title';
    card.appendChild(h);
    card.appendChild(el('p', 'identify-step-hint', t('identify.step1Hint')));
    var group = el('div', 'chip-group');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-labelledby', 'identify-step1-title');
    CATEGORY_META_REF.forEach(function (cat) {
      var chip = el('button', 'chip chip--cat');
      chip.type = 'button';
      chip.setAttribute('data-identify-cat', cat.key);
      var selected = state.identify.category === cat.key;
      chip.setAttribute('aria-pressed', selected ? 'true' : 'false');
      if (selected) chip.classList.add('is-selected');
      chip.appendChild(el('span', 'chip-label', catLabel(cat.key)));
      chip.addEventListener('click', function () { pickCategory(cat.key); });
      group.appendChild(chip);
    });
    card.appendChild(group);
    body.appendChild(card);
  }

  function pickCategory(key) {
    state.identify.category = key;
    // 换大类时清空已选特征，避免跨类残留
    state.identify.features = {};
    state.identify.step = 2;
    renderIdentify();
  }

  // ---- step 2：选特征（多选，可跳过）----
  function renderIdentifyStep2(body) {
    var card = el('div', 'identify-step');
    var h = el('h3', 'identify-step-title', t('identify.step2Title'));
    h.id = 'identify-step2-title';
    card.appendChild(h);
    var hint = el('p', 'identify-step-hint', t('identify.step2Hint') + ' ');
    hint.appendChild(el('span', 'muted', '(' + t('identify.step2Optional') + ')'));
    card.appendChild(hint);

    var groups = [
      { key: 'colors', label: t('identify.groupColors') },
      { key: 'shapes', label: t('identify.groupShapes') },
      { key: 'extras', label: t('identify.groupExtras') }
    ];
    groups.forEach(function (grp) {
      if (!TRAITS_ENUM_REF || !TRAITS_ENUM_REF[grp.key]) return;
      var wrap = el('div', 'trait-group');
      var gh = el('h4', 'trait-group-title', grp.label);
      gh.id = 'identify-group-' + grp.key;
      wrap.appendChild(gh);
      var group = el('div', 'chip-group');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-labelledby', gh.id);
      TRAITS_ENUM_REF[grp.key].forEach(function (item) {
        var chip = el('button', 'chip chip--trait');
        chip.type = 'button';
        chip.setAttribute('data-identify-trait', grp.key + ':' + item.code);
        var selected = (state.identify.features[grp.key] || []).indexOf(item.code) !== -1;
        chip.setAttribute('aria-pressed', selected ? 'true' : 'false');
        if (selected) chip.classList.add('is-selected');
        if (item.emoji) {
          var ic = el('span', 'chip-emoji', item.emoji);
          ic.setAttribute('aria-hidden', 'true');
          chip.appendChild(ic);
        }
        chip.appendChild(el('span', 'chip-label', traitLabel(grp.key, item.code)));
        chip.addEventListener('click', function () { toggleTrait(grp.key, item.code, chip); });
        group.appendChild(chip);
      });
      wrap.appendChild(group);
      card.appendChild(wrap);
    });
    body.appendChild(card);
  }

  function toggleTrait(group, code, chip) {
    var sel = state.identify.features[group] || [];
    var i = sel.indexOf(code);
    if (i === -1) sel.push(code); else sel.splice(i, 1);
    state.identify.features[group] = sel;
    if (chip) {
      chip.setAttribute('aria-pressed', i === -1 ? 'true' : 'false');
      chip.classList.toggle('is-selected', i === -1);
    }
  }

  // 计算候选并按当前已选特征收敛到「大类过滤」或「大类+特征过滤」：
  //   有特征 → 按特征过滤；无特征 → 回退为「大类全部」（step3 展示）。
  //   候选过多时（>10）不展示大列表，而是提示「再选些特征」以逐步收敛。
  var CANDIDATE_MAX = 10;
  var CANDIDATE_MIN = 3;

  function computeCandidates() {
    var st = state.identify;
    var feats = st.features;
    var anyFeature = (feats.colors && feats.colors.length) ||
                     (feats.shapes && feats.shapes.length) ||
                     (feats.extras && feats.extras.length);
    var pool = filterByTraits(FOODS_REF, st.category, anyFeature ? feats : null);
    st.candidates = sortCandidates(pool);
    return st.candidates;
  }

  // ---- step 3：候选确认 ----
  function renderIdentifyStep3(body) {
    var st = state.identify;
    var list = st.candidates || computeCandidates();
    var card = el('div', 'identify-step');
    var h = el('h3', 'identify-step-title', t('identify.step3Title'));
    h.id = 'identify-step3-title';
    card.appendChild(h);

    // 已选特征回显（帮助用户理解筛选条件）
    var chipsLine = selectedTraitsLine();
    if (chipsLine) card.appendChild(chipsLine);

    if (list.length === 0) {
      // 兜底：候选为空 → 复用 UNKNOWN 保守卡 + 紧急就医指引（绝不猜等级）
      var empty = el('div', 'identify-empty');
      empty.appendChild(el('strong', null, t('identify.emptyTitle')));
      empty.appendChild(el('p', null, t('identify.emptyBody')));
      var act = el('button', 'btn', t('identify.emptyActions'));
      act.type = 'button';
      act.addEventListener('click', function () { goBackIdentify(); });
      empty.appendChild(act);
      card.appendChild(empty);
      // 复用现有的 UNKNOWN 保守卡（含 emergencyBlock + 免责 + ASPCA 热线）
      card.appendChild(renderUnknownCard(t('identify.step3Title')));
      body.appendChild(card);
      return;
    }

    if (list.length > CANDIDATE_MAX) {
      // 候选过多 → 引导用户回上一步多选特征收敛，不硬塞一个长列表
      card.appendChild(el('p', 'identify-step-hint', t('identify.resultCount', { n: list.length })));
      var more = el('button', 'btn btn--primary', t('identify.step2Title'));
      more.type = 'button';
      more.addEventListener('click', function () { state.identify.step = 2; renderIdentify(); });
      card.appendChild(more);
      body.appendChild(card);
      return;
    }

    card.appendChild(el('p', 'identify-step-hint',
      list.length === 1 ? t('identify.resultCountOne') : t('identify.resultCount', { n: list.length })));

    var grid = el('div', 'candidate-grid');
    list.forEach(function (food) { grid.appendChild(candidateCard(food)); });
    card.appendChild(grid);
    body.appendChild(card);
  }

  // 候选缩略卡：emoji + 食物名(EN+ZH) + 等级徽章；点击 → 进入既有判定流程
  function candidateCard(food) {
    var btn = el('button', 'candidate-card card--' + food.level);
    btn.type = 'button';
    btn.setAttribute('data-open', food.id);
    btn.setAttribute('aria-label', fName(food) + ' — ' + levelLabel(food.level, true));

    var emoji = el('span', 'candidate-emoji', foodEmoji(food.id));
    emoji.setAttribute('aria-hidden', 'true');
    btn.appendChild(emoji);

    var names = el('span', 'candidate-names');
    if (lang === 'zh') {
      // 中文界面：中文名在前、英文名在后（双语都显示，帮助对号）
      names.appendChild(el('span', 'candidate-name candidate-name--primary', food.nameZh || food.name));
      names.appendChild(el('span', 'candidate-name candidate-name--alt', food.name));
    } else {
      names.appendChild(el('span', 'candidate-name candidate-name--primary', food.name));
      if (food.nameZh) names.appendChild(el('span', 'candidate-name candidate-name--alt', food.nameZh));
    }
    btn.appendChild(names);

    var lb = el('span', 'candidate-badge badge--' + food.level, levelLabel(food.level, true));
    btn.appendChild(lb);
    return btn;
  }

  // 已选特征回显行（标签唯一来自 i18n）
  function selectedTraitsLine() {
    var feats = state.identify.features;
    var labels = [];
    [['colors', 'colors'], ['shapes', 'shapes'], ['extras', 'extras']].forEach(function (pair) {
      var g = pair[0];
      (feats[g] || []).forEach(function (code) {
        labels.push(traitLabel(g, code));
      });
    });
    if (!labels.length) return null;
    var p = el('p', 'identify-selected');
    p.appendChild(el('span', 'identify-selected-label', t('identify.showTraits', { traits: labels.join(' · ') })));
    return p;
  }

  // ---- 底部导航 ----
  function renderIdentifyNav(nav, step) {
    if (step > 1) {
      var back = el('button', 'btn', t('identify.back'));
      back.type = 'button';
      back.id = 'identify-back';
      back.addEventListener('click', function () { goBackIdentify(); });
      nav.appendChild(back);
    }
    if (step === 2) {
      var next = el('button', 'btn btn--primary', t('identify.skip') + ' ▸');
      next.id = 'identify-next';
      next.type = 'button';
      next.addEventListener('click', function () { gotoStep3(); });
      nav.appendChild(next);
    }
    var reset = el('button', 'btn btn--ghost', t('identify.reset'));
    reset.type = 'button';
    reset.addEventListener('click', function () { identifyReset(); renderIdentify(); });
    nav.appendChild(reset);
  }

  function goBackIdentify() {
    if (state.identify.step > 1) { state.identify.step -= 1; renderIdentify(); }
  }

  function gotoStep3() {
    var list = computeCandidates();
    state.identify.step = 3;
    renderIdentify();
    // 候选为空时把屏幕阅读器焦点移到兜底标题
    var body = $('#identify-body');
    if (body && (!list || list.length === 0)) {
      var target = body.querySelector('.identify-empty strong');
      if (target) { target.setAttribute('tabindex', '-1'); try { target.focus(); } catch (e) {} }
    }
  }

  // 供候选项点击时调用：关闭弹层 + 进入既有 openFood（安全结论来自 FOODS）
  function openFoodFromIdentify(id) {
    var food = FOOD_BY_ID.get(id);
    if (!food) return;
    closeIdentify();
    openFood(id);
  }


  /* ==========================================================================
   * 12. 路由（hash）：#/food/<id> · #/identify（特征引导）
   * ========================================================================*/
  function updateRoute(id) {
    setRoute(id ? '#/food/' + id : '#/');
  }

  function handleRoute() {
    var hash = window.location.hash || '';
    if (hash === '#/identify') {
      if (!state.identify.open) openIdentify();
      return true;
    }
    var m = hash.match(/^#\/food\/([a-z0-9-]+)/i);
    if (m) {
      var id = m[1].toLowerCase();
      var food = FOOD_BY_ID.get(id);
      if (food) { openFood(id); return true; }
      // 未知 id：保守未收录卡
      renderResult({ unknown: true, xylitolAlert: false, query: id });
      return true;
    }
    // 锚点导航（#cat-xxx / #emergency-banner / #disclaimer-full / #quick-chips 等）不拦截
    return false;
  }

  /* ==========================================================================
   * 13. 事件绑定（事件委托）
   * ========================================================================*/
  function bindEvents() {
    var input = $('#food-input');
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeydown);
    input.addEventListener('focus', function () {
      if (input.value) renderSuggest(suggest(input.value), input.value);
    });
    input.addEventListener('blur', function () {
      // 延迟以允许点击下拉项
      setTimeout(function () { showSuggest(false); }, 150);
    });

    var searchBtn = $('#search-btn');
    searchBtn.addEventListener('click', function () {
      var raw = input.value;
      if (!normalize(raw)) { shakeInput(); renderResult({ empty: true, xylitolAlert: false }); return; }
      doSearch(raw);
    });

    // ---- 特征引导（Guided ID）事件 ----
    var cta = $('#identify-open');
    if (cta) cta.addEventListener('click', openIdentify);
    var closeBtn = $('#identify-close');
    if (closeBtn) closeBtn.addEventListener('click', closeIdentify);
    var overlay = $('#identify-overlay');
    if (overlay) {
      // 点击遮罩空白处关闭（点击面板内部不关闭）
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeIdentify();
      });
    }
    // ESC 关闭向导
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.identify.open) { closeIdentify(); }
    });
    // 焦点圈定：Tab 循环在弹层内（简单的 focus trap）
    if (overlay) {
      overlay.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab' || !state.identify.open) return;
        var panel = $('#identify-panel');
        if (!panel) return;
        var focusables = $all('button, [href], input, [tabindex]:not([tabindex="-1"])', panel)
          .filter(function (n) { return n.offsetParent !== null; });
        if (!focusables.length) return;
        var first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && e.target === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && e.target === last) { e.preventDefault(); first.focus(); }
      });
    }

    // 全局委托：data-open / data-add-compare / data-remove-compare / data-emergency-jump
    document.addEventListener('click', function (e) {
      var t = e.target;

      var openBtn = t.closest && t.closest('[data-open]');
      if (openBtn) {
        // 向导内的候选卡：先关闭弹层再走既有判定流程
        if (openBtn.classList && openBtn.classList.contains('candidate-card')) {
          openFoodFromIdentify(openBtn.getAttribute('data-open'));
        } else {
          openFood(openBtn.getAttribute('data-open'));
        }
        return;
      }

      var addBtn = t.closest && t.closest('[data-add-compare]');
      if (addBtn) { addToCompare(addBtn.getAttribute('data-add-compare')); return; }

      var rmBtn = t.closest && t.closest('[data-remove-compare]');
      if (rmBtn) { removeFromCompare(rmBtn.getAttribute('data-remove-compare')); return; }

      var emergBtn = t.closest && t.closest('[data-emergency-jump]');
      if (emergBtn) {
        var banner = $('#emergency-banner');
        if (banner) {
          var d = banner.querySelector('details');
          if (d) d.open = true;
          banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }
    });

    // 联想项点击
    var ul = $('#suggest-list');
    ul.addEventListener('mousedown', function (e) {
      var li = e.target.closest && e.target.closest('li[data-food]');
      if (li) {
        e.preventDefault();
        openFood(li.getAttribute('data-food'));
      }
    });

    window.addEventListener('hashchange', function () {
      if (window.location.hash.indexOf('#/food/') === 0) handleRoute();
      else if (window.location.hash === '#/identify') { if (!state.identify.open) openIdentify(); }
      else if (state.identify.open) closeIdentify();
    });
  }

  /* ==========================================================================
   * 13.5 静态文案 i18n + 语言切换
   * ----------------------------------------------------------------------------
   * 静态 HTML 中的文案节点用 data-i18n / data-i18n-* 标注，切换语言时统一刷新：
   *   data-i18n="key"             -> textContent = t(key)
   *   data-i18n-html="key"        -> 分片重建（对含 <strong>/<a>/<ul> 的复合节点）
   *   data-i18n-placeholder       -> input.placeholder
   *   data-i18n-aria-label        -> aria-label
   * 动态内容（结果卡 / 对比栏 / 索引区 / chips）由 renderAll 重新渲染。
   * ========================================================================*/

  // 复合节点（含加粗/链接/列表）按 key 重建，全部走 createElement/textContent 安全路径
  function applyRichStatic() {
    // 页脚免责声明 1（含两个加粗片段）
    var el1 = document.querySelector('#d1');
    if (el1) {
      clear(el1);
      appendTemplated(el1, t('footer.disclaimer1', { strong1: '\u0000', strong2: '\u0001' }),
        { '\u0000': { tag: 'strong', text: t('footer.disclaimer1S1') },
          '\u0001': { tag: 'strong', text: t('footer.disclaimer1S2') } });
    }
    var el2 = q('#d2');
    if (el2) {
      clear(el2);
      appendTemplated(el2, t('footer.disclaimer2', { strong1: '\u0000', hl1: '\u0001', hl2: '\u0002' }),
        { '\u0000': { tag: 'strong', text: t('footer.disclaimer2S1') },
          '\u0001': { tag: 'strong', text: '(888) 426-4435' },
          '\u0002': { tag: 'strong', text: '(855) 764-7661' } });
    }
    var el3 = q('#d3');
    if (el3) {
      clear(el3);
      appendTemplated(el3, t('footer.disclaimer3', { strong1: '\u0000' }),
        { '\u0000': { tag: 'strong', text: t('footer.disclaimer3S1') } });
    }
    var el4 = q('#d4');
    if (el4) el4.textContent = t('footer.disclaimer4', { date: '2026-10-03' });

    // 紧急指引步骤 1（含 3 个加粗片段）
    var s1 = q('#em-step1');
    if (s1) {
      clear(s1);
      appendTemplated(s1, t('emergency.step1', { what: '\u0000', howMuch: '\u0001', when: '\u0002' }),
        { '\u0000': { tag: 'strong', text: t('emergency.step1What') },
          '\u0001': { tag: 'strong', text: t('emergency.step1HowMuch') },
          '\u0002': { tag: 'strong', text: t('emergency.step1When') } });
    }
    // 紧急指引步骤 3（含加粗段落）
    var s3 = q('#em-step3');
    if (s3) {
      clear(s3);
      appendTemplated(s3, t('emergency.step3', { noVomit: '\u0000' }),
        { '\u0000': { tag: 'strong', text: t('emergency.step3NoVomit') } });
    }
  }

  function q(sel) { return document.querySelector(sel); }

  // 按模板串（含 \u0000/\u0001 占位符）重建节点内容
  function appendTemplated(node, template, tokens) {
    var parts = String(template).split(/([\u0000-\u0009])/);
    parts.forEach(function (part) {
      if (!part) return;
      if (/[\u0000-\u0009]/.test(part) && tokens[part]) {
        var spec = tokens[part];
        var inner = el(spec.tag || 'span', null, spec.text);
        node.appendChild(inner);
      } else {
        node.appendChild(document.createTextNode(part));
      }
    });
  }

  // 简单静态节点（data-i18n / -placeholder / -aria-label）
  function applySimpleStatic() {
    $all('[data-i18n]').forEach(function (node) {
      var key = node.getAttribute('data-i18n');
      node.textContent = t(key);
    });
    $all('[data-i18n-placeholder]').forEach(function (node) {
      node.setAttribute('placeholder', t(node.getAttribute('data-i18n-placeholder')));
    });
    $all('[data-i18n-aria-label]').forEach(function (node) {
      node.setAttribute('aria-label', t(node.getAttribute('data-i18n-aria-label')));
    });
    $all('[data-i18n-title]').forEach(function (node) {
      node.setAttribute('title', t(node.getAttribute('data-i18n-title')));
    });
  }

  // 语言切换按钮态
  function applyLangButtons() {
    $all('[data-lang-btn]').forEach(function (btn) {
      var code = btn.getAttribute('data-lang-btn');
      var active = code === lang;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.classList.toggle('is-active', active);
    });
    try { document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en'); } catch (e) {}
  }

  // 全量重渲染（切换语言时调用；不刷新、不丢输入）
  function renderAll() {
    applySimpleStatic();
    applyRichStatic();
    applyLangButtons();
    renderChips();
    renderCategoryNav();
    renderBrowseIndex();
    renderFooterSources();
    renderCompare();
    // 动态结果随语言重渲染：保留 query，重新走 search 得到本地化卡片
    if (state.result) {
      if (state.result.empty) {
        renderResult({ empty: true, xylitolAlert: false });
      } else if (state.result.exact) {
        // 直接按当前 language 重渲染该食物，避免 query 语言错配
        renderResult({ exact: state.result.exact, xylitolAlert: state.result.xylitolAlert,
                       query: fName(state.result.exact), note: null });
      } else if (state.result.multi) {
        renderResult(state.result);
      } else if (state.result.unknown) {
        renderResult(state.result);
      }
    }
  }

  // 切换语言：持久化 + 重渲染（不刷新页面，输入框与结果保留）
  function switchLang(next) {
    if (SUPPORTED_LANGS.indexOf(next) === -1) return;
    if (next === lang) return;
    lang = next;
    safeSet(LANG_KEY, lang);
    renderAll();
  }

  function loadLang() {
    var saved = safeGet(LANG_KEY);
    if (saved && SUPPORTED_LANGS.indexOf(saved) !== -1) lang = saved;
    // 文档语言属性
    try { document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en'); } catch (e) {}
  }

  /* ==========================================================================
   * 14. 启动
   * ========================================================================*/
  function init() {
    loadLang();          // 先恢复语言偏好，再构建/渲染
    if (!FOODS_REF) { // data.js 未加载
      // 数据缺失：不崩溃，显示提示
      var c = $('#result-card');
      if (c) c.appendChild(el('p', null, t('state.dataFailed')));
      return;
    }
    buildIndex(FOODS_REF);
    bindEvents();

    // 语言切换按钮
    $all('[data-lang-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchLang(btn.getAttribute('data-lang-btn'));
      });
    });

    renderAll();

    // 路由直达优先；否则空态
    var routed = false;
    if (window.location.hash.indexOf('#/food/') === 0 || window.location.hash === '#/identify') {
      routed = handleRoute();
    }
    if (!routed) renderResult({ empty: true, xylitolAlert: false });
  }

  // 仅在浏览器环境自动启动；Node 测试环境不自动 init（避免依赖真实 DOM）
  var IN_BROWSER = (typeof window !== 'undefined') && (typeof document !== 'undefined') &&
    !(typeof module !== 'undefined' && module.exports);
  if (IN_BROWSER) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  /* ==========================================================================
   * 15. 测试出口（Node 环境）
   * ========================================================================*/
  var api = {
    buildIndex: buildIndex,
    normalize: normalize,
    search: search,
    suggest: suggest,
    lookup: lookup,
    t: t,
    setLang: function (next) { if (SUPPORTED_LANGS.indexOf(next) !== -1) lang = next; },
    getLang: function () { return lang; },
    levelLabel: levelLabel,
    catLabel: catLabel,
    // 特征引导（Guided ID）纯函数与状态访问器（供 selftest.js 调用）
    filterByTraits: filterByTraits,
    traitLabel: traitLabel,
    traitEmoji: traitEmoji,
    _traitsEnum: function () { return TRAITS_ENUM_REF; },
    _identify: function () { return state.identify; },
    _alias: function () { return ALIAS; },
    _aliasZh: function () { return ALIAS_ZH; },
    _foodById: function (id) { return FOOD_BY_ID.get(id); }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.__CDE__ = api;

})();
