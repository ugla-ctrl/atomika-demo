---
name: experience-qa
description: Thorough QA for web experiences (interactive sites, three.js/WebGL scenes, virtual tours, microsites, landing pages) across emulated phones, tablets and desktops, before or after a deploy. Runs an automated pass (console and page errors, failed requests, page weight, layout overflow, small or overlapping tap targets, deep links, click-through of the journey, screenshots per device and state), then a visual review for mobile layout and AI-image artifacts, and writes a report with severities and evidence. Use this whenever someone asks to check, test, QA, verify, smoke-test or "look at it on a phone" for a site, wants to know whether a deploy worked, or says something looks broken, even if they don't say "QA".
---

# Experience QA

Your job is to find what's broken or embarrassing before a real person does, on the devices they actually use, and to report it plainly with evidence. Fix what's yours to fix; report the rest.

## 1. Scope the run
Work out:
- **URL(s):** localhost for pre-deploy, the production URL after a deploy. Do both when you just shipped.
- **Views:** routes, deep links (`?station=N`, `#section`) or states worth opening directly.
- **Journey:** the main control a visitor presses (Next, Continue, a tab bar) and how many steps.
- **Devices:** the default set is `desktop`, `iphone`, `iphone-landscape`, `android`. Add `ipad` and `laptop` for layout-heavy sites.
- **Probes:** small JS expressions that prove the app is in the right state, e.g. which image is visible or whether a canvas is hidden.

If the site has no deep links and the journey matters, consider adding them; it makes QA and sharing far easier.

## 2. Run the automated pass
Write a config and run `scripts/qa_run.js config.json` (Playwright; it falls back to a global install). See the header of the script for every field. Example:

```json
{"url":"https://demo.example.com/","out":"qa-out",
 "views":[{"name":"01","query":"station=1"},{"name":"06","query":"station=6"}],
 "devices":["desktop","iphone","iphone-landscape","android"],
 "settleMs":20000,
 "clickThrough":{"selector":"#next","steps":2,"waitMs":9000},
 "probes":["getComputedStyle(document.getElementById('c')).opacity"],
 "budgets":{"totalMB":25,"largestAssetMB":3,"requests":150}}
```

WebGL pages render in software (SwiftShader) in headless Chromium at a few fps: raise `settleMs` (15–30 s) and run in the background if there are many views. Then `python scripts/sheet.py qa-out` to grid the screenshots per device.

## 3. Look at the screenshots
Open the sheets and go through `references/checklist.md`. Automated checks can't see clipped text, a card covering the subject, a person with three feet or a fallback model flashing mid-transition. Look at the mid-transition screenshots specifically.

## 4. Report
Lead with the verdict (ship / fix first), then a table of findings, highest severity first. For each finding give the device, the view, what's wrong, the evidence (screenshot path or error text) and the fix if it's obvious. Then list what you could **not** verify, such as real-device frame rate, real iOS Safari quirks or audio. The report reaches people who weren't watching, so be specific and short.

Severity:
- **high:** broken function, errors, missing assets, unusable on a device class.
- **medium:** layout problems, overflow, overlap, budget overruns, visible artifacts.
- **low:** polish, small tap targets on secondary controls.

## 5. Fix and re-run
Fix the issues in your own change, re-run only the affected devices and views to confirm, and say what changed between runs. Don't hide a regression by dropping it from the second run.
