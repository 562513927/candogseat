/* ============================================================================
 * selftest.js — 核心逻辑自测（Node 环境，无浏览器依赖）
 * ----------------------------------------------------------------------------
 * 运行：node selftest.js
 * 覆盖：
 *   1. 数据完整性（88 条、字段齐全、无重复 id、分类分布正确）
 *   2. 来源链接格式有效（https、含机构域名、rel 安全由渲染层保证）
 *   3. 等级判定正确性（对照验收表 6.1 抽查）
 *   4. 别名/常见拼写/单复数匹配
 *   5. UNKNOWN 保守路径（绝不猜等级）
 *   6. 木糖醇强制叠加规则（R1）
 *   7. 巧克力子类型分级（R2）
 *   8. XSS 防护（输入/渲染不产生可执行 HTML）
 *   9. 归一化（前缀去除、标点、截断）
 * ==========================================================================*/

'use strict';

/* ---------------------------------------------------------------------------
 * 0. 最小 DOM 桩：app.js 是 IIFE，init() 只在有 #result-card 时被调用。
 *    这里提供最小的 document/window，让 IIFE 能安全加载并导出 __CDE__。
 * -------------------------------------------------------------------------*/
function makeStub() {
  var noop = function () { return null; };
  var stubEl = {
    className: '', id: '', style: {}, hidden: false,
    firstChild: null,
    setAttribute: noop, getAttribute: noop, appendChild: noop,
    removeChild: noop, insertBefore: noop, addEventListener: noop,
    querySelector: noop, querySelectorAll: function () { return []; },
    classList: { add: noop, remove: noop }
  };
  global.document = {
    readyState: 'complete',
    addEventListener: noop,
    createElement: function () { return Object.assign({}, stubEl); },
    createTextNode: function () { return {}; },
    createDocumentFragment: function () { return { appendChild: noop }; },
    querySelector: function () { return null; },   // init() 会因此提前返回
    querySelectorAll: function () { return []; }
  };
  global.window = {
    location: { hash: '' },
    history: { replaceState: noop },
    pageYOffset: 0,
    addEventListener: noop,
    scrollTo: noop,
    localStorage: (function () {
      var store = {};
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); }
      };
    })()
  };
}

/* ---------------------------------------------------------------------------
 * 1. 断言器
 * -------------------------------------------------------------------------*/
var PASS = 0, FAIL = 0;
var FAILURES = [];

function ok(cond, name) {
  if (cond) { PASS++; }
  else { FAIL++; FAILURES.push(name); console.log('  ✗ FAIL: ' + name); }
}
function eq(actual, expected, name) {
  var pass = actual === expected;
  if (!pass) FAILURES.push(name + ' (got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected) + ')');
  ok(pass, name + ' [=' + JSON.stringify(expected) + ']');
}
function section(title) { console.log('\n▶ ' + title); }

/* ---------------------------------------------------------------------------
 * 2. 加载被测试模块
 * -------------------------------------------------------------------------*/
makeStub();
var data = require('./data.js');
var FOODS = data.FOODS, SOURCES = data.SOURCES, CATEGORY_META = data.CATEGORY_META, LEVEL_META = data.LEVEL_META;
var TRAITS_ENUM = data.TRAITS_ENUM, FOOD_EMOJI = data.FOOD_EMOJI;
var i18n = require('./i18n.js');
var I18N = i18n.I18N, LEVEL_LABELS = i18n.LEVEL_LABELS, CATEGORY_LABELS = i18n.CATEGORY_LABELS;
var TRAITS = i18n.TRAITS;
// Node 里 data.js/i18n.js 只走 module.exports；app.js 的全局回退需要这些变量存在于作用域
global.FOODS = FOODS;
global.SOURCES = SOURCES;
global.CATEGORY_META = CATEGORY_META;
global.LEVEL_META = LEVEL_META;
global.TRAITS_ENUM = TRAITS_ENUM;
global.FOOD_EMOJI = FOOD_EMOJI;
global.I18N = I18N;
global.LEVEL_LABELS = LEVEL_LABELS;
global.CATEGORY_LABELS = CATEGORY_LABELS;
global.TRAITS = TRAITS;
require('./app.js');
var CDE = global.window.__CDE__;
CDE.buildIndex(FOODS);

/* ===========================================================================
 * 测试 1：数据完整性
 * =========================================================================*/
section('1. Data integrity (88 foods, complete fields)');
eq(FOODS.length, 88, 'FOODS has exactly 88 entries');

var ids = FOODS.map(function (f) { return f.id; });
var dupes = ids.filter(function (v, i) { return ids.indexOf(v) !== i; });
eq(dupes.length, 0, 'no duplicate ids');

var REQUIRED = ['id', 'name', 'aliases', 'category', 'level', 'reason', 'symptoms', 'advice', 'sources', 'checked'];
var missing = [];
FOODS.forEach(function (f) {
  REQUIRED.forEach(function (k) { if (f[k] === undefined || f[k] === null) missing.push(f.id + '.' + k); });
  if (!Array.isArray(f.aliases) || f.aliases.length < 1) missing.push(f.id + '.aliases-empty');
  if (!Array.isArray(f.sources) || f.sources.length < 1) missing.push(f.id + '.sources-empty');
  if (typeof f.reason !== 'string' || f.reason.length < 20) missing.push(f.id + '.reason-short');
  if (typeof f.symptoms !== 'string' || f.symptoms.length < 5) missing.push(f.id + '.symptoms-short');
  if (typeof f.advice !== 'string' || f.advice.length < 5) missing.push(f.id + '.advice-short');
});
eq(missing.length, 0, 'all required fields present and non-trivial' + (missing.length ? ' -> ' + missing.slice(0, 5).join(', ') : ''));

var VALID_LEVELS = ['safe', 'moderation', 'caution', 'toxic', 'severe'];
var badLevel = FOODS.filter(function (f) { return VALID_LEVELS.indexOf(f.level) === -1; });
eq(badLevel.length, 0, 'all levels within the 5-level enum');

var VALID_CATS = CATEGORY_META.map(function (c) { return c.key; });
var badCat = FOODS.filter(function (f) { return VALID_CATS.indexOf(f.category) === -1; });
eq(badCat.length, 0, 'all categories within CATEGORY_META');

var catCount = {};
FOODS.forEach(function (f) { catCount[f.category] = (catCount[f.category] || 0) + 1; });
eq(catCount.fruit, 20, 'Fruits = 20');
eq(catCount.vegetable, 22, 'Vegetables = 22');
eq(catCount.protein, 12, 'Proteins = 12');
eq(catCount.dairy, 4, 'Dairy & Eggs = 4');
eq(catCount.grain, 7, 'Grains & Staples = 7');
eq(catCount.nut, 7, 'Nuts & Seeds = 7');
eq(catCount.drink, 11, 'Drinks & Sweets = 11');
eq(catCount.processed, 5, 'Processed & Toxic = 5');

// 每条都有 checked 日期且格式为 YYYY-MM-DD
var badDate = FOODS.filter(function (f) { return !/^\d{4}-\d{2}-\d{2}$/.test(f.checked); });
eq(badDate.length, 0, 'every food has a valid checked date');

/* ===========================================================================
 * 测试 2：来源链接格式有效
 * =========================================================================*/
section('2. Source links valid format');
var srcKeys = Object.keys(SOURCES);
ok(srcKeys.length >= 5, 'SOURCES table has at least 5 entries');
srcKeys.forEach(function (k) {
  var s = SOURCES[k];
  ok(/^https:\/\//.test(s.url), 'source ' + k + ' uses https');
  ok(/aspca\.org|akc\.org|petmd\.com/.test(s.url), 'source ' + k + ' points to an authoritative domain');
  ok(typeof s.org === 'string' && s.org.length > 1, 'source ' + k + ' has an org name');
});
// 每条食物的 sources 编号都在 SOURCES 表中
var badSrcRef = [];
FOODS.forEach(function (f) {
  f.sources.forEach(function (sid) { if (!SOURCES[sid]) badSrcRef.push(f.id + '->' + sid); });
});
eq(badSrcRef.length, 0, 'every food.sources id resolves in SOURCES' + (badSrcRef.length ? ' -> ' + badSrcRef.join(',') : ''));

/* ===========================================================================
 * 测试 3：等级判定正确性（对照 03-requirements 6.1 抽查表）
 * =========================================================================*/
section('3. Verdict correctness (acceptance table 6.1)');
function levelOf(raw) {
  var r = CDE.search(raw);
  if (r.exact) return r.exact.level;
  return r.unknown ? 'UNKNOWN' : (r.multi ? 'MULTI' : 'EMPTY');
}
eq(levelOf('chocolate'), 'toxic', 'chocolate -> TOXIC (default)');
eq(levelOf('grapes'), 'severe', 'grapes -> SEVERE');
eq(levelOf('raisins'), 'severe', 'raisins -> SEVERE');
eq(levelOf('sugar-free gum'), 'severe', 'sugar-free gum -> SEVERE');
eq(levelOf('xylitol'), 'severe', 'xylitol -> SEVERE');
eq(levelOf('onion'), 'toxic', 'onion -> TOXIC');
eq(levelOf('garlic'), 'toxic', 'garlic -> TOXIC');
eq(levelOf('apple'), 'safe', 'apple -> SAFE');
eq(levelOf('banana'), 'safe', 'banana -> SAFE');
eq(levelOf('milk'), 'moderation', 'milk -> MODERATION');
eq(levelOf('macadamia nuts'), 'toxic', 'macadamia nuts -> TOXIC');
eq(levelOf('peanut butter'), 'moderation', 'peanut butter -> MODERATION');
eq(levelOf('pizza'), 'caution', 'pizza -> CAUTION');
eq(levelOf('asdfgh123'), 'UNKNOWN', 'asdfgh123 -> UNKNOWN (never guesses)');
eq(levelOf('alcohol'), 'severe', 'alcohol -> SEVERE');
eq(levelOf('avocado'), 'caution', 'avocado -> CAUTION (conservative)');
eq(levelOf('raw dough'), 'severe', 'raw bread dough -> SEVERE');

// 每条都命中（无一条落空）—— 随机抽查 10 条 id 直查
var sampleIds = ['chicken', 'turkey', 'beef', 'eggs', 'salmon', 'cheese', 'yogurt',
                 'rice', 'oatmeal', 'quinoa', 'carrots', 'watermelon'];
sampleIds.forEach(function (id) {
  var r = CDE.search(id);
  ok(r.exact && r.exact.id === id, 'exact lookup by id: ' + id);
});

/* ===========================================================================
 * 测试 4：别名 / 常见拼写 / 单复数匹配
 * =========================================================================*/
section('4. Alias & spelling matching');
var aliasCases = [
  ['grape', 'grapes'],
  ['green grapes', 'grapes'],
  ['sultanas', 'raisins'],
  ['currants', 'raisins'],
  ['choc', 'chocolate'],
  ['pb', 'peanut-butter'],
  ['peanutbutter', 'peanut-butter'],
  ['cheddar', 'cheese'],
  ['yoghurt', 'yogurt'],
  ['cooked chicken', 'chicken'],
  ['boiled chicken', 'chicken'],
  ['scrambled eggs', 'eggs'],
  ['prawns', 'shrimp'],
  ['red bull', 'energy-drinks'],
  ['birthday cake', 'cake'],
  ['fries', 'french-fries'],
  ['bacon', 'hot-dogs'],
  ['sausage', 'hot-dogs'],
  ['green onions', 'scallions'],
  ['birch sugar', 'xylitol'],
  ['rockmelon', 'cantaloupe'],
  ['nectarine', 'peaches'],
  ['greek yogurt', 'yogurt'],
  ['black walnuts', 'walnuts'],
  ['coffee grounds', 'coffee']
];
aliasCases.forEach(function (pair) {
  var r = CDE.search(pair[0]);
  ok(r.exact && r.exact.id === pair[1], 'alias "' + pair[0] + '" -> ' + pair[1]);
});

// 复数 / 单数归一：carrot 与 carrots 命中同一条
var r1 = CDE.search('carrot'), r2 = CDE.search('carrots');
ok(r1.exact && r2.exact && r1.exact.id === r2.exact.id, 'carrot == carrots');

/* ===========================================================================
 * 测试 5：UNKNOWN 保守路径
 * =========================================================================*/
section('5. UNKNOWN conservative path');
['zzzznotafood', 'asdfgh123', 'flurbos'].forEach(function (q) {
  var r = CDE.search(q);
  ok(r.unknown === true, 'unmatched "' + q + '" -> unknown (no guessed level)');
  ok(!r.exact, 'unmatched "' + q + '" has no exact level');
});
// 纯数字/纯符号归一化后为空 -> empty（不是猜测等级，也不是伪造 unknown 卡）
['12345', '?!@#'].forEach(function (q) {
  var r = CDE.search(q);
  ok(!r.exact && !r.multi, 'number/symbol-only "' + q + '" never yields a guessed level');
  ok(r.empty === true, 'number/symbol-only "' + q + '" -> empty state');
});
var rEmpty = CDE.search('!!!');
ok(rEmpty.empty === true || rEmpty.unknown === true, 'symbol-only input yields empty/unknown, never a level');

/* ===========================================================================
 * 测试 6：木糖醇强制叠加规则（R1）
 * =========================================================================*/
section('6. Xylitol forced override (rule R1)');
['xylitol', 'sugar-free gum', 'sugar free gum', 'sugarfree', 'birch sugar',
 'sugar-free candy', 'sugar-free'].forEach(function (q) {
  var r = CDE.search(q);
  ok(r.xylitolAlert === true, 'xylitol alert flag set for "' + q + '"');
  ok(r.exact && r.exact.level === 'severe', '"' + q + '" resolves to a SEVERE verdict');
});
// 关键：木糖醇警示必须叠加在"任何输入"之上，即使用户输入的是一个安全食物
['sugar-free peanut butter', 'sugar free yogurt', 'xylitol candy'].forEach(function (q) {
  var r = CDE.search(q);
  ok(r.xylitolAlert === true, 'xylitol alert stacks on mixed input "' + q + '"');
});
// 普通 "sugar" 不应误触发木糖醇警示
var rSugar = CDE.search('sugar');
ok(rSugar.xylitolAlert === false, 'plain "sugar" does not trigger the xylitol alert');

/* ===========================================================================
 * 测试 7：巧克力子类型分级（R2）
 * =========================================================================*/
section('7. Chocolate subtype grading (rule R2)');
eq(levelOf('dark chocolate'), 'severe', 'dark chocolate -> SEVERE');
eq(levelOf('baking chocolate'), 'severe', 'baking chocolate -> SEVERE');
eq(levelOf('bitter chocolate'), 'severe', 'bitter chocolate -> SEVERE');
eq(levelOf('cocoa powder'), 'severe', 'cocoa powder -> SEVERE');
eq(levelOf('semisweet chocolate'), 'severe', 'semisweet chocolate -> SEVERE');
eq(levelOf('white chocolate'), 'caution', 'white chocolate -> CAUTION');
eq(levelOf('chocolate'), 'toxic', 'plain chocolate -> TOXIC (default)');
eq(levelOf('milk chocolate'), 'toxic', 'milk chocolate -> TOXIC (default)');
eq(levelOf('chocolate bar'), 'toxic', 'chocolate bar -> TOXIC (default)');
// 子类型必须落到不同 id
ok(CDE.search('dark chocolate').exact.id === 'dark-chocolate', 'dark chocolate -> dark-chocolate entry');
ok(CDE.search('white chocolate').exact.id === 'white-chocolate', 'white chocolate -> white-chocolate entry');
ok(CDE.search('chocolate').exact.id === 'chocolate', 'default chocolate -> chocolate entry');

/* ===========================================================================
 * 测试 8：XSS 防护
 * =========================================================================*/
section('8. XSS protection');
// 8a. 归一化必须剥离 HTML 危险字符（< > <script> 等），使其不能进入 DOM 结构
var xssInputs = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '"><script>alert(1)</script>',
  "grape'); alert('xss",
  '<svg/onload=alert(1)>'
];
xssInputs.forEach(function (payload) {
  var n = CDE.normalize(payload);
  ok(n.indexOf('<') === -1 && n.indexOf('>') === -1 && n.indexOf('"') === -1 &&
     n.indexOf("'") === -1 && n.indexOf('(') === -1 && n.indexOf(')') === -1,
     'normalize strips dangerous chars from: ' + payload.slice(0, 24));
});
// 8b. 携带 XSS 的输入经 search() 绝不应命中并显示为"命令"——应走 unknown 或安全文本
var rx = CDE.search('<script>alert(1)</script>');
ok(rx.unknown === true || rx.exact || rx.multi, 'XSS-laden input returns a normal result object (no crash)');
ok(rx.xylitolAlert === false, 'XSS input does not falsely set xylitol flag');
// 8c. 传给 search 的结果对象中，query 原样保留但渲染层用 textContent（此处确认 normalize 已擦除危险字符）
ok(CDE.normalize('<b>hello</b>').indexOf('<') === -1, 'normalize removes angle brackets');
// 8d. 防御性：normalize 对非字符串输入不崩溃
ok(CDE.normalize(null) === '' && CDE.normalize(undefined) === '', 'normalize(null/undefined) is safe');

/* ===========================================================================
 * 测试 9：归一化（前缀词、后缀词、标点、截断）
 * =========================================================================*/
section('9. Normalization');
eq(CDE.normalize('  Chocolate  '), 'chocolate', 'trims & lowercases');
eq(CDE.normalize('Can dogs eat chocolate?'), 'chocolate', 'strips leading "can dogs eat"');
eq(CDE.normalize('my dog ate grapes'), 'grapes', 'strips leading "my dog ate"');
eq(CDE.normalize('is chocolate safe'), 'chocolate', 'strips leading "is" and trailing "safe"');
eq(CDE.normalize('grapes toxic'), 'grapes', 'strips trailing "toxic"');
eq(CDE.normalize('cooked-chicken'), 'cooked-chicken', 'keeps hyphens (multi-word ids)');
ok(CDE.normalize('x'.repeat(200)).length === 80, 'input truncated to 80 chars');
// "dog ate" 前缀后仍是有效查询
eq(levelOf('dog ate onions'), 'toxic', '"dog ate onions" -> TOXIC via normalization');

/* ===========================================================================
 * 测试 10：联想（suggest）行为
 * =========================================================================*/
section('10. Autocomplete suggestions');
var sug = CDE.suggest('cho');
ok(sug.length >= 1 && sug.length <= 8, 'suggest("cho") returns 1–8 items');
ok(sug.some(function (f) { return f.id === 'chocolate'; }), 'suggest("cho") includes chocolate');
var sugG = CDE.suggest('gra');
ok(sugG.some(function (f) { return f.id === 'grapes'; }), 'suggest("gra") includes grapes');
eq(CDE.suggest('').length, 0, 'suggest("") is empty');
ok(CDE.suggest('zzzznotafood').length === 0, 'suggest of unknown returns empty (no false match)');
ok(CDE.suggest('c').length <= 8, 'suggest caps results at 8');
// 联想结果不重复
var sugA = CDE.suggest('a');
var sugIds = sugA.map(function (f) { return f.id; });
eq(sugIds.filter(function (v, i) { return sugIds.indexOf(v) !== i; }).length, 0, 'suggest has no duplicate foods');

/* ===========================================================================
 * 测试 11：巧克力/木糖醇叠加 + 紧急内容完整性
 * =========================================================================*/
section('11. Emergency content presence');
['severe', 'toxic'].forEach(function (lvl) {
  var withEmergency = FOODS.filter(function (f) { return f.level === lvl; });
  ok(withEmergency.length > 0, 'there are foods at level ' + lvl);
  var missingEmerg = withEmergency.filter(function (f) { return !f.emergency || f.emergency.length < 20; });
  eq(missingEmerg.length, 0, 'all ' + lvl + ' foods have emergency guidance text');
});
// 木糖醇条目必须含关键事实
var xyl = CDE.lookup('xylitol');
ok(xyl.level === 'severe', 'xylitol entry is SEVERE');
ok(/0\.1/.test(xyl.reason + xyl.symptoms + xyl.advice + xyl.dosageNote), 'xylitol entry mentions the 0.1 g/kg dose');
// 葡萄条目必须含"无已知安全剂量"
var gr = CDE.lookup('grapes');
ok(/no known safe dose/i.test(gr.reason + gr.dosageNote), 'grapes entry states no known safe dose');
// 巧克力条目引用了 PetMD 或 ASPCA
var choc = CDE.lookup('chocolate');
ok(choc.sources.indexOf('PETMD-5') !== -1 || choc.sources.indexOf('ASPCA-1') !== -1, 'chocolate cites PetMD/ASPCA');

/* ===========================================================================
 * 测试 12：每条食物均可通过其 id / name 精确检索到自身（一致性）
 * =========================================================================*/
section('12. Every food is retrievable by id and name');
var unreachable = [];
FOODS.forEach(function (f) {
  var byId = CDE.lookup(f.id);
  var byName = CDE.lookup(f.name.toLowerCase());
  if (!byId || byId.id !== f.id) unreachable.push(f.id + ' (id)');
  if (!byName || byName.id !== f.id) unreachable.push(f.id + ' (name:"' + f.name + '")');
});
eq(unreachable.length, 0, 'all 88 foods retrievable by id and name' + (unreachable.length ? ' -> ' + unreachable.slice(0, 6).join(', ') : ''));

/* ===========================================================================
 * 测试 13：缺陷回归（测试报告 P1-①/②、P2-③/④）
 * 根因：判定漏斗对短通用词做过宽的子串/前缀匹配 + 别名定义过泛。
 * 修复：判定改为「精确 → 词边界 → 分词」两级；子串仅用于联想；别名收窄。
 * =========================================================================*/
section('13. Regression — generic words must not mis-hit (P1-①/②, P2-③/④)');

// P1-① 裸 "sugar" 绝不能命中木糖醇
var rSugar2 = CDE.search('sugar');
ok(rSugar2.xylitolAlert === false, 'P1-① "sugar" does NOT trigger the xylitol alert');
ok(!rSugar2.exact || rSugar2.exact.id !== 'xylitol', 'P1-① "sugar" does NOT resolve to xylitol');
ok(rSugar2.unknown === true || (rSugar2.exact && rSugar2.exact.id !== 'xylitol'),
   'P1-① "sugar" is UNKNOWN (conservative), never the xylitol SEVERE card');

// P1-① 必需触发词仍必须命中木糖醇 SEVERE
['sugar-free', 'sugar free', 'sugarfree', 'xylitol', 'birch sugar',
 'sugar-free gum', 'sugarfree gum', 'sugar free gum', 'sugar-free candy'].forEach(function (q) {
  var r = CDE.search(q);
  ok(r.xylitolAlert === true, 'P1-① "' + q + '" still sets xylitolAlert');
  ok(r.exact && r.exact.id === 'xylitol' && r.exact.level === 'severe',
     'P1-① "' + q + '" resolves to xylitol SEVERE');
});

// P1-① 非触发变体不得误触发木糖醇
['sugar cookie', 'sugarcane', 'brown sugar', 'sugar snap peas'].forEach(function (q) {
  var r = CDE.search(q);
  ok(r.xylitolAlert === false, 'P1-① "' + q + '" does NOT trigger xylitol');
  ok(!r.exact || r.exact.id !== 'xylitol', 'P1-① "' + q + '" never resolves to xylitol');
});

// P1-② 裸 "salt" 绝不能命中杏仁
var rSalt = CDE.search('salt');
ok(rSalt.unknown === true || !rSalt.exact || rSalt.exact.id !== 'almonds',
   'P1-② "salt" does NOT resolve to almonds');
ok(!rSalt.exact, 'P1-② "salt" is not an exact food match (UNKNOWN)');
// 但具体短语仍应命中杏仁
ok(CDE.search('almonds').exact.id === 'almonds', 'P1-② "almonds" still resolves to almonds');
ok(CDE.search('almond').exact.id === 'almonds', 'P1-② "almond" still resolves to almonds');

// P2-③ 裸 "water" 绝不能命中西瓜
var rWater = CDE.search('water');
ok(!rWater.exact || rWater.exact.id !== 'watermelon', 'P2-③ "water" does NOT resolve to watermelon');
ok(rWater.unknown === true, 'P2-③ "water" is UNKNOWN (conservative)');
ok(CDE.search('watermelon').exact.id === 'watermelon', 'P2-③ "watermelon" still resolves to watermelon');

// P2-④ 连字符 id 与空格形式等价，且都应是 white chocolate（CAUTION），不是 chocolate（TOXIC）
var rWhiteHy = CDE.search('white-chocolate');
var rWhiteSp = CDE.search('white chocolate');
ok(rWhiteHy.exact && rWhiteHy.exact.id === 'white-chocolate' && rWhiteHy.exact.level === 'caution',
   'P2-④ "white-chocolate" -> white-chocolate CAUTION');
ok(rWhiteSp.exact && rWhiteSp.exact.id === 'white-chocolate' && rWhiteSp.exact.level === 'caution',
   'P2-④ "white chocolate" -> white-chocolate CAUTION');
ok(rWhiteHy.exact.id === rWhiteSp.exact.id, 'P2-④ hyphen and space forms agree');

// 连字符 id 直查能力必须保留（深链 slug）
ok(CDE.search('lemons-limes').exact.id === 'lemons-limes', 'P2-④ "lemons-limes" deep link still direct');
ok(CDE.search('dark-chocolate').exact.id === 'dark-chocolate', 'P2-④ "dark-chocolate" id still direct');
ok(CDE.search('peanut-butter').exact.id === 'peanut-butter', 'P2-④ "peanut-butter" id still direct');

/* ===========================================================================
 * 测试 14：全库别名自解析一致性 + 通用词误命中扫描（自查）
 * =========================================================================*/
section('14. Alias self-resolution & generic-word hazard scan');

// 14a. 除 R3 刻意制造的多候选（raw*）外，每个 alias 都应精确解析到其所属食物自身。
//      （R2 巧克力规则同样遵循“精确别名优先”：dark/white 子类型先行返回，
//       "chocolate spread" 这类 Nutella 别名不再被裸泛巧克力规则截胡。）
var R3_MULTI = ['raw meat', 'raw-meat', 'raw chicken'];
var selfBad = [];
FOODS.forEach(function (f) {
  (f.aliases || []).forEach(function (t) {
    var k = String(t).toLowerCase().trim();
    if (R3_MULTI.indexOf(k) !== -1) return;
    var r = CDE.search(k);
    if (!(r.exact && r.exact.id === f.id)) {
      selfBad.push('"' + k + '" [' + f.id + '] -> ' + (r.exact ? r.exact.id : (r.multi ? 'MULTI' : 'UNKNOWN')));
    }
  });
});
eq(selfBad.length, 0, 'every non-R3 alias resolves to its own food' + (selfBad.length ? ' -> ' + selfBad.slice(0, 6).join(', ') : ''));

// 14b. 通用词不得被判定为「另一个更具体」的食物
var GENERIC = {
  'sugar': null, 'salt': null, 'water': null, 'oil': null, 'nut': null,
  'seed': null, 'pie': null, 'meal': null, 'flour': null, 'syrup': null,
  'juice': null, 'pepper': null, 'fat': null, 'stock': null, 'meat': null
};
var misHit = [];
Object.keys(GENERIC).forEach(function (w) {
  var r = CDE.search(w);
  if (r.exact && w !== r.exact.id) misHit.push('"' + w + '" -> ' + r.exact.id);
});
eq(misHit.length, 0, 'generic words never resolve to a different specific food' + (misHit.length ? ' -> ' + misHit.join(', ') : ''));

// 14c. 短通用词不得成为长别名的子串命中（逐一验证报告点名项）
[['salt', 'almonds'], ['water', 'watermelon'], ['sugar', 'xylitol'], ['pea', 'peaches']].forEach(function (pair) {
  var r = CDE.search(pair[0]);
  ok(!(r.exact && r.exact.id === pair[1]),
     'no substring mis-hit: "' + pair[0] + '" !-> ' + pair[1]);
});

/* ===========================================================================
 * 测试 15：中文数据完整性（nameZh / aliasesZh / 风险级完整译文）
 * =========================================================================*/
section('15. Chinese data integrity (i18n coverage)');

// 15a. 88 条食物全部有中文名与中文别名（中文名称覆盖 = 88/88）
var noNameZh = FOODS.filter(function (f) { return !f.nameZh || !String(f.nameZh).trim(); });
eq(noNameZh.length, 0, 'all 88 foods have a Chinese name (nameZh)' + (noNameZh.length ? ' -> ' + noNameZh.slice(0, 5).map(function (f) { return f.id; }).join(',') : ''));
var noAliasZh = FOODS.filter(function (f) { return !Array.isArray(f.aliasesZh) || f.aliasesZh.length < 1; });
eq(noAliasZh.length, 0, 'all 88 foods have Chinese aliases (aliasesZh)' + (noAliasZh.length ? ' -> ' + noAliasZh.slice(0, 5).map(function (f) { return f.id; }).join(',') : ''));

// 15b. 所有 toxic / severe 级食物必须有完整中文 reason/symptoms/advice（用户最需要看懂的部分）
var risky = FOODS.filter(function (f) { return f.level === 'toxic' || f.level === 'severe'; });
eq(risky.length, 17, 'there are 17 toxic/severe foods');
var riskyBad = [];
risky.forEach(function (f) {
  ['reasonZh', 'symptomsZh', 'adviceZh'].forEach(function (k) {
    if (!f[k] || String(f[k]).trim().length < 5) riskyBad.push(f.id + '.' + k);
  });
  // 有 emergency 的必须有 emergencyZh
  if (f.emergency && (!f.emergencyZh || String(f.emergencyZh).trim().length < 5)) riskyBad.push(f.id + '.emergencyZh');
});
eq(riskyBad.length, 0, 'all toxic/severe foods have full Chinese reason/symptoms/advice/emergency' + (riskyBad.length ? ' -> ' + riskyBad.slice(0, 6).join(',') : ''));

// 15c. 关键高风险食物（点名）中文文案齐全
['chocolate', 'dark-chocolate', 'grapes', 'raisins', 'xylitol', 'onions', 'garlic',
 'macadamia-nuts', 'alcohol', 'coffee'].forEach(function (id) {
  var f = CDE._foodById(id);
  ok(f && f.nameZh && f.reasonZh && f.adviceZh, 'high-risk "' + id + '" fully translated to Chinese');
});

/* ===========================================================================
 * 测试 16：i18n 字典键集合一致 + 无空值
 * =========================================================================*/
section('16. i18n dictionary integrity (EN/ZH key parity)');
var enKeys = Object.keys(I18N.en).sort();
var zhKeys = Object.keys(I18N.zh).sort();
eq(enKeys.length, zhKeys.length, 'EN and ZH have the same number of keys (' + enKeys.length + ')');
var onlyEn = enKeys.filter(function (k) { return !Object.prototype.hasOwnProperty.call(I18N.zh, k); });
var onlyZh = zhKeys.filter(function (k) { return !Object.prototype.hasOwnProperty.call(I18N.en, k); });
eq(onlyEn.length, 0, 'no EN-only keys (missing in ZH)' + (onlyEn.length ? ' -> ' + onlyEn.join(',') : ''));
eq(onlyZh.length, 0, 'no ZH-only keys (missing in EN)' + (onlyZh.length ? ' -> ' + onlyZh.join(',') : ''));
var emptyVals = enKeys.filter(function (k) {
  return !I18N.en[k] || !String(I18N.en[k]).trim() || !I18N.zh[k] || !String(I18N.zh[k]).trim();
});
eq(emptyVals.length, 0, 'no empty dictionary values in either language' + (emptyVals.length ? ' -> ' + emptyVals.slice(0, 6).join(',') : ''));

// 等级与分类名同样键集合一致且非空
eq(Object.keys(LEVEL_LABELS.en).sort().join(','), Object.keys(LEVEL_LABELS.zh).sort().join(','), 'LEVEL_LABELS EN/ZH keys match');
eq(Object.keys(CATEGORY_LABELS.en).sort().join(','), Object.keys(CATEGORY_LABELS.zh).sort().join(','), 'CATEGORY_LABELS EN/ZH keys match');
var lvlEmpty = Object.keys(LEVEL_LABELS.en).filter(function (k) {
  return !LEVEL_LABELS.en[k].badge || !LEVEL_LABELS.zh[k].badge;
});
eq(lvlEmpty.length, 0, 'all 5 level labels present in both languages');

/* ===========================================================================
 * 测试 17：中文查询命中正确食物（分层匹配）
 * =========================================================================*/
section('17. Chinese query resolution');
CDE.setLang('zh');

function zhId(q) {
  var r = CDE.search(q);
  return r.exact ? r.exact.id : (r.unknown ? 'UNKNOWN' : (r.multi ? 'MULTI' : 'EMPTY'));
}

var zhCases = [
  ['巧克力', 'chocolate'],
  ['葡萄', 'grapes'],
  ['葡萄干', 'raisins'],
  ['木糖醇', 'xylitol'],
  ['洋葱', 'onions'],
  ['大蒜', 'garlic'],
  ['夏威夷果', 'macadamia-nuts'],
  ['牛油果', 'avocado'],
  ['花生酱', 'peanut-butter'],
  ['鸡蛋', 'eggs'],
  ['牛奶', 'milk'],
  ['苹果', 'apple'],
  ['西瓜', 'watermelon'],
  ['胡萝卜', 'carrots'],
  ['三文鱼', 'salmon'],
  ['奶酪', 'cheese'],
  ['酸奶', 'yogurt'],
  ['米饭', 'rice'],
  ['蜂蜜', 'honey'],
  ['酒精', 'alcohol'],
  ['咖啡', 'coffee'],
  ['土豆', 'potatoes'],
  ['番茄', 'tomatoes'],
  ['黄瓜', 'cucumbers'],
  ['南瓜', 'pumpkin'],
  ['红薯', 'sweet-potato'],
  ['腰果', 'cashews'],
  ['杏仁', 'almonds'],
  ['核桃', 'walnuts'],
  ['面包', 'bread'],
  ['爆米花', 'popcorn'],
  ['生面团', 'raw-dough'],
  ['披萨', 'pizza'],
  ['火腿', 'ham'],
  ['虾', 'shrimp'],
  ['香蕉', 'banana'],
  ['蓝莓', 'blueberries'],
  ['草莓', 'strawberries'],
  ['芒果', 'mango'],
  ['菠萝', 'pineapple'],
  ['桃子', 'peaches'],
  ['橙子', 'oranges'],
  ['梨', 'pears'],
  ['菠菜', 'spinach'],
  ['西兰花', 'broccoli'],
  ['玉米', 'corn'],
  ['蘑菇', 'mushrooms'],
  ['鸡肉', 'chicken'],
  ['牛肉', 'beef'],
  ['猪肉', 'pork'],
  ['虾仁', 'shrimp'],       // 中文别名
  ['车厘子', 'cherries'],   // 中文俗称
  ['芝士', 'cheese'],       // 中文俗称
  ['地瓜', 'sweet-potato'], // 中文俗称
  ['西红柿', 'tomatoes'],   // 中文俗称
  ['吞拿鱼', 'tuna']        // 中文俗称
];
zhCases.forEach(function (pair) {
  eq(zhId(pair[0]), pair[1], 'ZH "' + pair[0] + '" -> ' + pair[1]);
});

// 全部 88 条都能通过其中文名精确检索到自身
var zhUnreachable = [];
FOODS.forEach(function (f) {
  var r = CDE.search(f.nameZh);
  if (!(r.exact && r.exact.id === f.id)) zhUnreachable.push(f.nameZh + ' -> ' + (r.exact ? r.exact.id : 'MISS'));
});
eq(zhUnreachable.length, 0, 'all 88 foods retrievable by their Chinese name' + (zhUnreachable.length ? ' -> ' + zhUnreachable.slice(0, 6).join(',') : ''));

/* ===========================================================================
 * 测试 18：中文硬规则（木糖醇 / 巧克力分级 / 通用词不误命中）
 * =========================================================================*/
section('18. Chinese hard rules (xylitol / chocolate / generic words)');

// 18a. 木糖醇强制 SEVERE
['木糖醇', '桦木糖', '无糖口香糖', '无糖糖果', '代糖'].forEach(function (q) {
  var r = CDE.search(q);
  ok(r.xylitolAlert === true, 'ZH "' + q + '" sets xylitolAlert');
  ok(r.exact && r.exact.id === 'xylitol' && r.exact.level === 'severe', 'ZH "' + q + '" -> xylitol SEVERE');
});
// 木糖醇叠加：即使输入含安全食物
var zhMix = CDE.search('无糖口香糖 花生酱');
ok(zhMix.xylitolAlert === true, 'ZH "无糖口香糖 花生酱" still sets xylitolAlert (stacks)');
// 普通“糖”不触发木糖醇
var zhSugar = CDE.search('糖');
ok(zhSugar.xylitolAlert === false, 'ZH plain "糖" does NOT trigger xylitol');

// 18b. 巧克力子类型分级
eq(zhId('黑巧克力'), 'dark-chocolate', 'ZH "黑巧克力" -> dark-chocolate');
eq(zhId('烘焙巧克力'), 'dark-chocolate', 'ZH "烘焙巧克力" -> dark-chocolate');
eq(zhId('可可粉'), 'dark-chocolate', 'ZH "可可粉" -> dark-chocolate');
eq(zhId('白巧克力'), 'white-chocolate', 'ZH "白巧克力" -> white-chocolate');
eq(zhId('巧克力'), 'chocolate', 'ZH plain "巧克力" -> chocolate (TOXIC default)');
eq(CDE.search('黑巧克力').exact.level, 'severe', 'ZH dark chocolate -> SEVERE');
eq(CDE.search('白巧克力').exact.level, 'caution', 'ZH white chocolate -> CAUTION');
eq(CDE.search('巧克力').exact.level, 'toxic', 'ZH chocolate -> TOXIC');

// 18c. 通用词不得误命中更具体的食物
var zhGeneric = {
  '盐': null, '糖': null, '油': null, '水': null, '肉': null, '坚果': null, '水果': null, '奶': null
};
var zhMisHit = [];
Object.keys(zhGeneric).forEach(function (w) {
  var r = CDE.search(w);
  if (r.exact) zhMisHit.push('"' + w + '" -> ' + r.exact.id);
});
eq(zhMisHit.length, 0, 'ZH generic words never resolve to a specific food' + (zhMisHit.length ? ' -> ' + zhMisHit.join(',') : ''));
// 点名：盐 ≠ 夏威夷果 / 坚果
var zhSalt = CDE.search('盐');
ok(!(zhSalt.exact && zhSalt.exact.id === 'macadamia-nuts'), 'ZH "盐" does NOT mis-hit macadamia nuts');
ok(!(zhSalt.exact && zhSalt.exact.id === 'almonds'), 'ZH "盐" does NOT mis-hit almonds');
// 点名：葡萄 ≠ 葡萄干（不得做字符前缀放宽）
ok(CDE.search('葡萄').exact.id === 'grapes', 'ZH "葡萄" -> grapes (not raisins)');
ok(CDE.search('葡萄干').exact.id === 'raisins', 'ZH "葡萄干" -> raisins');
var zhGrape = CDE.search('葡萄');
ok(!(zhGrape.exact && zhGrape.exact.id === 'raisins'), 'ZH "葡萄" does NOT mis-hit raisins');

/* ===========================================================================
 * 测试 19：中文 UNKNOWN 保守路径 + 中文问句归一化 + XSS 不因中文放宽
 * =========================================================================*/
section('19. Chinese UNKNOWN & normalization & XSS');
['某某不存在', '不存在的食物', '龙肉', '火星果'].forEach(function (q) {
  var r = CDE.search(q);
  ok(r.unknown === true, 'ZH unmatched "' + q + '" -> unknown (no guessed level)');
  ok(!r.exact, 'ZH unmatched "' + q + '" has no exact level');
});

// 中文问句前后缀剥离
eq(CDE.normalize('狗狗能吃巧克力吗'), '巧克力', 'ZH normalize strips "狗狗能吃…吗"');
eq(CDE.normalize('狗能吃葡萄吗'), '葡萄', 'ZH normalize strips "狗能吃…吗"');
eq(CDE.normalize('巧克力能吃吗'), '巧克力', 'ZH normalize strips trailing "能吃吗"');
eq(CDE.normalize('木糖醇安全吗'), '木糖醇', 'ZH normalize strips trailing "安全吗"');
// 中文查询经归一化后仍命中
eq(zhId('狗狗能吃巧克力吗'), 'chocolate', 'ZH sentence "狗狗能吃巧克力吗" -> chocolate');

// 中文输入不因 CJK 保留而放宽 XSS 防护（危险字符仍被剥离）
var zhXss = CDE.normalize('<script>巧克力</script>');
ok(zhXss.indexOf('<') === -1 && zhXss.indexOf('>') === -1, 'ZH normalize still strips < > around CJK');
var zhXssSearch = CDE.search('"><script>alert(1)</script>巧克力');
ok(zhXssSearch.unknown === true || (zhXssSearch.exact && zhXssSearch.exact.id === 'chocolate'),
   'ZH XSS-laden input returns normal result, never executes');

// 恢复默认语言，避免影响后续（无后续断言，但保持干净）
CDE.setLang('en');

/* ===========================================================================
 * 测试 20：特征引导（Guided ID）—— 数据完整性（88 条 traits 全覆盖且合法）
 * =========================================================================*/
section('20. Guided ID — traits data integrity (88/88 valid)');

var T_ENUM = data.TRAITS_ENUM;
ok(T_ENUM && T_ENUM.colors && T_ENUM.shapes && T_ENUM.extras, 'TRAITS_ENUM exposes colors/shapes/extras');
var VALID_TRAIT = {
  colors: T_ENUM.colors.map(function (x) { return x.code; }),
  shapes: T_ENUM.shapes.map(function (x) { return x.code; }),
  extras: T_ENUM.extras.map(function (x) { return x.code; })
};
// 枚举规模固定（颜色 8 / 形态 6 / 其他 4）
eq(VALID_TRAIT.colors.length, 8, 'color enum has 8 codes');
eq(VALID_TRAIT.shapes.length, 6, 'shape enum has 6 codes');
eq(VALID_TRAIT.extras.length, 4, 'extra enum has 4 codes');

// 88 条全部有 traits，且三组都是数组、取值只在枚举内、每组至少一个 code（整条非空）
var tBad = [];
var tEmpty = [];
FOODS.forEach(function (f) {
  if (!f.traits || typeof f.traits !== 'object') { tBad.push(f.id + '.traits-missing'); return; }
  var total = 0;
  ['colors', 'shapes', 'extras'].forEach(function (g) {
    var arr = f.traits[g];
    if (!Array.isArray(arr)) { tBad.push(f.id + '.' + g + '-not-array'); return; }
    arr.forEach(function (code) {
      if (VALID_TRAIT[g].indexOf(code) === -1) tBad.push(f.id + '.' + g + ':' + code);
    });
    total += arr.length;
    // 组内不得重复
    if (arr.length !== arr.filter(function (v, i) { return arr.indexOf(v) === i; }).length) {
      tBad.push(f.id + '.' + g + '-dupe');
    }
  });
  if (total === 0) tEmpty.push(f.id);
});
eq(tBad.length, 0, 'all 88 foods have valid traits within the enum' + (tBad.length ? ' -> ' + tBad.slice(0, 6).join(',') : ''));
eq(tEmpty.length, 0, 'no food has a completely empty traits set' + (tEmpty.length ? ' -> ' + tEmpty.join(',') : ''));

// 每个食物 id 都有候选图标（emoji 或回退通用）
var noEmoji = FOODS.filter(function (f) { return !data.FOOD_EMOJI[f.id]; });
eq(noEmoji.length, 0, 'every food has a candidate emoji');

// 每个枚举 code 至少被一条食物使用（避免枚举里挂着永远匹配不到的孤儿 code）
var orphanCodes = [];
['colors', 'shapes', 'extras'].forEach(function (g) {
  VALID_TRAIT[g].forEach(function (code) {
    var used = FOODS.some(function (f) { return (f.traits[g] || []).indexOf(code) !== -1; });
    if (!used) orphanCodes.push(g + ':' + code);
  });
});
eq(orphanCodes.length, 0, 'every enum code is used by at least one food' + (orphanCodes.length ? ' -> ' + orphanCodes.join(',') : ''));

/* ===========================================================================
 * 测试 21：特征引导 —— 枚举与 i18n 标签键集合一致
 * =========================================================================*/
section('21. Guided ID — enum vs i18n label parity');
['colors', 'shapes', 'extras'].forEach(function (g) {
  var enumCodes = VALID_TRAIT[g].slice().sort().join(',');
  var enCodes = Object.keys(TRAITS.en[g]).slice().sort().join(',');
  var zhCodes = Object.keys(TRAITS.zh[g]).slice().sort().join(',');
  eq(enCodes, enumCodes, 'EN labels cover enum codes for group "' + g + '"');
  eq(zhCodes, enumCodes, 'ZH labels cover enum codes for group "' + g + '"');
});
// 标签非空
var emptyLabel = [];
['colors', 'shapes', 'extras'].forEach(function (g) {
  Object.keys(TRAITS.en[g]).forEach(function (c) {
    if (!String(TRAITS.en[g][c]).trim() || !String(TRAITS.zh[g][c]).trim()) emptyLabel.push(g + ':' + c);
  });
});
eq(emptyLabel.length, 0, 'no empty trait label in either language' + (emptyLabel.length ? ' -> ' + emptyLabel.join(',') : ''));
// CDE.traitLabel 在两种语言下都能解析并随语言变化
CDE.setLang('en');
eq(CDE.traitLabel('colors', 'red'), TRAITS.en.colors.red, 'traitLabel EN colors:red');
CDE.setLang('zh');
eq(CDE.traitLabel('colors', 'red'), TRAITS.zh.colors.red, 'traitLabel ZH colors:red');
ok(CDE.traitLabel('colors', 'red') !== TRAITS.en.colors.red, 'traitLabel changes with language');
eq(CDE.traitEmoji('shapes', 'bunch'), TRAITS_ENUM.shapes.filter(function (x) { return x.code === 'bunch'; })[0].emoji,
   'traitEmoji resolves the enum emoji');
CDE.setLang('en');

/* ===========================================================================
 * 测试 22：特征引导 —— 按大类过滤数量正确
 * =========================================================================*/
section('22. Guided ID — category filtering counts');
function filt(cat, feats) { return CDE.filterByTraits(FOODS, cat, feats || {}); }
function idsOf(list) { return list.map(function (f) { return f.id; }); }
function containsAll(list, want) {
  var ids = idsOf(list);
  return want.every(function (w) { return ids.indexOf(w) !== -1; });
}
function containsNone(list, bad) {
  var ids = idsOf(list);
  return bad.every(function (w) { return ids.indexOf(w) === -1; });
}
// 大类（无特征）数量与数据分布一致
eq(filt('fruit').length, 20, 'category fruit -> 20 foods');
eq(filt('vegetable').length, 22, 'category vegetable -> 22 foods');
eq(filt('protein').length, 12, 'category protein -> 12 foods');
eq(filt('dairy').length, 4, 'category dairy -> 4 foods');
eq(filt('grain').length, 7, 'category grain -> 7 foods');
eq(filt('nut').length, 7, 'category nut -> 7 foods');
eq(filt('drink').length, 11, 'category drink -> 11 foods');
eq(filt('processed').length, 5, 'category processed -> 5 foods');
// 空大类/无匹配特征
eq(filt(null).length, 88, 'no category -> all 88');
eq(filt('fruit', { colors: ['black'] }).length,
   FOODS.filter(function (f) { return f.category === 'fruit' && f.traits.colors.indexOf('black') !== -1; }).length,
   'feature filter is a subset of the category');

/* ===========================================================================
 * 测试 23：特征引导 —— 组合过滤（大类 + 颜色 + 形态）命中预期食物
 * =========================================================================*/
section('23. Guided ID — combined (category + color + shape) filtering');
// 水果 + 红 + 圆 + 小颗粒（用户对葡萄/樱桃的典型描述）
var combo = filt('fruit', { colors: ['red'], shapes: ['round', 'small'] });
ok(combo.length >= 3 && combo.length <= 10, 'fruit+red+round/small yields 3–10 candidates (' + combo.length + ')');
// 该组合必须落在「水果」大类内
ok(combo.every(function (f) { return f.category === 'fruit'; }), 'combo candidates are all fruits');
// 组内 OR：颜色红 + 形态(圆 或 小颗粒) —— 每个候选至少满足其一
ok(combo.every(function (f) {
  return f.traits.colors.indexOf('red') !== -1 &&
         (f.traits.shapes.indexOf('round') !== -1 || f.traits.shapes.indexOf('small') !== -1);
}), 'every combo candidate matches color-red AND (round OR small)');
// 提子类深色小颗粒：葡萄已归回 fruit（按用户直觉分类），紫+圆/小颗粒应同时命中葡萄与莓果类
var berryish = filt('fruit', { colors: ['purple'], shapes: ['round', 'small'] });
ok(containsAll(berryish, ['grapes', 'blueberries', 'blackberries', 'raspberries']),
   'fruit+purple+round/small hits grapes/blueberries/blackberries/raspberries');
ok(containsNone(berryish, ['apple', 'watermelon']), 'fruit+purple+round/small excludes apple/watermelon');
// 「红+圆+小颗粒」应命中樱桃 / 蔓越莓
var redRoundSmall = filt('fruit', { colors: ['red'], shapes: ['round', 'small'] });
ok(containsAll(redRoundSmall, ['cherries', 'cranberries', 'strawberries', 'raspberries']),
   'fruit+red+round/small hits cherries/cranberries/strawberries/raspberries');
// 葡萄已归 fruit：水果 + 紫 + 成串精确召回「成串葡萄」
var grapeCombo = filt('fruit', { colors: ['purple'], shapes: ['bunch'] });
ok(containsAll(grapeCombo, ['grapes']), 'fruit+purple+bunch hits grapes (cluster fruit)');
// 巧克力族归 drink（饮品与甜食）：甜食直觉，与糖果/蛋糕同类
var chocoCombo = filt('drink', { colors: ['brown'], shapes: ['chunk'] });
ok(containsAll(chocoCombo, ['chocolate', 'dark-chocolate']), 'drink+brown+chunk hits chocolate & dark-chocolate');
ok(containsNone(chocoCombo, ['onions', 'garlic', 'grapes']), 'drink+brown+chunk excludes onions/garlic/grapes');
// 液体 + 饮品/甜食：咖啡/茶/能量饮料/酒精
var liquids = filt('drink', { shapes: ['liquid'] });
ok(containsAll(liquids, ['coffee', 'tea', 'alcohol', 'energy-drinks']), 'drink+liquid hits coffee/tea/alcohol/energy-drinks');
// 坚果 + 棕 + 小颗粒
var nuts = filt('nut', { colors: ['brown'], shapes: ['small'] });
ok(containsAll(nuts, ['almonds', 'peanuts', 'pecans']), 'nut+brown+small hits almonds/peanuts/pecans');

/* ===========================================================================
 * 测试 23b：分类直觉回归 —— 毒性食物必须留在自然大类（用户怎么找就怎么分）
 * =========================================================================*/
section('23b. Category sanity — toxic foods stay in their natural category');
// 葡萄 = 水果（曾因肾毒性误归 processed，特征引导第 1 步选"水果"找不到）
var grapesFood = FOODS.filter(function (f) { return f.id === 'grapes'; })[0];
eq(grapesFood.category, 'fruit', 'grapes category is "fruit" (natural category, not toxicity-clustered)');
ok(containsAll(filt('fruit'), ['grapes', 'raisins']),
   'guided-ID "fruit" category filter finds grapes & raisins');
// 葱蒜族 = 蔬菜（天然蔬菜，不因溶血性毒性归 processed）
['onions', 'garlic', 'leeks', 'chives', 'scallions'].forEach(function (id) {
  var f = FOODS.filter(function (x) { return x.id === id; })[0];
  eq(f.category, 'vegetable', id + ' stays in vegetable (alliums are vegetables)');
});
// 巧克力族 = 饮品与甜食（甜食直觉，与糖果/蛋糕同类）
['chocolate', 'dark-chocolate', 'white-chocolate', 'nutella'].forEach(function (id) {
  var f = FOODS.filter(function (x) { return x.id === id; })[0];
  eq(f.category, 'drink', id + ' stays in drink (Drinks & Sweets)');
});
// 分类调整只动 category：判定数据（level 等）必须原样保留
eq(grapesFood.level, 'severe', 'grapes level stays SEVERE after recategorization');

/* ===========================================================================
 * 测试 24：特征引导 —— 候选为空走 UNKNOWN 保守分支（绝不猜等级）
 * =========================================================================*/
section('24. Guided ID — empty candidate -> conservative, never a guessed level');
// 水果 + 液体：没有任何水果是液体 → 0 候选
var noLiquidFruit = filt('fruit', { shapes: ['liquid'] });
eq(noLiquidFruit.length, 0, 'fruit+liquid yields 0 candidates (no fruit is a liquid)');
// 该空集不得被任何“猜测”逻辑填充
ok(noLiquidFruit.every(function (f) { return false; }), 'empty candidate set contains no foods');
// 另一空组合：蔬菜 + 液体
eq(filt('vegetable', { shapes: ['liquid'] }).length, 0, 'vegetable+liquid yields 0 candidates');
// 空集仍是「保守」：绝不返回任何带等级的条目（这也是 UI 走 UNKNOWN 分支的依据）
['dairy', 'grain'].forEach(function (cat) {
  var l = filt(cat, { shapes: ['bunch'] });
  eq(l.length, 0, cat + '+bunch yields 0 candidates (conservative)');
});
// 特征引导不产生任何“合成/猜测”条目：所有候选都必须来自 FOODS 且带真实 level
var allCombos = [
  ['fruit', { shapes: ['liquid'] }],
  ['vegetable', { colors: ['purple'] }],
  ['processed', { shapes: ['bunch'] }]
];
allCombos.forEach(function (pair, i) {
  var list = filt(pair[0], pair[1]);
  ok(list.every(function (f) { return FOODS.indexOf(f) !== -1 && VALID_LEVELS.indexOf(f.level) !== -1; }),
     'combo #' + i + ' only yields real FOODS entries with a real level');
});
// 反向：每个候选都能通过「特征引导 → 既有 search(id)」拿到同一等级的卡片（安全结论同源）
var sampleCand = filt('fruit', { colors: ['red'] });
sampleCand.forEach(function (f) {
  var r = CDE.search(f.id);
  ok(r.exact && r.exact.id === f.id && r.exact.level === f.level,
     'candidate ' + f.id + ' safely resolves to the same verdict via search()');
});

/* ===========================================================================
 * 测试 25：特征引导 —— i18n 新键完整且双语一致
 * =========================================================================*/
section('25. Guided ID — i18n identify.* keys present & bilingual');
var identifyKeys = Object.keys(I18N.en).filter(function (k) { return k.indexOf('identify.') === 0; });
ok(identifyKeys.length >= 20, 'identify.* has a substantial key set (' + identifyKeys.length + ')');
identifyKeys.forEach(function (k) {
  ok(typeof I18N.zh[k] === 'string' && I18N.zh[k].trim().length > 0, 'ZH has non-empty "' + k + '"');
  ok(typeof I18N.en[k] === 'string' && I18N.en[k].trim().length > 0, 'EN has non-empty "' + k + '"');
});
// 关键键存在（入口按钮、步骤标题、兜底）
['identify.cta', 'identify.step1Title', 'identify.step2Title', 'identify.step3Title',
 'identify.emptyTitle', 'identify.back', 'identify.close', 'identify.reset',
 'identify.groupColors', 'identify.groupShapes', 'identify.groupExtras'].forEach(function (k) {
  ok(Object.prototype.hasOwnProperty.call(I18N.en, k), 'EN has key ' + k);
  ok(Object.prototype.hasOwnProperty.call(I18N.zh, k), 'ZH has key ' + k);
});
// 中文入口按钮确实是中文，英文入口是英文（避免误配）
ok(/不.?认识|名字/.test(I18N.zh['identify.cta']), 'ZH cta mentions "don\'t know the name"');
ok(/name/i.test(I18N.en['identify.cta']), 'EN cta mentions the name');

/* ===========================================================================
 * 测试 26：特征引导 —— traitLabel 未知 code 安全回退（不抛错、不返回 undefined）
 * =========================================================================*/
section('26. Guided ID — label/emoji safe fallbacks');
eq(CDE.traitLabel('colors', 'does-not-exist'), 'does-not-exist', 'unknown trait code falls back to the code itself');
eq(CDE.traitEmoji('colors', 'does-not-exist'), '', 'unknown trait emoji falls back to empty string (no throw)');
eq(CDE.traitEmoji('nope', 'red'), '', 'unknown trait group returns empty string (no throw)');
eq(CDE.filterByTraits(FOODS, 'fruit', { colors: [] }).length, 20, 'empty feature array is treated as "no constraint"');
eq(CDE.filterByTraits(null, 'fruit', {}).length, 0, 'null food list is handled safely');

/* ===========================================================================
 * 汇总
 * =========================================================================*/
console.log('\n' + '='.repeat(56));
console.log('PASS: ' + PASS + '   FAIL: ' + FAIL);
if (FAIL > 0) {
  console.log('\nFailures:');
  FAILURES.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
} else {
  console.log('All core-logic tests passed.');
  process.exit(0);
}
