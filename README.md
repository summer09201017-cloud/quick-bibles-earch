# 多譯本關鍵字查詢

這是一個用 React + Vite + Tailwind CSS 製作的多譯本聖經查詢網站，支援 PWA 安裝、手機與電腦瀏覽、本機 JSON 快速搜尋，以及經文閱讀與勾選複製。

## 目前網站重點

- 介面分成「經文閱讀」與「關鍵字搜尋」兩個分頁
- 搜尋結果依照聖經書卷順序排列
- 搜尋結果可點擊經節名稱或經文內容，直接跳到閱讀頁對應章節
- 經文閱讀與搜尋結果都支援核取方塊勾選，並可複製勾選經文
- 手機版標題區可收合，避免遮住下方內容
- 搜尋使用 Web Worker，在本機 JSON 上進行，速度較快
- 可安裝成 PWA，適合手機與桌面環境使用

## 目前預設顯示的譯本

目前 UI 主要顯示這幾個譯本：

- 和合本（`cuv`）
- 呂振中譯本（`lzz`）
- Bible in Basic English（`bbe`）
- World English Bible（`web`）
- Berean Standard Bible（`bsb`）
- King James Version（`kjv`）
- American Standard Version（`asv`）

目前預設勾選：

- `cuv`
- `lzz`
- `bbe`
- `web`

雖然 `public/data/bibles` 裡還可能有 `oeb`、`niv`、`esv`、`cnv` 等 JSON，但目前網站介面已設定為不顯示這些譯本。

## 常用指令

### 安裝套件

```powershell
Set-Location -LiteralPath 'C:\Users\HFP\Desktop\8譯本聖經關鍵字查詢CO'; & 'C:\Program Files\nodejs\npm.cmd' install
```

### 開發模式

```powershell
Set-Location -LiteralPath 'C:\Users\HFP\Desktop\8譯本聖經關鍵字查詢CO'; & 'C:\Program Files\nodejs\npm.cmd' run dev
```

### 本機預覽

```powershell
Set-Location -LiteralPath 'C:\Users\HFP\Desktop\8譯本聖經關鍵字查詢CO'; & 'C:\Program Files\nodejs\npm.cmd' run build; & 'C:\Program Files\nodejs\npm.cmd' run preview
```

預設預覽網址：

- [http://127.0.0.1:4176](http://127.0.0.1:4176)

### GitHub push + Netlify deploy

```powershell
Set-Location -LiteralPath 'C:\Users\HFP\Desktop\8譯本聖經關鍵字查詢CO'; git add .; git diff --cached --quiet; if ($LASTEXITCODE -ne 0) { git commit -m "Update site UI" }; git push origin main; & 'C:\Program Files\nodejs\npm.cmd' run build; & 'C:\Program Files\nodejs\npx.cmd' netlify-cli@24.8.1 deploy --prod --dir=dist --no-build
```

這條指令的做法是：

- 先 push 到 GitHub
- 再在本機 build
- 最後把 `dist` 手動 deploy 到 Netlify
- 使用 `--no-build`，避免 Netlify 再多做一次 build，較省額度

## 每天固定操作流程

### 1. 修改網站內容

先在專案資料夾中編輯程式碼，例如：

- `src/App.jsx`
- `src/index.css`
- `public/data/bibles/*.json`
- `README.md`

### 2. 本機檢查畫面

執行本機預覽指令：

```powershell
Set-Location -LiteralPath 'C:\Users\HFP\Desktop\8譯本聖經關鍵字查詢CO'; & 'C:\Program Files\nodejs\npm.cmd' run build; & 'C:\Program Files\nodejs\npm.cmd' run preview
```

然後打開：

- [http://127.0.0.1:4176](http://127.0.0.1:4176)

### 3. 確認沒問題後上傳 GitHub + Netlify

執行：

```powershell
Set-Location -LiteralPath 'C:\Users\HFP\Desktop\8譯本聖經關鍵字查詢CO'; git add .; git diff --cached --quiet; if ($LASTEXITCODE -ne 0) { git commit -m "Update site UI" }; git push origin main; & 'C:\Program Files\nodejs\npm.cmd' run build; & 'C:\Program Files\nodejs\npx.cmd' netlify-cli@24.8.1 deploy --prod --dir=dist --no-build
```

### 4. 打開正式站確認結果

正式站網址：

- [https://quick-bibles-earch.netlify.app](https://quick-bibles-earch.netlify.app)

如果手機還是舊畫面，請：

- 關掉 PWA 再重開
- 或重新整理瀏覽器
- 或直接開正式站網址確認最新版本

## 專案結構

```text
src/
  App.jsx                      主畫面、閱讀器、搜尋頁
  index.css                    全站樣式
  lib/
    bookNames.js               書卷資料
    constants.js               譯本定義
    dataStore.js               IndexedDB 儲存
    searchText.js              搜尋正規化與高亮
    apiBible.js                API.Bible 相關邏輯
  workers/
    searchWorker.js            本機搜尋 Worker

public/
  data/
    catalog.json               譯本清單
    bibles/*.json              各譯本 JSON
    schema/
      bible-json-example.json  JSON 格式範例

scripts/
  sync_bibles.py               同步/整理譯本 JSON
  convert_book_json_folder.py  將每卷 JSON 轉成本站格式
```

## JSON 資料位置

目前譯本 JSON 放在：

- `public/data/bibles/`

譯本清單在：

- `public/data/catalog.json`

JSON 格式範例在：

- `public/data/schema/bible-json-example.json`

## 常見檔案

- `src/App.jsx`：主要畫面與互動邏輯
- `src/index.css`：樣式
- `vite.config.js`：Vite、PWA、port 設定
- `netlify.toml`：Netlify 發佈設定
- `README.md`：操作說明

## 目前部署方式

目前是「手動 deploy 到 Netlify」，不是 GitHub 自動部署。

也就是說：

- `git push origin main` 不會自動更新 Netlify
- 還需要再跑一次手動 deploy 指令

如果以後要改成 GitHub 自動部署，需要在 Netlify 後台把 GitHub repo 正式接上。

## 注意事項

- 不要在 `\\?\C:\...` 這種路徑下直接跑 `npm`，會出現 `CMD.EXE 不支援 UNC 路徑` 問題
- 請先 `Set-Location -LiteralPath 'C:\Users\HFP\Desktop\8譯本聖經關鍵字查詢CO'` 再執行指令
- 如果畫面看起來沒更新，先檢查是不是瀏覽器或 PWA 快取

## 備註

如果之後要恢復顯示其他譯本，例如 `oeb`、`niv`、`esv`、`cnv`，可再調整 `src/App.jsx` 內控制可見譯本的設定。
