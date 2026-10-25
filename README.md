# 家庭健康飲食 AI（PWA 版）

真正的 AI 食譜生成 + 可安裝到手機主畫面的 PWA。

## 功能

- 真正呼叫 AI 產生食譜（Gemini / OpenAI / xAI）
- 飲食偏好、自由描述、過敏原、人數、預算、料理時間
- 採購清單
- **可加入手機主畫面，全螢幕運作，看起來像原生 App**

## 檔案結構

```
family-diet-ai/
├── package.json
├── server.js
├── .env.example
├── .gitignore
├── README.md
└── public/
    ├── index.html
    ├── manifest.json      ← PWA 設定
    ├── sw.js              ← Service Worker
    ├── icon-192.png
    └── icon-512.png
```

---

## 一、本地測試（電腦）

```bash
cd family-diet-ai
cp .env.example .env
# 編輯 .env，填入你的 GEMINI_API_KEY
npm install
npm start
```

瀏覽器打開 http://localhost:3000

---

## 二、部署到網路上（之後只用手機）

推薦使用 **Render**（免費額度足夠個人使用）。

### 步驟 1：準備 GitHub 帳號
如果還沒有，先到 https://github.com 註冊。

### 步驟 2：把專案上傳到 GitHub
1. 在 GitHub 新建一個 Repository（例如 `family-diet-ai`）
2. 把整個 `family-diet-ai` 資料夾的內容上傳上去  
   （可用 GitHub 網頁的 Upload files 功能，最簡單）

### 步驟 3：到 Render 部署
1. 打開 https://render.com 並用 GitHub 帳號登入
2. 點 **New +** → **Web Service**
3. 選擇你剛上傳的 Repository
4. 設定如下：
   - **Name**：`family-diet-ai`（隨便取）
   - **Runtime**：Node
   - **Build Command**：`npm install`
   - **Start Command**：`npm start`
   - **Instance Type**：Free
5. 在 **Environment** 區塊新增環境變數：
   - `AI_PROVIDER` = `gemini`
   - `GEMINI_API_KEY` = 你的金鑰
6. 點 **Create Web Service**

等幾分鐘部署完成後，Render 會給你一個網址，例如：
`https://family-diet-ai-xxxx.onrender.com`

### 步驟 4：手機加入主畫面

**iPhone（Safari）：**
1. 用 Safari 打開你的網址
2. 點下方分享按鈕（方框 + 箭頭）
3. 滑動找到「加入主畫面」
4. 點「新增」

**Android（Chrome）：**
1. 用 Chrome 打開網址
2. 點右上角選單（三個點）
3. 選擇「安裝應用程式」或「加入主畫面」

之後就可以像一般 App 一樣從主畫面開啟，全螢幕使用。

---

## 三、如何確認是真正的 AI？

- 頁面上方狀態列顯示「✓ 已連接 GEMINI AI 服務」
- 每次生成的結果都不一樣
- 有藍色「AI 生成」標籤
- 金鑰錯誤時會顯示清楚錯誤，不會偷偷用示範資料

---

## 注意事項

1. **Render 免費方案**在一段時間沒人使用後會休眠，第一次開啟可能要等 30～60 秒醒來。
2. API 金鑰請只放在 Render 的 Environment Variables，不要寫進程式碼。
3. 本工具僅供飲食參考，營養與價格皆為 AI 估算。

有問題把錯誤訊息貼給我即可。
