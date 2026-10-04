#!/usr/bin/env python3
"""
selftest_browser.py — Playwright headless 冒烟测试（测试版）

检查项：
  1. 页面通过 file:// 加载无 JS 错误（零网络请求下的断网可用性）
  2. 搜索交互：输入 "choco" 出现联想下拉
  3. 结果卡渲染：输入 chocolate / grapes / apple 出卡且等级文字正确
  4. 木糖醇叠加：输入 "sugar-free gum" 置顶 SEVERE 警示
  5. 未收录保守卡：输入 "zzzznotafood" 出现 UNKNOWN 卡
  6. 巧克力子类型：dark chocolate=SEVERE，white chocolate=CAUTION
  7. 分类索引渲染 88 行
  8. 免责声明（结果卡 + 页脚）存在
  9. 移动端 390px 无横向滚动
 10. 内联脚本/外链安全属性（rel=noopener）
 13. 中文语言切换：文案随之变化、输入与结果保留、中文查询出卡、
     中文硬规则（木糖醇 SEVERE）、390px 中文不溢出、localStorage 持久化
 14–17. 特征引导查询（Guided ID）端到端：入口→选大类→选特征→候选出现→点选进入
     结果卡、返回上一步、关闭弹层、空候选兜底 UNKNOWN、#/identify 深链、
     390px 无横向溢出、触控目标 ≥44px、双语切换后向导文案变化
 18. 分类直觉回归：葡萄在「水果」大类下可被特征引导找到（紫+成串→候选含
     Grapes/葡萄，点选后仍是 SEVERE 结果卡；曾因毒性误归 processed 已修正）

运行：python3 selftest_browser.py
"""
import sys, pathlib
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
URL = (HERE / "index.html").as_uri()

PASS = 0
FAIL = 0
FAILURES = []


def ok(cond, name):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  \u2713 {name}")
    else:
        FAIL += 1
        FAILURES.append(name)
        print(f"  \u2717 FAIL: {name}")


def section(t):
    print(f"\n\u25b6 {t}")


def main():
    global PASS, FAIL
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})

        console_errors = []
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: console_errors.append(str(e)))

        # 记录所有网络请求（应只有 file:// 资源）
        requests = []
        page.on("request", lambda r: requests.append(r.url))

        page.goto(URL, wait_until="load")
        page.wait_for_timeout(300)

        # ---------------------------------------------------------------
        section("1. Load without JS errors")
        ok(len(console_errors) == 0, f"no console/page errors (got {console_errors[:2]})")
        non_file = [u for u in requests if not u.startswith("file://") and not u.startswith("data:")]
        ok(len(non_file) == 0, f"zero network requests (non-file: {non_file[:3]})")

        # ---------------------------------------------------------------
        section("2. Autocomplete on typing 'choco'")
        page.fill("#food-input", "choco")
        page.wait_for_timeout(300)
        sugg = page.query_selector_all("#suggest-list li[data-food]")
        ok(len(sugg) >= 1, "suggestion dropdown shows >=1 item for 'choco'")
        names = [s.inner_text() for s in sugg]
        ok(any("Chocolate" in n for n in names), f"'choco' suggests Chocolate (got {names[:3]})")

        # ---------------------------------------------------------------
        section("3. Result card rendering & verdict text")
        page.fill("#food-input", "chocolate")
        page.press("#food-input", "Enter")
        page.wait_for_timeout(250)
        card = page.query_selector("#result-card .card")
        ok(card is not None, "chocolate renders a result card")
        badge_text = page.inner_text("#result-card .level-badge") if card else ""
        ok("TOXIC" in badge_text.upper(), f"chocolate badge says TOXIC (got '{badge_text}')")
        ok(page.query_selector("#result-card .card-emergency") is not None, "toxic card shows emergency block")
        ok("888" in page.inner_text("#result-card"), "emergency block shows ASPCA hotline 888")

        page.fill("#food-input", "grapes")
        page.press("#food-input", "Enter")
        page.wait_for_timeout(250)
        gt = page.inner_text("#result-card .level-badge")
        ok("SEVERE" in gt.upper(), f"grapes badge says SEVERE (got '{gt}')")

        page.fill("#food-input", "apple")
        page.press("#food-input", "Enter")
        page.wait_for_timeout(250)
        at = page.inner_text("#result-card .level-badge")
        ok("SAFE" in at.upper(), f"apple badge says SAFE (got '{at}')")

        # ---------------------------------------------------------------
        section("4. Xylitol forced override")
        page.fill("#food-input", "sugar-free gum")
        page.press("#food-input", "Enter")
        page.wait_for_timeout(250)
        ok(page.query_selector("#result-card .xylitol-alert") is not None,
           "sugar-free gum shows pinned xylitol alert")
        ok("SEVERE" in page.inner_text("#result-card").upper(), "xylitol result contains SEVERE")

        # ---------------------------------------------------------------
        section("5. Unknown conservative card")
        page.fill("#food-input", "zzzznotafood")
        page.press("#food-input", "Enter")
        page.wait_for_timeout(250)
        ok(page.query_selector("#result-card .card--unknown") is not None, "unknown food renders UNKNOWN card")
        ok("not in our database" in page.inner_text("#result-card").lower() or
           "unknown" in page.inner_text("#result-card").lower(),
           "unknown card states we don't have it")

        # ---------------------------------------------------------------
        section("6. Chocolate subtype grading")
        page.fill("#food-input", "dark chocolate")
        page.press("#food-input", "Enter")
        page.wait_for_timeout(250)
        dt = page.inner_text("#result-card .level-badge").upper()
        ok("SEVERE" in dt, f"dark chocolate = SEVERE (got '{dt}')")

        page.fill("#food-input", "white chocolate")
        page.press("#food-input", "Enter")
        page.wait_for_timeout(250)
        wt = page.inner_text("#result-card .level-badge").upper()
        ok("CAUTION" in wt, f"white chocolate = CAUTION (got '{wt}')")

        # ---------------------------------------------------------------
        section("7. Browse index renders all 88 foods")
        rows = page.query_selector_all("#browse-index .food-row")
        ok(len(rows) == 88, f"browse index renders 88 rows (got {len(rows)})")
        cats = page.query_selector_all("#browse-index .cat-group")
        ok(len(cats) == 8, f"browse index has 8 category groups (got {len(cats)})")

        # ---------------------------------------------------------------
        section("8. Disclaimer presence")
        page.fill("#food-input", "grapes")
        page.press("#food-input", "Enter")
        page.wait_for_timeout(200)
        ok(page.query_selector("#result-card .card-disclaimer") is not None, "result card has disclaimer line")
        ok(page.query_selector("#disclaimer-full") is not None, "footer has full disclaimer block")
        dtext = page.inner_text("#disclaimer-full").lower()
        ok("not veterinary" in dtext or "not veterinary advice" in dtext or "general information" in dtext,
           "disclaimer says it is not veterinary advice")
        ok("888" in dtext, "disclaimer includes ASPCA hotline")

        # ---------------------------------------------------------------
        section("9. Quick chips & compare interaction")
        chips = page.query_selector_all("#quick-chips .chip")
        ok(len(chips) == 10, f"10 quick chips rendered (got {len(chips)})")
        # 点击 Grapes chip -> 出卡
        for c in chips:
            if c.inner_text().strip() == "Grapes":
                c.click()
                break
        page.wait_for_timeout(250)
        ok("SEVERE" in page.inner_text("#result-card .level-badge").upper(), "chip click renders grapes card")
        # Add to compare
        add = page.query_selector("[data-add-compare]")
        if add:
            add.click()
            page.wait_for_timeout(200)
            ok(page.query_selector("#compare-grid .compare-card") is not None, "add-to-compare renders compare card")

        # ---------------------------------------------------------------
        section("10. Safe external links")
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(200)
        ext = page.query_selector_all('.src-link, #footer-sources a')
        ok(len(ext) > 0, f"external source links present ({len(ext)})")
        unsafe = [a for a in ext if "noopener" not in (a.get_attribute("rel") or "")]
        ok(len(unsafe) == 0, f"all external links have rel=noopener ({len(unsafe)} unsafe)")

        # ---------------------------------------------------------------
        section("11. Mobile 390px — no horizontal scroll")
        mob = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        mob.goto(URL, wait_until="load")
        mob.wait_for_timeout(300)
        mob.fill("#food-input", "grapes")
        mob.press("#food-input", "Enter")
        mob.wait_for_timeout(300)
        sw = mob.evaluate("document.documentElement.scrollWidth")
        cw = mob.evaluate("document.documentElement.clientWidth")
        ok(sw <= cw + 1, f"no horizontal overflow at 390px (scrollWidth {sw} <= clientWidth {cw})")
        fs = mob.evaluate("getComputedStyle(document.querySelector('#food-input')).fontSize")
        ok(float(fs.replace("px", "")) >= 16, f"input font-size >= 16px on mobile (got {fs})")
        ok(mob.query_selector("#result-card .level-badge") is not None, "mobile result card renders")
        # 桌面三档宽度也不应溢出
        for w in (768, 1440):
            pg = browser.new_page(viewport={"width": w, "height": 900})
            pg.goto(URL, wait_until="load")
            pg.wait_for_timeout(200)
            s = pg.evaluate("document.documentElement.scrollWidth")
            c = pg.evaluate("document.documentElement.clientWidth")
            ok(s <= c + 1, f"no horizontal overflow at {w}px ({s} <= {c})")
            pg.close()

        # ---------------------------------------------------------------
        section("12. Hash deep link #/food/grapes")
        pg = browser.new_page()
        pg.goto(URL + "#/food/grapes", wait_until="load")
        pg.wait_for_timeout(400)
        ok("SEVERE" in pg.inner_text("#result-card .level-badge").upper(),
           "deep link #/food/grapes renders grapes card")
        pg.close()

        # ---------------------------------------------------------------
        # 13. 中文语言切换（EN -> ZH）
        # ---------------------------------------------------------------
        section("13. Language switch to Chinese")
        zh = browser.new_page(viewport={"width": 1280, "height": 900})
        zh_errors = []
        zh.on("pageerror", lambda e: zh_errors.append(str(e)))
        zh.goto(URL, wait_until="load")
        zh.wait_for_timeout(300)

        # 默认英文
        ok(zh.get_attribute("html", "lang") == "en", "default document lang is 'en'")
        ok(zh.inner_text("h1.hero-title").strip() == "Can dogs eat that?",
           "hero title starts in English")

        # 先输入并渲染一张结果卡（葡萄）= 用于验证切换后数据保留
        zh.fill("#food-input", "grapes")
        zh.press("#food-input", "Enter")
        zh.wait_for_timeout(250)
        ok("SEVERE" in zh.inner_text("#result-card .level-badge").upper(),
           "grapes card renders in EN before switch")

        # 切换到中文
        zh.click('[data-lang-btn="zh"]')
        zh.wait_for_timeout(250)

        # (a) 静态文案变为中文
        ok(zh.get_attribute("html", "lang") == "zh-CN",
           f"document lang becomes zh-CN (got {zh.get_attribute('html', 'lang')})")
        ok("狗狗能吃这个吗" in zh.inner_text("h1.hero-title"),
           "hero title switches to Chinese")
        ok("常见食物" in zh.inner_text("#quick-chips-section .block-title"),
           "quick-chips heading switches to Chinese")
        ok("浏览全部 88 种食物" in zh.inner_text("#browse-heading"),
           "browse heading switches to Chinese")
        ok("中文" in zh.inner_text('[data-lang-btn="zh"]') and
           zh.get_attribute('[data-lang-btn="zh"]', "aria-pressed") == "true",
           "ZH toggle is active after switch")
        ok(zh.get_attribute('[data-lang-btn="en"]', "aria-pressed") == "false",
           "EN toggle is inactive after switch")

        # (b) 输入值与已渲染结果保留，且徽章文案随语言重渲染为中文
        ok(zh.input_value("#food-input") == "grapes",
           "input value preserved across language switch")
        badge_zh = zh.inner_text("#result-card .level-badge")
        ok("剧毒" in badge_zh or "立即行动" in badge_zh,
           f"existing grapes card re-renders Chinese badge (got '{badge_zh}')")

        # (c) 中文查询命中：巧克力 -> 有毒
        zh.fill("#food-input", "巧克力")
        zh.press("#food-input", "Enter")
        zh.wait_for_timeout(250)
        cz = zh.inner_text("#result-card .level-badge")
        ok("有毒" in cz, f"Chinese query '巧克力' -> 有毒 badge (got '{cz}')")

        # (d) 中文联想下拉：输入 "巧" 出现中文建议
        zh.fill("#food-input", "巧")
        zh.wait_for_timeout(300)
        zsugg = [s.inner_text() for s in zh.query_selector_all("#suggest-list li[data-food]")]
        ok(any("巧克力" in n for n in zsugg),
           f"'巧' suggests 巧克力 in Chinese (got {zsugg[:3]})")

        # (e) 中文硬规则：木糖醇 -> 剧毒 + 置顶警示
        zh.fill("#food-input", "木糖醇")
        zh.press("#food-input", "Enter")
        zh.wait_for_timeout(250)
        ok("剧毒" in zh.inner_text("#result-card .level-badge").upper(),
           "Chinese '木糖醇' triggers forced SEVERE")
        ok(zh.query_selector("#result-card .xylitol-alert") is not None,
           "Chinese '木糖醇' shows pinned xylitol alert")

        # (f) 中文保守路径：未收录词 -> UNKNOWN（中文提示）
        zh.fill("#food-input", "zzzznotafood")
        zh.press("#food-input", "Enter")
        zh.wait_for_timeout(250)
        ok(zh.query_selector("#result-card .card--unknown") is not None,
           "unknown card still renders in Chinese mode")
        ok("未知" in zh.inner_text("#result-card"),
           "unknown card shows Chinese label 未知")

        # (g) 中文索引区行数不变（数据不丢）
        ok(len(zh.query_selector_all("#browse-index .food-row")) == 88,
           "browse index still has 88 rows in Chinese mode")

        # (h) localStorage 持久化：刷新后仍是中文
        persisted = zh.evaluate("window.localStorage.getItem('cde_lang')")
        ok(persisted == "zh", f"language persisted to localStorage (cde_lang={persisted})")
        zh.reload(wait_until="load")
        zh.wait_for_timeout(300)
        ok("狗狗能吃这个吗" in zh.inner_text("h1.hero-title"),
           "page reloads in Chinese from persisted preference")
        ok(zh.get_attribute('[data-lang-btn="zh"]', "aria-pressed") == "true",
           "ZH toggle stays active after reload")

        # (i) 390px 中文视口无横向溢出
        zhm = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        zhm.goto(URL, wait_until="load")
        zhm.wait_for_timeout(300)
        zhm.click('[data-lang-btn="zh"]')
        zhm.wait_for_timeout(250)
        zhm.fill("#food-input", "木糖醇")
        zhm.press("#food-input", "Enter")
        zhm.wait_for_timeout(300)
        zsw = zhm.evaluate("document.documentElement.scrollWidth")
        zcw = zhm.evaluate("document.documentElement.clientWidth")
        ok(zsw <= zcw + 1,
           f"no horizontal overflow at 390px in Chinese (scrollWidth {zsw} <= clientWidth {zcw})")
        ok(zhm.query_selector("#result-card .level-badge") is not None,
           "mobile Chinese result card renders")

        ok(len(zh_errors) == 0, f"no JS errors during Chinese switching (got {zh_errors[:2]})")
        zhm.close()
        zh.close()

        # ---------------------------------------------------------------
        # 14. 特征引导查询（Guided ID）端到端
        # ---------------------------------------------------------------
        section("14. Guided ID — entry -> category -> features -> candidate -> result")
        g = browser.new_page(viewport={"width": 1280, "height": 900})
        g_errors = []
        g.on("pageerror", lambda e: g_errors.append(str(e)))
        g.goto(URL, wait_until="load")
        g.wait_for_timeout(300)

        # 入口按钮存在且为英文
        ok(g.query_selector("#identify-open") is not None, "guided-ID entry button exists")
        ok("name" in g.inner_text("#identify-open").lower(), "entry button is bilingual EN by default")

        # 点击入口 -> 弹层打开，停在 step1
        g.click("#identify-open")
        g.wait_for_timeout(200)
        ok(g.get_attribute("#identify-overlay", "hidden") is None, "overlay opens on entry click")
        ok("1" in g.inner_text("#identify-stepcode"), "wizard starts at step 1")
        ok(len(g.query_selector_all(".chip--cat")) == 8, "step 1 shows 8 categories")

        # 选大类 -> 进入 step2，出现特征 chips（颜色8+形态6+其他4=18）
        g.click('[data-identify-cat="fruit"]')
        g.wait_for_timeout(150)
        ok("2" in g.inner_text("#identify-stepcode"), "picking a category advances to step 2")
        ok(len(g.query_selector_all(".chip--trait")) == 18, "step 2 shows 18 trait chips (8+6+4)")

        # 选特征：红 + 圆 + 小颗粒
        g.click('[data-identify-trait="colors:red"]')
        g.click('[data-identify-trait="shapes:round"]')
        g.click('[data-identify-trait="shapes:small"]')
        g.wait_for_timeout(100)
        ok(g.get_attribute('[data-identify-trait="colors:red"]', "aria-pressed") == "true",
           "selected trait chip is aria-pressed=true (highlighted)")

        # 下一步 -> step3，候选缩略卡出现（3–10 个）
        g.click("#identify-next")
        g.wait_for_timeout(200)
        ok("3" in g.inner_text("#identify-stepcode"), "advances to step 3 (candidates)")
        cards = g.query_selector_all(".candidate-card")
        ok(3 <= len(cards) <= 10, f"step 3 shows 3–10 candidate cards (got {len(cards)})")
        card_text = " ".join(c.inner_text() for c in cards)
        # 候选卡同时含 EN+ZH 名与等级徽章
        ok("Cherries" in card_text or "Tomatoes" in card_text, "candidates show English food names")
        ok(("樱桃" in card_text) or ("番茄" in card_text), "candidates show Chinese food names too")
        ok(any(("CAUTION" in c.inner_text().upper()) for c in cards), "candidates show a level badge")

        # 点选候选 -> 弹层关闭 + 进入既有结果卡（安全结论来自 FOODS）
        cards[0].click()
        g.wait_for_timeout(300)
        ok(g.get_attribute("#identify-overlay", "hidden") is not None, "picking a candidate closes the overlay")
        ok(g.query_selector("#result-card .card") is not None, "picking a candidate renders the real result card")
        ok(g.query_selector("#result-card .level-badge") is not None, "result card has a verified level badge")
        ok(g.query_selector("#result-card .card-disclaimer") is not None, "result card keeps the disclaimer")

        # ---------------------------------------------------------------
        section("15. Guided ID — back / reset / close & empty fallback")
        # 重新打开
        g.click("#identify-open")
        g.wait_for_timeout(150)
        g.click('[data-identify-cat="fruit"]')
        g.wait_for_timeout(100)
        # 返回上一步：step2 -> step1
        g.click("#identify-back")
        g.wait_for_timeout(150)
        ok("1" in g.inner_text("#identify-stepcode"), "back button returns step 2 -> step 1")
        # 选大类 -> step2 -> 不选特征直接跳过 -> step3（候选 = 该大类全部，>10 时给出收敛提示）
        g.click('[data-identify-cat="dairy"]')
        g.wait_for_timeout(100)
        g.click("#identify-next")
        g.wait_for_timeout(150)
        dairy_cards = g.query_selector_all(".candidate-card")
        ok(("3" in g.inner_text("#identify-stepcode")) or len(dairy_cards) > 0,
           "skip-features path still reaches step 3 (dairy <= 10 shows cards)")

        # 关闭弹层：点 close
        g.click("#identify-close")
        g.wait_for_timeout(150)
        ok(g.get_attribute("#identify-overlay", "hidden") is not None, "close button hides the overlay")
        ok(g.evaluate("location.hash") == "#/", "closing resets the route away from #/identify")

        # 空候选兜底：水果 + 液体（无任何水果是液体）-> UNKNOWN 保守卡 + 888 热线 + 免责
        g.click("#identify-open")
        g.wait_for_timeout(150)
        g.click('[data-identify-cat="fruit"]')
        g.wait_for_timeout(100)
        g.click('[data-identify-trait="shapes:liquid"]')
        g.wait_for_timeout(80)
        g.click("#identify-next")
        g.wait_for_timeout(200)
        ok(len(g.query_selector_all(".candidate-card")) == 0, "fruit+liquid shows zero candidates")
        ok(g.query_selector("#identify-body .card--unknown") is not None,
           "empty candidate set falls back to a conservative UNKNOWN card")
        ok("888" in g.inner_text("#identify-body"), "empty fallback keeps the ASPCA hotline (888)")
        ok(g.query_selector("#identify-body .card-disclaimer") is not None,
           "empty fallback keeps the disclaimer line")
        # 从兜底返回上一步
        g.click("#identify-back")
        g.wait_for_timeout(150)
        ok("2" in g.inner_text("#identify-stepcode"), "can go back from the empty fallback to step 2")

        # ESC 关闭
        g.keyboard.press("Escape")
        g.wait_for_timeout(150)
        ok(g.get_attribute("#identify-overlay", "hidden") is not None, "Escape closes the wizard")
        ok(len(g_errors) == 0, f"no JS errors during guided ID flow (got {g_errors[:2]})")
        g.close()

        # ---------------------------------------------------------------
        section("16. Guided ID — deep link #/identify & 390px no overflow")
        gl = browser.new_page(viewport={"width": 1280, "height": 900})
        gl.goto(URL + "#/identify", wait_until="load")
        gl.wait_for_timeout(400)
        ok(gl.get_attribute("#identify-overlay", "hidden") is None, "deep link #/identify opens the wizard")
        gl.close()

        gm = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        gm.goto(URL, wait_until="load")
        gm.wait_for_timeout(300)
        gm.click("#identify-open")
        gm.wait_for_timeout(150)
        gm.click('[data-identify-cat="fruit"]')
        gm.wait_for_timeout(100)
        # 触控目标 >= 44px（特征 chip，位于 step 2）
        ch = gm.query_selector(".chip--trait")
        cbox = ch.bounding_box() if ch else None
        ok(cbox is not None and cbox["height"] >= 44, "trait chips have >=44px touch height on mobile")
        gm.click('[data-identify-trait="colors:red"]')
        gm.wait_for_timeout(80)
        gm.click("#identify-next")
        gm.wait_for_timeout(200)
        gsw = gm.evaluate("document.documentElement.scrollWidth")
        gcw = gm.evaluate("document.documentElement.clientWidth")
        ok(gsw <= gcw + 1, f"guided ID: no horizontal overflow at 390px ({gsw} <= {gcw})")
        gm.close()

        # ---------------------------------------------------------------
        section("17. Guided ID — Chinese switch re-renders wizard copy")
        gc = browser.new_page(viewport={"width": 1280, "height": 900})
        gc.goto(URL, wait_until="load")
        gc.wait_for_timeout(300)
        gc.click('[data-lang-btn="zh"]')
        gc.wait_for_timeout(200)
        ok("不认识" in gc.inner_text("#identify-open") or "名字" in gc.inner_text("#identify-open"),
           "entry button switches to Chinese copy")
        gc.click("#identify-open")
        gc.wait_for_timeout(200)
        ok("哪一类" in gc.inner_text("#identify-body"), "step 1 title is Chinese after language switch")
        cat_zh = gc.query_selector_all(".chip--cat")
        ok(any("水果" in c.inner_text() for c in cat_zh), "category chips are Chinese (水果)")
        gc.click('[data-identify-cat="fruit"]')
        gc.wait_for_timeout(150)
        trait_zh = gc.query_selector_all(".chip--trait")
        ttext = " ".join(c.inner_text() for c in trait_zh)
        ok("红色" in ttext and "圆的" in ttext and "小颗粒" in ttext, "trait chips are Chinese after switch")
        gc.click('[data-identify-trait="colors:red"]')
        gc.click('[data-identify-trait="shapes:round"]')
        gc.wait_for_timeout(80)
        gc.click("#identify-next")
        gc.wait_for_timeout(200)
        ok("是这些" in gc.inner_text("#identify-body") or "吗" in gc.inner_text("#identify-body"),
           "step 3 title is Chinese after switch")
        zhcard = gc.query_selector(".candidate-card")
        ok(zhcard is not None and ("樱桃" in zhcard.inner_text() or "番茄" in zhcard.inner_text()
                                   or "苹果" in zhcard.inner_text()),
           "candidate cards show Chinese names in Chinese mode")
        gc.close()

        # ---------------------------------------------------------------
        section("18. Guided ID — grapes findable under the fruit category (category-intuition regression)")
        # 回归背景：葡萄/葡萄干曾因「肾毒性单独归类」被放进 processed，用户在特征引导
        # 第 1 步按直觉选「水果」时找不到葡萄；已按「用户怎么找」归回 fruit。
        gr = browser.new_page(viewport={"width": 1280, "height": 900})
        gr.goto(URL, wait_until="load")
        gr.wait_for_timeout(300)
        gr.click("#identify-open")
        gr.wait_for_timeout(150)
        gr.click('[data-identify-cat="fruit"]')
        gr.wait_for_timeout(100)
        # 「成串 + 紫色」是用户对葡萄的典型描述
        gr.click('[data-identify-trait="shapes:bunch"]')
        gr.click('[data-identify-trait="colors:purple"]')
        gr.wait_for_timeout(80)
        gr.click("#identify-next")
        gr.wait_for_timeout(200)
        gr_cards = gr.query_selector_all(".candidate-card")
        gr_text = " ".join(c.inner_text() for c in gr_cards)
        ok(any("Grapes" in c.inner_text() for c in gr_cards),
           f"guided fruit+purple+bunch candidates include Grapes (got {len(gr_cards)} candidates)")
        ok("葡萄" in gr_text, "grape candidate shows the Chinese name too")
        # 点选葡萄候选 -> 结果卡 SEVERE（判定数据不因分类调整而变化）
        grape_card = next(c for c in gr_cards if "Grapes" in c.inner_text())
        grape_card.click()
        gr.wait_for_timeout(300)
        ok("SEVERE" in gr.inner_text("#result-card .level-badge").upper(),
           "picking grapes from the guided flow renders the SEVERE card")
        gr.close()

        browser.close()

    print("\n" + "=" * 56)
    print(f"PASS: {PASS}   FAIL: {FAIL}")
    if FAIL:
        print("\nFailures:")
        for f in FAILURES:
            print("  - " + f)
        sys.exit(1)
    print("All browser smoke tests passed.")


if __name__ == "__main__":
    main()
