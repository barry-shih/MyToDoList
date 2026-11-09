# 📝 MyToDoList - 即時多人協作待辦清單應用程式

這是一個專為團隊與多人協作設計的現代化即時待辦清單網頁應用程式，已永久內嵌並綁定 Firebase 專案 **`my-to-do-list-1e32d`**，支援 **Google 帳號登入**、**多人即時雙向同步**、**任務指派**、**在線協作者指示燈** 與 **活動歷程追蹤**。開箱即用，無需任何手動設定！

* 🌐 **GitHub 專案庫**：[https://github.com/barry-shih/MyToDoList](https://github.com/barry-shih/MyToDoList)
* 🚀 **GitHub Pages 線上展示**：`https://barry-shih.github.io/MyToDoList/`

---

## ✨ 核心功能特色

1. **Google 帳號快速登入**
   * 整合 Firebase Authentication，支援 Google 彈窗一鍵登入。
   * 自動同步 Google 個人頭像、顯示名稱與 Email。
   * 亦支援「訪客模式」，方便快速體驗。

2. **多人即時協作 (Cloud Firestore)**
   * **毫秒級雙向同步**：任何成員打勾完成、指派責任人、修改標籤或備註，所有人螢幕瞬間更新。
   * **專屬協作分享連結**：點擊「邀請協作」複製專屬 URL（如 `?listId=xyz`），傳給隊友即刻加入同一看板。
   * **在線成員指示燈**：右上角頭像堆疊即時標示目前在線協作成員。
   * **透明化完成標記**：清楚顯示每個任務是由哪位成員於何時標記為完成。

3. **豐富任務管理維度**
   * **優先級標籤**：🔴 緊急 (High)、🟡 一般 (Medium)、🟢 次要 (Low)。
   * **分類標籤**：💻 功能開發、🎨 視覺設計、🐞 Bug 修復、📝 專案企劃、📢 宣傳推廣、☕ 日常雜項。
   * **截止日期與逾期警示**：逾期項目自動以紅色醒目標註。
   * **進度百分比儀表板**：自動計算總數、進行中與完成百分比進度條。
   * **智慧過濾與搜尋**：支援多種分類標籤切換與即時關鍵字過濾。

4. **團隊活動動態日誌 (Activity Audit Log)**
   * 右側側邊欄即時記錄「誰在何時新增、完成或刪除了哪項任務」，確保團隊資訊完全對齊。

---

## 🚀 如何在 GitHub Pages 上線與設定網域

### 步驟 1：開啟 GitHub Pages
1. 前往 GitHub 儲存庫設定頁：[https://github.com/barry-shih/MyToDoList/settings/pages](https://github.com/barry-shih/MyToDoList/settings/pages)
2. 在 **Build and deployment** 下方的 **Branch** 選擇 **`main`**，資料夾選擇 **`/ (root)`**。
3. 點擊 **Save**。
4. 等候約 1~2 分鐘，線上網址即可透過 `https://barry-shih.github.io/MyToDoList/` 開啟！

### 步驟 2：將網域加入 Firebase 授權清單 (讓 Google 登入在 GitHub Pages 生效)
1. 前往 [Firebase Console - Authentication 設定](https://console.firebase.google.com/project/my-to-do-list-1e32d/authentication/settings)
2. 進入 **Settings (設定)** > **Authorized domains (授權網域)**。
3. 點選 **「新增網域」 (Add domain)**，輸入：
   ```
   barry-shih.github.io
   ```
4. 點選儲存即可！所有在 GitHub Pages 訪問的使用者都能正常使用 Google 登入。

---

## 💻 本地啟動方式

```bash
cd MyToDoList
python3 -m http.server 8000
```
瀏覽器開啟：`http://localhost:8000`
