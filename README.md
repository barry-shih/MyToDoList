# 📝 MyToDoList - 多人協作待辦清單應用程式

這是一個專為團隊與多人協作設計的現代化即時待辦清單網頁應用程式，已預先綁定現有 Firebase 專案 **`my-to-do-list-1e32d`**，支援 **Google 帳號登入**、**多人即時雙向同步**、**任務指派**、**即時在線頭像** 與 **活動歷程追蹤**。

---

## ✨ 核心功能特色

1. **Google 帳號快速登入**
   - 整合 Firebase Authentication，支援 Google 彈窗一鍵登入。
   - 自動帶入 Google 個人頭像、顯示名稱與 Email。
   - 備有「訪客/測試模式」，即使尚未完成 API Key 設定亦可快速體驗跨分頁協作。

2. **多人即時協作 (Cloud Firestore)**
   - **雙向即時同步**：任何成員打勾完成、指派責任人、修改標籤或備註，所有人畫面瞬間更新（毫秒級反應）。
   - **專屬協作分享連結**：點擊「邀請協作」即可複製專屬 URL（例如 `?listId=xyz`），傳給同事或朋友即刻加入同一清單。
   - **在線成員指示燈**：右上角頭像堆疊即時標示目前在線協作成員。
   - **「誰完成的」透明化標記**：清楚顯示每個任務是由哪位成員於何時標記為完成。

3. **豐富任務管理維度**
   - **優先級標籤**：🔴 緊急 (High)、🟡 一般 (Medium)、🟢 次要 (Low)。
   - **分類標籤**：💻 功能開發、🎨 視覺設計、🐞 Bug 修復、📝 專案企劃、📢 宣傳推廣、☕ 日常雜項。
   - **截止日期與逾期警示**：清楚標明日期，逾期項目自動以紅色醒目標註。
   - **進度百分比儀表板**：自動計算總數、進行中與完成百分比進度條。
   - **智慧過濾與搜尋**：支援標籤切換（全部、進行中、已完成、與我相關、緊急）與即時關鍵字過濾。

4. **團隊活動動態日誌 (Activity Audit Log)**
   - 右側側邊欄即時記錄「誰在何時新增、完成或刪除了哪項任務」，確保團隊資訊完全對齊。

---

## 🚀 專案結構

```
MyToDoList/
├── index.html              # 主頁面 (Tailwind CSS CDN + 響應式現代化排版)
├── css/
│   └── styles.css          # 玻璃擬態、陰影、頭像堆疊、動態過場樣式
├── js/
│   ├── firebase-config.js  # Firebase 模組載入與專案組態設定
│   ├── auth.js             # Google 認證狀態管理 (登入/登出/監聽)
│   ├── db.js               # Cloud Firestore 即時 CRUD、活動與在線狀態
│   └── app.js              # UI 互動控制器、過濾排序、彈窗事件處理
├── firestore.rules         # 推薦之 Firestore 安全性規則
└── README.md               # 專案說明與設定指南
```

---

## 🛠️ Firebase 專案設定步驟 (`my-to-do-list-1e32d`)

請前往 [Firebase 控制台](https://console.firebase.google.com/project/my-to-do-list-1e32d/) 進行以下三步快速設定：

### 步驟 1：啟用 Google 登入驗證 (Authentication)
1. 在左側選單進入 **Build (建構)** > **Authentication (驗證)**。
2. 點選 **Sign-in method (登入方式)** 標籤頁。
3. 點選 **Google**，將其切換為 **啟用 (Enable)**。
4. 設定支援的公開專案名稱與專案支援電子郵件，點擊 **儲存 (Save)**。
5. 在 **Settings (設定)** > **Authorized domains (授權網域)** 確認有 `localhost`。

### 步驟 2：啟用 Cloud Firestore 資料庫
1. 在左側選單進入 **Build (建構)** > **Firestore Database**。
2. 點選 **建立資料庫 (Create database)**。
3. 選擇所在地區（例如 `asia-east1` 台灣 或 `asia-southeast1` 新加坡）。
4. 在 **Rules (規則)** 標籤頁中，貼上本專案提供的 `firestore.rules` 內容並點擊 **發布 (Publish)**。

### 步驟 3：取得 Web API Key 並填入應用程式
1. 進入專案設定：點擊左上角齒輪圖示 > **專案設定 (Project settings)**。
2. 捲動至最下方的 **「您的應用程式」** 區塊。
3. 若尚未建立網頁應用，點擊 **`</>` (網頁)** 圖示註冊應用程式（例如命名為 `MyToDoList Web`）。
4. 註冊後會看到 `firebaseConfig`，複製其中的 `apiKey`。
5. 開啟本網頁應用程式，點擊右上角 **⚙️ 齒輪圖示** 或黃色提示按鈕，將 `apiKey` 貼入並點擊 **「儲存並連線」** 即可！

---

## 💻 本地啟動方式

因為專案採用原生 ES Module 架構，建議使用簡易本機伺服器開啟以支援模組載入與 Google 登入重定向：

### 方式 1：使用 Python 快速啟動 (推薦)
```bash
cd MyToDoList
python3 -m http.server 8000
```
瀏覽器開啟：`http://localhost:8000`

### 方式 2：使用 Node.js / npx serve
```bash
cd MyToDoList
npx serve .
```

---

## 👥 如何進行多人協作測試？

1. 使用本機開啟網頁後，點擊「Google 登入」。
2. 點擊看板右上方之 **「邀請協作」** 按鈕，系統會自動複製帶有 `?listId=xxx` 的專屬連結。
3. 在瀏覽器的 **無痕視窗 (Incognito Window)** 或傳給同事開啟該連結。
4. 另一個視窗登入另一個 Google 帳號（或使用訪客模式）。
5. 兩邊即可立即看到相同的待辦清單，嘗試勾選任何任務或新增項目，兩邊畫面將即時同步！
