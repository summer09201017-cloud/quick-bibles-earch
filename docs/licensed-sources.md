# 可合法接入的來源現況

更新檢查日期：2026-04-03

## 已可直接同步到本專案

### WEB / KJV / ASV / BBE

- 來源：信望愛 JSON API
- 目前已同步進站，作為可直接離線搜尋的英文替代譯本
- 其中 WEB 為 [eBible.org](https://ebible.org/web/) 發行的公版譯本

### BSB

- 官方下載頁提供 `Text / USFM / USX` 等格式：[Berean Bible Free Downloads](https://berean.bible/downloads.htm)
- 官方授權頁說明 BSB / Majority Bible texts 已於 2023-04-30 dedicated to the public domain：[Berean Bible Terms](https://berean.bible/terms.htm)
- 目前已同步進站，作為較現代、較容易閱讀的英文全文譯本

### OEB（44 books）

- eBible 顯示 `Open English Bible` 為 `Public Domain`，並提供 `USFM / USFX` 等下載：[Open English Bible](https://ebible.org/find/show.php?id=engoebus)
- 目前可作為較簡明的現代英文補充譯本，但它不是完整 66 卷

### 和合本（FHL 和合本 / `unv`）

- 來源：信望愛 JSON API
- 依據：`abv.php` 顯示 `candownload = 1`
- 目前已同步進站

### 呂振中譯本（`lcc`）

- 來源：信望愛 JSON API
- 依據：`abv.php` 顯示 `candownload = 1`
- 目前已同步進站

## 目前不建議直接打包成完整本機 JSON

### 新譯本（`ncv` / CNV）

- 信望愛 `abv.php` 顯示 `candownload = 0`
- 信望愛版權頁列出《聖經新譯本》版權屬於環球聖經公會
- 目前較安全的做法：由你提供已授權的 JSON，再用轉換腳本匯入

### ESV

- 官方 ESV API 可用於網站 / app 整合
- 但官方條款明示：本機不可儲存超過 500 節，不能作為完整離線全文 JSON
- 目前較安全的做法：改做 live API 模式，或取得正式授權後另行處理

### NIV

- Biblica 的條款把 NIV 視為受版權保護內容
- 一般公開引用上限是 500 節，超出需另行取得書面許可
- API.Bible 官網顯示 NIV 可作為授權版權譯本接入，但需要 API key / 方案 / 權限，不等於可自由打包成完整離線 JSON
- GitHub 上的 `aruljohn/Bible-niv` 專案目前是「每卷一本 JSON」，不是每章一檔；格式上可轉，但版權風險仍要自行確認
- 目前較安全的做法：由你提供已授權來源，或改做 live API 模式

### NLT / NCV / ICB / NIrV

- `NLT`：Tyndale 官方 FAQ 說明，將全文放到其他網站的請求會被拒絕；整本離線 JSON 不適合直接打包
- `NCV`：信望愛 API 說明可查到 `candownload = 0`
- `ICB`：目前沒有查到安全、公開、可整本重打包的 JSON 來源
- `NIrV`：Biblica / Zondervan 仍以授權譯本方式營運，不適合直接整本離線打包

## 對本專案最實際的建議

1. `和合本 + 呂振中` 維持本機 JSON 全文快搜
2. `NIV / ESV / 新譯本` 改成兩條路擇一：
   - 你提供合法 JSON，我幫你轉成本專案格式
   - 我幫你做 live API 模式，不把全文打包進站

## 已附的轉換工具

如果你手上有合法取得、每卷一本 JSON 的資料夾，可以用：

```bash
py scripts/convert_book_json_folder.py ^
  --source-dir "C:\\path\\to\\books" ^
  --translation-id niv ^
  --short NIV ^
  --name "New International Version" ^
  --language English ^
  --output "C:\\Users\\HFP\\Desktop\\8譯本聖經關鍵字查詢CO\\public\\data\\bibles\\niv.json"
```

這支腳本會把「每卷一本、章節在 `chapters[].verses[]`」的格式轉成網站可直接搜尋的單一 JSON。
