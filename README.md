# CanDogsEat — Dog Food Safety Checker

> **测试版（test build），未上线。** 纯前端、零依赖、断网可用。数据判定转述 ASPCA / AKC / PetMD 等公开资料，逐条带来源编号。
> 流水线：每日产品流水线第 ④ 步 ｜ 日期：2026-10-03 ｜ 输入：`03-requirements.md` + `03-design.md`
> 状态：已根据 `05-test-report.md` 完成 4 处缺陷（P1-①/②、P2-③/④）定向修复并通过回归，见「已修复缺陷」。
> 新增：**中英双语支持**（单代码源 + 语言切换，含中文搜索与中文硬规则），见「双语支持（i18n）」。
> 新增：**特征引导查询（Guided ID）**——不知道食物名字时，按「大类 + 外观特征」反查（纯前端，无图像识别/AI），见「特征引导查询（Guided ID）」。

---

## 一句话产品

养狗人输入一个食物名，**3 秒内**得到"安全 / 适量 / 谨慎 / 有毒 / 剧毒"五级判定 + 原因 + 症状 + 应对建议；误食场景首屏直接给紧急就医指引与中毒热线。零注册、纯本地查表、无任何网络请求。

---

## 如何本地预览

### 方式 1：直接双击（推荐，验证"断网可用"）

直接双击 `index.html`，用浏览器打开即可（`file://` 协议全功能可用，无网络请求）。

### 方式 2：本地静态服务器

```bash
cd runs/2026-10-03/04-webapp
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080/
```

> 也可用 `npx serve .` 或任意静态服务器。无需 `npm install`，无构建步骤。

---

## 文件清单

| 文件 | 行数 | 作用 |
|---|---|---|
| `index.html` | 340 | 语义化骨架、全部元素 ID、SEO meta、JSON-LD、noscript 静态清单、语言切换按钮、**特征引导入口 + 弹层骨架**、3 广告位 + 1 联盟位注释、免责声明、**静态落地页索引区**（脚本生成，88 内链） |
| `style.css` | 662 | 五级配色变量、卡片/徽章/chips/对比网格、语言切换按钮、**特征引导弹层与候选卡样式**、三档响应式、动画、WCAG 对比度 |
| `i18n.js` | 454 | **EN / ZH 双字典（各 127 键）** + 5 级等级名 + 8 分类名 + **TRAITS 特征标签字典**；UI 文案唯一事实源 |
| `data.js` | 1524 | `SOURCES` 溯源表 + `CATEGORY_META` + `LEVEL_META` + **`TRAITS_ENUM` 特征枚举 + `FOOD_EMOJI` 候选图标** + **88 条 `FOODS`**（每条含中文 `nameZh`/`aliasesZh` 与 `traits` 特征字段） |
| `app.js` | 1869 | 索引构建（中英双索引） / 归一化（含 CJK） / 判定漏斗 / 渲染（textContent 安全路径） / i18n 切换重渲染 / **特征引导向导（filterByTraits + 三步状态机 + 候选卡）** / 路由 / localStorage / 对比栏 |
| `selftest.js` | 948 | Node 环境核心逻辑自测（**482 断言**：旧 333 + 特征引导 137 + 分类直觉回归 12） |
| `selftest_browser.py` | 545 | Playwright headless 冒烟测试（**97 断言**：旧 57 + 特征引导端到端 37 + 分类直觉回归 3） |
| `foods/` | 88 文件 | **静态落地页**（`foods/<id>.html`）——纯静态 HTML、不依赖 JS、含完整判定/症状/建议/来源 + 双语 + JSON-LD + canonical + 内链；由脚本从 `data.js` 生成 |
| `build/generate-foods-pages.js` | — | **落地页 / sitemap / robots 生成脚本**（数据同源，可重跑，支持传入真实域名） |
| `sitemap.xml` | — | 主页 + 88 落地页（89 条 URL），占位域名 `www.example.com` 待替换 |
| `robots.txt` | — | 允许全部爬虫 + 指向 sitemap |
| `vercel.json` | — | Vercel 部署配置：干净 URL 重写 + 缓存策略 + 安全响应头 |
| `README.md` | — | 本文件 |

**产品资源体积**（index + css + i18n + data + app，未压缩）：约 **178 KB**（设计要求 < 120KB；超出的部分主要来自 88 条英文判定文案与中英双字典，见"未实现/占位项"）。

---

## 已实现功能（对照需求 F1–F10）

| 编号 | 功能 | 状态 | 说明 |
|---|---|---|---|
| F1 | 核心搜索判定 | ✅ | 输入回车/点击即出卡；大字等级徽章（色块 + 图标 + 文字三重编码）；原因/症状/建议/来源/免责行齐全；**无 loading spinner**（本地查表 <100ms） |
| F2 | 自动补全 | ✅ | ≥1 字符触发（80ms 防抖），≤8 条；↑↓ 键盘选择、Enter 确认、Esc 关闭；`aria-expanded`/`aria-activedescendant` 同步；无匹配时提示"按 Enter 看保守答案" |
| F3 | 紧急指引区 | ✅ | 常驻 `#emergency-banner` 折叠条 + 结果卡内嵌紧急横幅（severe/toxic）；含"记录 what/how much/when"、ASPCA (888) 426-4435、Pet Poison Helpline (855) 764-7661、"不要自行催吐" |
| F4 | 常见食物快捷入口 | ✅ | 10 个 chips：Chocolate / Grapes / Apples / Chicken / Cheese / Bananas / Peanut Butter / Watermelon / Eggs / Strawberries |
| F5 | 多食物对比栏 | ✅ | "＋ Add to compare"，上限 4；`#compare-tray` + `#compare-grid`（`auto-fit minmax(160px,1fr)`，移动端自然 2×2）；localStorage 持久化 |
| F6 | 分类浏览索引 | ✅ | 8 大类共 **88 行**判定文本直接渲染进 DOM（利于 SEO 可爬取）；每行可点击出卡 |
| F7 | 免责声明 | ✅ | 每张结果卡固定免责行 + 链接页脚完整版；页脚 4 点完整声明含"非兽医诊断、紧急请就医、含热线" |
| F8 | 未收录保守兜底 | ✅ | `UNKNOWN` 灰卡：**"We don't have this food in our database yet — and that does NOT mean it's safe."** + 通用原则 + 建议咨询兽医；**绝不输出猜测等级** |
| F9 | 最近查询 | ✅ | localStorage `cde_recent` 存最近 10 条（仅食物名/id）；隐私模式 try/catch 降级内存态 |
| F10 | 广告位与 SEO 占位 | ✅ | 3 个广告位 + 1 个联盟位**仅注释占位**（`AD_SLOT_1/2/3`、`AFFILIATE_SLOT`）；meta/OG/JSON-LD 已配置 |
| F11 | 特征引导查询（Guided ID） | ✅ | 不知道名字时按「大类 + 外观特征（颜色/形态/其他）」三步向导反查；候选缩略卡（EN+ZH+等级徽章）；点选走既有结果卡；空候选走 UNKNOWN 保守卡；入口 `#/identify` 深链；双语。**纯前端，无图像识别/AI、零网络** |

### 关键规则（设计书硬性要求）

- ✅ **① UNKNOWN 保守卡**：查不到即走灰色 UNKNOWN 卡，绝不猜等级（见 `app.js` `search()` 规则 ⑤）。
- ✅ **② 木糖醇强制叠加**：输入含 `sugar-free` / `sugar free` / `sugarfree` / `xylitol` / `birch sugar` 时，**无条件在结果之上置顶 SEVERE 木糖醇警示卡**（`xylitolAlert` 标志，见 R1）；裸 `sugar` / `sugar cookie` / `sugarcane` **不触发**，且不再被误判为木糖醇条目（缺陷 P1-① 修复）。
- ✅ **③ 巧克力子类型分级**：`dark / bitter / baking / cocoa / semisweet` → **SEVERE**；`white chocolate` → **CAUTION**；其余含 `choc` → 默认 **TOXIC**（见 R2）。
- ✅ 额外：raw + (chicken/egg/fish/meat/salmon/pork) 触发多候选并列提示（R3）。

### 其他已实现

- 语义化 HTML（h1→h2→h3）、`aria-live`（toxic/severe 用 `assertive`）、键盘全可达、skip-link。
- 5 级配色满足 WCAG AA；徽章不单靠颜色（图标 + 文字）。
- 移动端：单列、搜索区 sticky、对比 2 列、输入字号 17px（≥16px）、触控目标 ≥44px。
- hash 深链 `#/food/<id>`（分享/收藏直达，刷新可恢复）。
- 全部外链 `target="_blank" rel="noopener noreferrer"`。
- 零网络请求、无 cookie、无追踪、无登录、无支付、无外部数据库。

---

## 88 种食物清单概览

按 `CATEGORY_META` 8 大类（合计 **88 条**）：

| 分类 | 数量 | 等级分布要点 |
|---|---|---|
| **Fruits** | 20 | safe: 苹果/香蕉/蓝莓/草莓/西瓜/树莓/黑莓；moderation: 哈密瓜/芒果/菠萝/桃/梨/橙/蔓越莓；caution: 樱桃/柠檬莱姆/番茄/牛油果；**severe: 葡萄/葡萄干** |
| **Vegetables** | 22 | safe: 胡萝卜/黄瓜/青豆/豌豆/南瓜/红薯；moderation: 西兰花/花椰菜/芹菜/菠菜/卷心菜/玉米/土豆/芦笋/甜椒；caution: 羽衣甘蓝/蘑菇；**toxic: 洋葱/大蒜/韭葱/香葱/小葱红葱头** |
| **Proteins** | 12 | safe: 鸡肉/火鸡肉/牛肉/鸡蛋/鱼/三文鱼；moderation: 猪肉/金枪鱼/虾/火腿；caution: 生肉/骨头 |
| **Dairy & Eggs** | 4 | moderation: 牛奶/奶酪/酸奶；caution: 冰淇淋 |
| **Grains & Staples** | 7 | safe: 米饭/燕麦/藜麦；moderation: 面包/意面/爆米花；**severe: 生面团** |
| **Nuts & Seeds** | 7 | **toxic: 夏威夷果**；caution: 杏仁/核桃/碧根果；moderation: 花生/腰果/花生酱 |
| **Drinks & Sweets** | 11 | **severe: 黑巧克力/酒精**；**toxic: 咖啡/茶/能量饮料/巧克力/榛子巧克力酱**；caution: 白巧克力/糖果/蛋糕饼干；moderation: 蜂蜜 |
| **Processed & Toxic** | 5 | **severe: 木糖醇**；caution: 薯条/披萨/热狗与加工肉/番茄酱 |

**五级分布**：safe ×22 · moderation ×30 · caution ×19 · toxic ×11 · severe ×6（合计 88，详单以 `data.js` 为准）。

**全部来源可溯源**：`data.js` 顶部 `SOURCES` 表（ASPCA-1 / AKC-2 / AKC-3 / AKC-4 / PETMD-5 / VET-6 / EMERG-7），每条 `food.sources` 编号均解析到对应机构外链。机构分歧处（牛油果/菠菜/羽衣甘蓝/番茄）已取**保守等级**并在 `reason` 内注明。

---

## 双语支持（i18n）

采用**单代码源 + 语言切换**方案：中英两套界面共用同一份 `data.js` / `app.js` / `index.html`，只把文案抽进 `i18n.js`。不另起 `zh.html`，从根上避免"双库漂移"（改一处、漏一处）与 SEO 重复内容问题。

### 默认语言与切换方式

- **默认英文**（`<html lang="en">`），首屏即英文，无需 JS 决策。
- 顶栏右侧 `EN | 中文` 分组按钮切换；当前语言按钮高亮（`aria-pressed` / `.is-active`）。
- **偏好持久化**：写入 `localStorage['cde_lang']`，刷新/重开自动恢复；隐私模式下 `try/catch` 降级为内存态（不报错）。
- **切换不刷新、不丢输入**：`switchLang()` 只改 `lang` 状态后调用 `renderAll()` 全量重渲染，**不重载页面**；输入框内容与已渲染的结果卡/对比栏原样保留，并按新语言重绘文案。

### 哪些内容翻译 / 哪些保留英文

| 内容 | 处理 |
|---|---|
| 页面标题、导航、搜索占位符与按钮、提示语 | ✅ 走 i18n 字典（`data-i18n` / `data-i18n-placeholder` / `data-i18n-aria-label` 属性驱动静态刷新） |
| 五级安全等级名称（安全 / 适量 / 谨慎 / 有毒 / 剧毒） | ✅ `LEVEL_LABELS`（badge + short 两套） |
| 8 个分类名称、索引区标题与描述、空态 / 未找到 / UNKNOWN 提示、对比栏、快捷 chips、FAQ、footer、免责声明、紧急就医指引 | ✅ 全部走字典 |
| 食物名称 | ✅ 88 条全部有 `nameZh`（中文名） |
| 食物 `reason` / `symptoms` / `advice` / `emergency` / `dosageNote` | ✅ 全部 17 条 toxic/severe 级食物提供**完整中文译文**；其余等级以中文优先、缺失时回退英文，保证 `level` 与关键 `advice` 中文正确 |
| 机构名（ASPCA / AKC / PetMD）、热线号、来源标题、连字符 slug/id（如 `lemons-limes`） | ⬜ 有意保留英文原文（专有名词/号码/语言无关标识） |

### 中文搜索能力（关键实现）

- **88/88 覆盖**：`data.js` 每条食物新增 `nameZh` 与中文俗称 `aliasesZh`；`buildIndex()` 额外注册「括号前短名」「括号内俗称」及其归一化形态（如 `牛油果（鳄梨）` 同时可按 `牛油果`、`鳄梨` 检索）。
- **同一套分层漏斗**：中文查询复用既有策略——**精确 → 词边界 → 分词精确 → UNKNOWN 保守**，绝不因匹配放宽而猜等级。
- **CJK 归一化**：`normalize()` 保留 `\u3400-\u4dbf\u4e00-\u9fff`（中日韩统一表意文字），同时**仍剥离 HTML 危险字符**（XSS 防护不失效）；额外剥离中文问句前后缀（`狗狗能吃 X 吗` / `能吃吗` / `安全吗` / `吗` / `呢` / `么`）。
- **不按字符前缀放宽**：CJK 不参与前缀补全，`葡萄` 不会命中 `葡萄干`（`grapes` ≠ `raisins`）。
- **中文硬规则同样生效**：
  - **R1 木糖醇**：输入含 `木糖醇` / `无糖口香糖` 等 → 强制置顶 **SEVERE** 木糖醇警示；裸「糖」**不**触发（与英文裸 `sugar` 一致），`糖果` 正常落到 `candy`。
  - **R2 巧克力子类型**：`黑巧克力`/`烘焙巧克力` → **SEVERE**，`白巧克力` → **CAUTION**，其余「巧克力」→ **TOXIC**（`巧克力` / `黑巧克力` / `白巧克力` 分级正确）。
  - **R3 raw 修饰词** 仅对英文索引生效（中文无对应副词形态，不参与）。
- **通用词保守**：`盐`、`糖` 等通用裸词不误命中长别名（`盐` 不会命中杏仁、`糖` 不会命中糖果），一律走 UNKNOWN 保守卡。

---

## 特征引导查询（Guided ID）

### 解决什么问题

搜索框要求用户**知道食物的名字**（英文或中文）。但真实场景里，用户常常看着一个东西——「某种红色的、圆圆的、一颗颗串在一起的水果」——却叫不出名字。特征引导让这类用户不靠名字也能找到判定。

> **明确约束：这是纯前端交互方案，不做 AI 图像识别。** 不引入任何模型文件、不调用任何外部 API，**零网络请求不变**，判定数据仍 100% 来自核验过的 `FOODS`。

### 入口

搜索框下方新增「**I don't know the name / 不认识食物的名字**」按钮（🧭 图标，双语）。点击打开向导弹层；也支持深链 `#/identify` 直达。

### 使用流程（向导式 3 步）

1. **第 1 步 · 选大类（单选）**：水果 / 蔬菜 / 蛋白·肉类 / 乳制品 / 主食·谷物 / 坚果·种子 / 饮品·甜食 / 加工食品·其他。**直接复用 `data.js` 现有 category 与 `i18n.js` 的 `CATEGORY_LABELS`**，不另造分类。
2. **第 2 步 · 选特征（多选，可跳过）**：颜色 / 形态 / 其他三组 chip。组内为「或」（满足任一即可），组间为「与」（每组都要命中）。**可只选大类直接跳过**。
3. **第 3 步 · 候选确认**：按「大类 + 已选特征」过滤，以缩略卡展示候选（emoji + 食物名 **EN+ZH** + 等级徽章）。点选某个候选 → **关闭弹层并进入现有判定流程**（复用 `openFood()` / `renderCard()`，安全结论来自核验数据）。
4. **兜底**：候选为 0（或用户都不认识，点「返回上一步」改特征）→ 展示 **UNKNOWN 保守卡** + 紧急就医指引（复用现有 `emergencyBlock` 与免责声明，含 ASPCA (888) 426-4435 热线）。

交互细节：可**返回上一步**、可**随时关闭**（关闭按钮 / 点遮罩 / ESC 键）、可**重新开始**；选中态高亮（实心 + ✓，不只靠颜色）；移动端 390px 优先（大按钮、触区 ≥44px、候选 2 列）。

### 特征枚举设计（固定枚举，集中定义）

| 组 | 数量 | 标签（code） |
|---|---|---|
| **颜色 colors** | 8 | 红 red · 绿 green · 黄 yellow · 橙 orange · 棕 brown · 黑 black · 白 white · 紫 purple |
| **形态 shapes** | 6 | 圆的 round · 成串 bunch · 小颗粒 small · 片状 flat · 大块 chunk · 液体 liquid |
| **其他 extras** | 4 | 有皮·需剥 peel · 有核 pit · 常见零食 snack · 加工制品 processed |

- **code 唯一事实源**：`data.js` 的 `TRAITS_ENUM`（含每 code 的 emoji）。食物 `traits` 字段**只存 code**。
- **标签唯一事实源**：`i18n.js` 的 `TRAITS`（EN/ZH 双语），**禁止散落硬编码**。
- 一致性由 `selftest.js` 校验：**枚举 code ↔ EN 标签 ↔ ZH 标签三者键集合完全一致**，且每个 code 至少被一条食物使用（无孤儿 code）。

### 88 条覆盖情况

| 项目 | 结果 |
|---|---|
| `traits` 字段覆盖 | **88 / 88**（每条含 `colors` / `shapes` / `extras` 三组，取值全在枚举内，无缝重复、无空集） |
| 候选图标 | **88 / 88** 有 emoji（`FOOD_EMOJI`，用于缩略卡视觉提示，**非安全信息**） |
| 大类过滤数量 | 与数据分布一致：水果 20 · 蔬菜 22 · 蛋白 12 · 乳制品 4 · 主食 7 · 坚果 7 · 饮品 11 · 加工 5 |
| 组合示例 | 「水果 + 红 + 圆 + 小颗粒」→ 7 个候选（苹果/草莓/西瓜/树莓/蔓越莓/樱桃/番茄）；「水果 + 紫 + 成串」→ 葡萄；「饮品·甜食 + 棕 + 大块」→ 巧克力/黑巧克力 |

> 分类纪律：**category 跟随「用户怎么找」（自然大类），不跟随毒性聚类**——毒性信息由 `level` + `reason` 表达，不靠分类强调。葡萄/葡萄干归「水果」、葱蒜族归「蔬菜」、巧克力族归「饮品·甜食」；`processed` 仅保留无自然大类可归的真加工品（木糖醇/薯条/披萨/热狗/番茄酱）。

### 设计理由（为什么这样做）

1. **零 AI、零网络**：图像识别会引入模型体积、成本、离线失效与合规风险；用「大类 + 固定特征枚举」做**索引辅助**即可覆盖多数「叫不出名字」的场景，且保持断网可用、隐私友好。
2. **判定纪律不变（核心）**：特征引导**绝不自行给出等级**。它只做「过滤/召回」，命中的食物一律走既有结果卡，未命中走 UNKNOWN。安全结论与数据来源单一，不存在「第二条判定路径」。
3. **可解释的召回**：组合是「组内或、组间与」，用户每选一个特征都在收窄集合；step 3 回显已选特征，候选过多时（>10）引导回到第 2 步继续选，避免一次抛出长列表。
4. **单代码源复用**：分类、等级、双语标签、免责与紧急模块全部复用既有实现，无重复硬编码，语言切换后向导文案自动重绘。

---

## SEO 资产与部署配置（上线准备）

面向「Vercel 免备案 + 海外英语市场」上线，本版补齐了全部 SEO 资产与部署配置。**配套的非技术用户操作指引见同目录 `runs/2026-10-03/上线手册.md`。**

### 88 个静态落地页 `foods/<id>.html`

- **纯静态、不依赖 JS**：完整判定内容（等级 / 原因 / 症状 / 应对建议 / 剂量 / 来源）全部是 HTML 文本，**禁用 JavaScript 也能读全**（爬虫直接可读）。已用 Playwright `java_script_enabled=False` 验证核心文本仍在。
- **双语**：EN 为主在前，ZH 段落附后（`<section lang="zh">`）。
- **顶部醒目免责声明**：每页首个可见元素即「General information only — not veterinary advice + 双热线」。
- **canonical 指向自身**：`https://<域名>/foods/<id>`（无 `.html` 后缀的干净 URL）。
- **JSON-LD**：每页内嵌 `@graph`（Article + WebPage + BreadcrumbList），Article 带 `about`（食物安全的 `Thing` 事实性描述）、`citation`（指向 ASPCA/AKC 来源外链）、`dateModified`。
- **内链网**：面包屑（主页 › 分类 › 本页）、相关食物（同分类最多 6 条）、**全量 88 条分类索引**，SEO 内链充分。
- **数据同源**：全部从 `data.js` 读取生成，**无手抄**；88/88 条 JSON-LD 均可 `JSON.parse`。

### 生成脚本 `build/generate-foods-pages.js`

```bash
cd runs/2026-10-03/04-webapp

# 用占位域名 www.example.com 生成（默认）
node build/generate-foods-pages.js

# 上线后传入真实域名，一键批量替换所有占位域名
node build/generate-foods-pages.js https://your-domain.com
# 或：SITE_URL=https://your-domain.com node build/generate-foods-pages.js
```

脚本用 Node `vm` 沙箱加载 `data.js` / `i18n.js` 取数据（唯一事实源），产物：
- `foods/<id>.html` × 88
- `sitemap.xml`（主页 + 88 落地页 = 89 条 URL，`<lastmod>` 取 `checked` 字段）
- `robots.txt`（允许全部爬虫 + `Sitemap:` 指向）
- 同步 `index.html` 的**静态落地页索引区**（哨兵注释 `FOODS-STATIC-INDEX:START/END` 包裹，重跑整体替换，不破坏其它功能）

**可重跑**：数据更新后重跑脚本即可，产物幂等；`www.example.com` 为占位域名，上线后传真实域名重跑。

### `sitemap.xml` / `robots.txt`

- sitemap：主页 `priority 1.0` + 88 落地页 `priority 0.7`。
- robots：`User-agent: * / Allow: /` + `Sitemap: <域名>/sitemap.xml`。

### `vercel.json` 配置要点

- **干净 URL**：`cleanUrls: true` + `trailingSlash: false`；`rewrites` 把 `/foods/:id` 重写到 `/foods/:id.html`（访问 `/foods/grapes` 无需 `.html`）。
- **缓存策略**：JS/CSS/图片长缓存（`max-age=31536000, immutable`）；HTML 短缓存（`max-age=0, must-revalidate`）；`sitemap.xml` 1 小时 + 正确 Content-Type。
- **安全响应头**：`X-Content-Type-Options: nosniff`、`Referrer-Policy`、`X-Frame-Options: SAMEORIGIN`、`Permissions-Policy`。

### OG 标签

- 主页已补 `og:site_name`；`og:image` 因无图片资源**有意省略并留注释**（含添加方法），不影响 SEO。
- 落地页含 `og:type=article` / `og:title` / `og:description` / `og:url` + Twitter card。

---

## 如何本地自测

```bash
cd runs/2026-10-03/04-webapp

# 1) 核心逻辑（Node，无浏览器依赖）
node selftest.js
# -> PASS: 482   FAIL: 0

# 2) 浏览器冒烟（需已安装 Python playwright + chromium）
python3 selftest_browser.py
# -> PASS: 97   FAIL: 0
```

### 本次自测结果

| 测试 | 断言数 | 结果 |
|---|---|---|
| `selftest.js`（数据完整性 / 判定正确性 / 别名 / UNKNOWN / 木糖醇 / 巧克力 / XSS / 归一化 / 联想 / 缺陷回归 / 别名自解析扫描 / 中文数据完整性 / 中文字典一致性 / 中文查询命中 / 中文硬规则 / 中文 UNKNOWN·归一化·XSS / **特征引导：traits 完整性·枚举↔i18n 一致·大类过滤·组合过滤·空候选保守·i18n 键·安全回退·分类直觉回归**） | 482 | ✅ 全部通过 |
| `selftest_browser.py`（Playwright headless：加载无错 / 零网络 / 搜索交互 / 结果卡 / 木糖醇 / UNKNOWN / 巧克力子类 / 88 行索引 / 免责 / 对比 / 外链安全 / 390·768·1440 无溢出 / 深链 / 中文切换 / **特征引导端到端：入口·选大类·选特征·候选·点选出卡·返回·关闭·空候选兜底·#/identify 深链·390px 不溢出·触控≥44px·双语切换·水果大类下可找到葡萄**） | 97 | ✅ 全部通过 |

**关键验证点**：
- 零网络请求（非 `file://` 请求数 = 0），加载无 console/page error。
- 判定与验收表 6.1 一致：`chocolate`→TOXIC、`grapes`→SEVERE、`onion`→TOXIC、`apple`→SAFE、`milk`→MODERATION、`macadamia nuts`→TOXIC、`pizza`→CAUTION、`asdfgh123`→UNKNOWN。
- `dark/bitter/baking/cocoa/semisweet`→SEVERE，`white chocolate`→CAUTION，默认 `chocolate`→TOXIC。
- `sugar-free gum` / `xylitol` / `birch sugar` 触发置顶 SEVERE 木糖醇警示；普通 `sugar` 不误触发。
- XSS payload（`<script>`、`<img onerror>` 等）经归一化剥离危险字符，不产生可执行结构，页面不崩溃。
- 移动端 390px 无横向滚动，输入字号 17px；768/1440px 同样无溢出。
- 全部外链含 `rel="noopener"`。
- **中文模式**：88 条中文名全部可检索；`巧克力`→TOXIC、`黑巧克力`→SEVERE、`白巧克力`→CAUTION、`葡萄`→SEVERE、`木糖醇`→SEVERE 并置顶警示、`盐`→UNKNOWN（不误命中杏仁）、`糖`→UNKNOWN（`糖果`→CAUTION）；切换语言后输入与结果保留、文案随语言重绘、刷新后仍为中文、390px 中文无溢出。
- **特征引导（Guided ID）**：88/88 条 `traits` 合法且枚举↔i18n 键集合一致；点入口→选大类→选特征→候选出现→点选进入结果卡全链路可用；返回上一步 / ESC / 关闭按钮均正常；空候选（水果+液体）走 UNKNOWN 保守卡且保留 (888) 热线与免责；`#/identify` 深链可直达；390px 无横向溢出、特征 chip 触高 ≥44px；切换中文后入口/步骤标题/分类/特征/候选名全部变中文。

---

## 已修复缺陷（测试验收后定向修复，2026-10-03）

> 依据 `05-test-report.md` 缺陷清单，核心根因统一为「判定漏斗子串/前缀匹配过宽 + 别名定义过泛」。
> 修复约束：纯前端、零网络、无新依赖、textContent 安全渲染、移动端不破版；**未改动任何食物等级数据**。

| 缺陷 | 现象 | 根因 | 修复 |
|---|---|---|---|
| **P1-①** | 输入 `sugar` → 误判木糖醇 **SEVERE** | `data.js` 把裸 `sugar-free`/`sugar free`/`sugarfree` 注册为 xylitol 别名；`app.js` 子串匹配命中 | 收窄别名（只保留 `sugar-free gum`/`sugarfree gum`/`sugar free gum`/`sugar-free candy`）；判定改为词边界；R1 强制兜底仅在真触发短语时落到 xylitol |
| **P1-②** | 输入 `salt` → 误判 **Almonds (CAUTION)** | `data.js:761` 别名 `salted almonds` 含子串 `salt` | 删除 `salted almonds` 别名（盐焗说明已在 reason/advice 中）；词边界匹配使 `salt` 不再命中 |
| **P2-③** | 输入 `water` → 误判 **Watermelon (SAFE)** | 前缀匹配 `water` ⊂ `watermelon` | 判定漏斗**移除前缀补全**；前缀仅用于联想候选 `suggest()`。`water` 现走 UNKNOWN 保守卡 |
| **P2-④** | `white-chocolate` → **chocolate (TOXIC)**；与 `white chocolate`(CAUTION) 不一致 | normalize 保留连字符，R2 的 `/\bchoc\b|chocolate/` 先于别名匹配截胡 | R2 改用「连字符→空格」等价串匹配，`white-chocolate ≡ white chocolate` → CAUTION；连字符 id 直查（`lemons-limes` 等）依旧保留 |

**顺带自查发现并修复的同类隐患**：
- `chocolate spread`（Nutella 别名）曾被 R2 泛 `chocolate` 规则截胡 → 现正确落到 `nutella`（精确别名优先于泛规则）。

### 匹配策略（写入 `app.js` 注释）

判定漏斗由宽松子串改为**分层收敛**，杜绝「短通用词 ⊂ 长别名」的误命中：

1. **精确匹配（最高优先）**：整串等价。含连字符 slug/id 直查靠此步（如 `lemons-limes`）。
2. **词边界匹配**：按「词」而非「字符」相等——`salt` 不会命中 `salted almonds`（`salted≠salt`），但整串 `salted almonds` 仍命中。
3. **分词精确**：整个输入未命中时取完整词逐个精确查（`cooked chicken` > chicken）。
4. **无前缀补全**：判定环节不做字符前缀补全（那会把 `water` 吞成 `watermelon`）；前缀补全仅保留在联想下拉 `suggest()`。
5. **子串仅用于联想**：`findBySubstring` 只服务 `suggest()`，且加词边界约束，不再参与判定。
6. **连字符等价**：判定前将 `-` 视作空格（`hyphenSpace`），使连字符写法与空格写法结果一致，同时 `normalize()` 保留连字符以维持 id 直查能力。
7. **别名收窄**：移除会导致通用词误命中的过泛别名；木糖醇强制警示（R1）作为最高优先级的「强制兜底」，仅在匹配真实触发短语时生效，绝不因裸 `sugar` 触发。

新增回归用例覆盖：`sugar` 不触发木糖醇 / `sugar-free`·`xylitol`·`birch sugar`·`sugarfree` 仍触发 / `salt` 不命中杏仁 / `water` 不命中西瓜 / `white-chocolate` 与 `white chocolate` 一致为 CAUTION / `lemons-limes` 深链仍可直查，以及全库别名自解析一致性与通用词误命中扫描。

---

## 未实现 / 占位项（本次有意不做）

- **广告与联盟位**：`AD_SLOT_1`（top-banner）、`AD_SLOT_2`（in-feed）、`AD_SLOT_3`（footer-leaderboard）、`AFFILIATE_SLOT`（宠物保险）**仅注释占位，未接任何真实广告**，无 AdSense 代码。
- **`og:image` 分享卡图**：注释占位，暂无图片资源。
- **多语言（i18n）**：已实现 **中英双语**（单代码源 + 语言切换），见「双语支持（i18n）」；西语版等更多语言为二期方向。
- **特征引导（Guided ID）**：已实现，见「特征引导查询（Guided ID）」。**有意不做图像识别/AI**（约束如此）；特征为固定枚举近似，个别食物可能不在用户预期的特征组合里，可通过「返回上一步 / 少选特征」或直接搜索兜底。分类已按「用户怎么找」校准（毒性食物归自然大类，见「分类纪律」），不再有"葡萄在水果类找不到"这类违背直觉的归类。
- **剂量精算 / 个体化风险**：不做（需体重/品种 × 摄入量模型，涉及更高专业门槛，二期）。
- **巧克力计算器（theobromine meter）**：未做，仅给子类型分级。
- **猫版数据库**：未做。
- ~~构建期静态页 `#/food/<id>/index.html` + `sitemap.xml`~~ → **✅ 已做**：见「SEO 资产与部署配置」一节（88 个静态落地页 + sitemap + robots + vercel.json）。
- **体积**：约 178KB，超设计目标 120KB（88 条英文判定文案 + 中英双字典偏长）。如需达标可做 minify / 精简文案，本次保留可读源码。
- **中文内容边界**：非 toxic/severe 级食物的 `reason/symptoms/advice` 采用"中文优先、缺失回退英文"，仅保证 `level` 与关键 `advice` 中文正确；如需 88 条全量中文长文，为后续可扩展项。

---

## 上线前待办清单（仅列出，**本次不执行**）

**部署**
- [ ] 将 `runs/2026-10-03/04-webapp/` 作为站点根目录推到 GitHub Pages / Cloudflare Pages（纯静态，无需构建）。
- [ ] 配置真实域名，替换 `index.html` 中的 `canonical` / `og:url` 占位域名 `candogseat.example.com`。
- [ ] 在 `_headers` / 托管侧配置安全响应头（CSP、`X-Content-Type-Options`、`Referrer-Policy`）。

**SEO**
- [ ] 生成阶段 2 静态页 `/food/<id>/index.html` + `sitemap.xml`（`<lastmod>` 取 `checked` 字段），提升真实 URL 可索引性。
- [ ] 补 `og:image` 分享卡图；提交 sitemap 至 Google Search Console / Bing。
- [ ] 用 Rich Results Test 校验 JSON-LD（WebApplication / FAQPage）。

**内容与合规**
- [ ] 上线前对 88 条判定做**兽医执业者复核**（尤其 avocado / spinach / kale / tomato 分歧条目）。
- [ ] 建立数据维护纪律：改任何 `level/reason` 必须同步 `sources` 与 `checked` 日期。
- [ ] 法务复核免责声明措辞（目标市场：美国）。

**变现（可选）**
- [ ] 若接入 AdSense：在标注的 3 个 `AD_SLOT` 注释处替换为广告单元代码（**位置与 ID 不许移动**），保持广告与判定卡视觉强隔离。
- [ ] 若接入宠物保险联盟位：在 `AFFILIATE_SLOT` 注释处接入。

**性能**
- [ ] minify HTML/CSS/JS + gzip/brotli，把传输体积压回 <120KB。
- [ ] 上线后跑 Lighthouse / 真实移动端实测。

---

## 安全与隐私

- 所有用户输入与数据渲染走 `textContent` / `createElement` 安全路径，无 `innerHTML` 拼接用户串、无 `eval`（详见 `app.js` §5）。
- 外链统一 `rel="noopener noreferrer"`。
- 零网络请求、零 cookie、零追踪脚本、无表单提交；localStorage 仅存最近查询与对比栏（纯食物名/id）。
- 未引入任何需密钥/付费的服务、后端或外部数据库。

---

## 目录

```
04-webapp/
├── index.html            # 页面骨架 + SEO + 语言切换 + 特征引导入口/弹层 + 广告位注释 + 免责声明
├── style.css             # 五级配色 + 语言切换按钮 + 特征引导弹层/候选卡 + 响应式
├── i18n.js               # EN/ZH 双字典（127 键）+ 等级名 + 分类名 + TRAITS 特征标签
├── data.js               # SOURCES + TRAITS_ENUM + FOOD_EMOJI + 88 条 FOODS（含中文字段与 traits）
├── app.js                # 判定逻辑 + i18n 切换 + 特征引导向导 + UI + 路由 + 存储
├── selftest.js           # Node 核心逻辑自测（482 断言）
├── selftest_browser.py   # Playwright headless 冒烟（97 断言）
└── README.md
```

> ⚠️ **本工具仅供一般信息参考，不构成兽医诊断。** 紧急情况请立即联系兽医：ASPCA Animal Poison Control **(888) 426-4435** 或 Pet Poison Helpline **(855) 764-7661**（可能收费，24 小时）。
