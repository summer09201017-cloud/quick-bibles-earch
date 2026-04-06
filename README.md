## 常用指令

### 本機預覽

```powershell
Set-Location -LiteralPath 'C:\Users\HFP\Desktop\8譯本聖經關鍵字查詢CO'; & 'C:\Program Files\nodejs\npm.cmd' run build; & 'C:\Program Files\nodejs\npm.cmd' run preview
```

### GitHub push + Netlify deploy

```powershell
Set-Location -LiteralPath 'C:\Users\HFP\Desktop\8譯本聖經關鍵字查詢CO'; git add .; git diff --cached --quiet; if ($LASTEXITCODE -ne 0) { git commit -m "Update site UI" }; git push origin main; & 'C:\Program Files\nodejs\npm.cmd' run build; & 'C:\Program Files\nodejs\npx.cmd' netlify-cli@24.8.1 deploy --prod --dir=dist --no-build
```

---

# 多譯本聖經關鍵字查詢

React + Vite + Tailwind CSS + PWA 的多譯本聖經關鍵字搜尋網站。

## 特點

- 支援 `和合本`、`呂振中譯本`、`BBE`、`WEB`
- 另可直接使用 `BSB`、`OEB (44 books)`、`KJV`、`ASV`
- 仍可保留 `NIV`、`ESV`、`新譯本` 作為合法匯入 / API 模式
- 以 `JSON` 為資料來源，搜尋跑在 `Web Worker`
- 可安裝到手機主畫面或電腦桌面
- 匯入後會把 JSON 存進瀏覽器 `IndexedDB`，離線仍可搜尋
- 搜尋結果會平行顯示多譯本，方便對照

## 開發

```bash
npm install
npm run dev
```

## 同步可下載譯本

目前專案內建了一支同步腳本，會抓取信望愛 JSON API 中明確標示可下載的譯本：

```bash
py scripts/sync_bibles.py
```

目前這支腳本會同步：

- `cuv` -> `FHL和合本 (unv)`
- `lzz` -> `呂振中譯本 (lcc)`
- `bbe` -> `Bible in Basic English`
- `web` -> `World English Bible`
- `bsb` -> `Berean Standard Bible`
- `oeb` -> `Open English Bible (44 books)`

`NIV`、`ESV`、`新譯本`、`NLT`、`NCV / ICB`、`NIrV` 仍不會由腳本自動打包，因為來源授權條件不一致，建議改用你自己的合法 JSON 匯入或 live API。

## 轉換你自己的合法 JSON

如果你手上的資料是「每卷一本 JSON」格式，可以用這支轉換工具整理成網站可直接讀取的單一檔案：

```bash
py scripts/convert_book_json_folder.py ^
  --source-dir "C:\\path\\to\\books" ^
  --translation-id niv ^
  --short NIV ^
  --name "New International Version" ^
  --language English ^
  --output "C:\\Users\\HFP\\Desktop\\8譯本聖經關鍵字查詢CO\\public\\data\\bibles\\niv.json"
```

像 `aruljohn/Bible-niv` 這種「66 卷各自一個 JSON 檔，章節放在 `chapters[].verses[]`」的資料夾，這支工具可直接轉換。

另外也可參考來源整理：

- `docs/licensed-sources.md`

## NIV Live API 模式

如果你不想把 NIV 全文打包進專案，可以在網站側邊欄直接填入你自己的 `API.Bible`：

- `api-key`
- `bibleId`

這組設定只會存進瀏覽器本機，不會寫進 repo。啟用後，當本機沒有 `niv.json` 時，網站會把 `NIV` 改成 live 查詢模式。

## 建置

```bash
npm run build
npm run preview
```

## JSON 格式

請參考：

- `/public/data/schema/bible-json-example.json`

每一個譯本 JSON 需要包含：

```json
{
  "translation": {
    "id": "niv",
    "short": "NIV",
    "name": "New International Version",
    "language": "English"
  },
  "verses": [
    {
      "id": "43-3-16",
      "bookNumber": 43,
      "book": "John",
      "chapter": 3,
      "verse": 16,
      "text": "For God so loved the world..."
    }
  ]
}
```

`translation.id` 目前支援：

- `cuv`
- `lzz`
- `bbe`
- `web`
- `bsb`
- `oeb`
- `kjv`
- `asv`
- `niv`
- `esv`
- `cnv`

## 資料來源說明

此專案沒有直接附上實際經文內容，因為 `NIV`、`ESV` 與多數中文現代譯本通常有授權限制。

你可以：

1. 在網站裡直接匯入你自己的合法 JSON
2. 或把 JSON 放到 `/public/data/bibles/*.json` 作為內建資料

### 目前來源策略

- `和合本`：使用信望愛 `unv`（FHL和合本）
- `呂振中譯本`：使用信望愛 `lcc`
- `BBE` / `WEB`：使用信望愛可下載版本
- `BSB`：Berean 官方已將文本釋出為 public domain，可自由下載與使用
- `OEB`：使用 eBible 公開提供的 VPL/XML（目前為 44 書）
- `新譯本`：信望愛有提供線上版本，但 `abv.php` 顯示 `candownload=0`
- `ESV`：信望愛有提供線上版本，但 `abv.php` 顯示 `candownload=0`
- `NIV`：可另外轉換你自己的合法來源 JSON 後匯入
