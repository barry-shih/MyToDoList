// 主應用邏輯與 UI 互動控制器
import { initFirebase } from "./firebase-config.js";
import { authManager } from "./auth.js";
import { dbManager } from "./db.js";

class App {
    constructor() {
        this.currentUser = null;
        this.currentList = null;
        this.lists = [];
        this.tasks = [];
        this.activities = [];
        this.onlineUsers = [];

        // 篩選與搜尋狀態
        this.currentFilter = 'all'; // all | pending | completed | my_tasks | high_priority
        this.searchQuery = '';
        this.currentSort = 'newest'; // newest | due_date | priority

        this.initDOM();
        this.bindEvents();
    }

    initDOM() {
        // 頂部導航
        this.authBtnContainer = document.getElementById('auth-btn-container');
        this.userProfileEl = document.getElementById('user-profile');
        this.userAvatarEl = document.getElementById('user-avatar');
        this.userNameEl = document.getElementById('user-name');
        this.userEmailEl = document.getElementById('user-email');

        // 看板清單選擇區
        this.listsDropdown = document.getElementById('lists-dropdown');
        this.currentListTitle = document.getElementById('current-list-title');
        this.currentListDesc = document.getElementById('current-list-desc');
        this.collaboratorsStack = document.getElementById('collaborators-stack');
        this.shareListBtn = document.getElementById('share-list-btn');

        // 任務過濾與搜尋
        this.searchInput = document.getElementById('search-input');
        this.filterTabs = document.querySelectorAll('.filter-tab');
        this.sortSelect = document.getElementById('sort-select');

        // 任務列表與統計
        this.tasksContainer = document.getElementById('tasks-container');
        this.tasksEmptyState = document.getElementById('tasks-empty-state');
        this.totalCountBadge = document.getElementById('stat-total-count');
        this.pendingCountBadge = document.getElementById('stat-pending-count');
        this.completedCountBadge = document.getElementById('stat-completed-count');
        this.progressPercentage = document.getElementById('progress-percentage');
        this.progressBar = document.getElementById('progress-bar');

        // 活動記錄
        this.activitiesContainer = document.getElementById('activities-container');

        // 彈窗
        this.taskModal = document.getElementById('task-modal');
        this.taskForm = document.getElementById('task-form');
        this.listModal = document.getElementById('list-modal');
        this.listForm = document.getElementById('list-form');

        // 提示容器
        this.toastContainer = document.getElementById('toast-container');
    }

    start() {
        // 1. 初始化 Firebase (正式設定已固定載入)
        initFirebase();

        // 2. 初始化認證監聽
        authManager.subscribe((user) => {
            this.currentUser = user;
            this.renderAuthUI();
            this.loadUserData();
        });
        authManager.init();

        // 3. 檢查網址參數是否帶有 listId (協作分享連結)
        const urlParams = new URLSearchParams(window.location.search);
        this.urlListId = urlParams.get('listId');
    }

    renderAuthUI() {
        if (this.currentUser) {
            this.authBtnContainer.classList.add('hidden');
            this.userProfileEl.classList.remove('hidden');
            this.userAvatarEl.src = this.currentUser.photoURL;
            this.userNameEl.textContent = this.currentUser.displayName;
            this.userEmailEl.textContent = this.currentUser.isGuest ? ' (訪客/測試模式)' : (this.currentUser.email || '');
        } else {
            this.authBtnContainer.classList.remove('hidden');
            this.userProfileEl.classList.add('hidden');
        }
    }

    loadUserData() {
        const user = this.currentUser || {
            uid: 'guest_user',
            displayName: '訪客成員',
            photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=guest',
            isGuest: true
        };

        // 監聽清單列表
        dbManager.subscribeUserLists(user, async (lists) => {
            this.lists = lists;
            this.renderListsDropdown();

            // 若網址帶有 listId，嘗試切換或加入
            if (this.urlListId) {
                const targetId = this.urlListId;
                this.urlListId = null; // 只跑一次
                await dbManager.joinList(targetId, user);
                const found = lists.find(l => l.id === targetId);
                if (found) {
                    this.switchList(found);
                    this.showToast(`已成功加入協作清單「${found.title}」`, 'success');
                    return;
                }
            }

            // 若目前沒有選中清單或目前清單已被刪除，切換至第一張
            if (!this.currentList || !lists.find(l => l.id === this.currentList.id)) {
                if (lists.length > 0) {
                    this.switchList(lists[0]);
                } else {
                    // 自動為初次登入使用者建立第一張待辦清單
                    const newListId = await dbManager.createList({
                        title: `${user.displayName} 的協作待辦`,
                        description: '支援即時多人共享，點擊右上角「邀請協作」複製連結'
                    }, user);
                    const createdList = await dbManager.getListInfo(newListId);
                    if (createdList) this.switchList(createdList);
                }
            } else {
                // 更新當前清單資訊 (如成員變更)
                const refreshed = lists.find(l => l.id === this.currentList.id);
                if (refreshed) {
                    this.currentList = refreshed;
                    this.renderCurrentListHeader();
                }
            }
        });
    }

    switchList(list) {
        this.currentList = list;
        this.renderCurrentListHeader();

        const user = this.currentUser || {
            uid: 'guest_user',
            displayName: '訪客成員',
            photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=guest'
        };

        // 更新 Presence
        dbManager.updatePresence(list.id, user);

        // 監聽 Presence 在線協作者
        dbManager.subscribePresence(list.id, (onlineList) => {
            this.onlineUsers = onlineList;
            this.renderCollaborators();
        });

        // 監聽任務變更
        dbManager.subscribeTasks(list.id, (tasks) => {
            this.tasks = tasks;
            this.renderTasks();
            this.updateStats();
        });

        // 監聽活動日誌
        dbManager.subscribeActivities(list.id, (activities) => {
            this.activities = activities;
            this.renderActivities();
        });
    }

    renderListsDropdown() {
        if (!this.listsDropdown) return;
        this.listsDropdown.innerHTML = '';
        this.lists.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.id;
            opt.textContent = l.title;
            if (this.currentList && this.currentList.id === l.id) {
                opt.selected = true;
            }
            this.listsDropdown.appendChild(opt);
        });
    }

    renderCurrentListHeader() {
        if (!this.currentList) return;
        this.currentListTitle.textContent = this.currentList.title;
        this.currentListDesc.textContent = this.currentList.description || '即時雲端多人協作中';
        this.renderCollaborators();
    }

    renderCollaborators() {
        if (!this.collaboratorsStack) return;
        this.collaboratorsStack.innerHTML = '';

        const members = this.currentList?.members || [];
        members.forEach(member => {
            const isOnline = this.onlineUsers.some(u => u.uid === member.uid);
            const avatarWrap = document.createElement('div');
            avatarWrap.className = 'relative group cursor-pointer';
            avatarWrap.title = `${member.displayName} (${member.role === 'owner' ? '建立者' : '成員'})${isOnline ? ' - 🟢 在線上' : ''}`;

            avatarWrap.innerHTML = `
                <img src="${member.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.uid}`}" 
                     class="w-8 h-8 rounded-full object-cover border-2 ${isOnline ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-white'} shadow-sm">
                ${isOnline ? '<span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></span>' : ''}
            `;
            this.collaboratorsStack.appendChild(avatarWrap);
        });
    }

    /* ============================================================
       任務渲染與過濾
       ============================================================ */

    getFilteredTasks() {
        let result = [...this.tasks];

        // 搜尋篩選
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            result = result.filter(t => 
                (t.title && t.title.toLowerCase().includes(q)) ||
                (t.description && t.description.toLowerCase().includes(q)) ||
                (t.category && t.category.toLowerCase().includes(q))
            );
        }

        // 標籤篩選
        const myUid = this.currentUser?.uid;
        if (this.currentFilter === 'pending') {
            result = result.filter(t => !t.completed);
        } else if (this.currentFilter === 'completed') {
            result = result.filter(t => t.completed);
        } else if (this.currentFilter === 'my_tasks') {
            result = result.filter(t => t.assignee?.uid === myUid || t.createdBy?.uid === myUid);
        } else if (this.currentFilter === 'high_priority') {
            result = result.filter(t => t.priority === 'high');
        }

        // 排序
        if (this.currentSort === 'newest') {
            result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        } else if (this.currentSort === 'due_date') {
            result.sort((a, b) => {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate) - new Date(b.dueDate);
            });
        } else if (this.currentSort === 'priority') {
            const weights = { high: 3, medium: 2, low: 1 };
            result.sort((a, b) => (weights[b.priority] || 0) - (weights[a.priority] || 0));
        }

        return result;
    }

    renderTasks() {
        const filtered = this.getFilteredTasks();

        if (filtered.length === 0) {
            this.tasksContainer.innerHTML = '';
            this.tasksEmptyState.classList.remove('hidden');
            return;
        }

        this.tasksEmptyState.classList.add('hidden');
        this.tasksContainer.innerHTML = '';

        filtered.forEach(task => {
            const item = document.createElement('div');
            item.className = `p-4 rounded-xl border bg-white card-hover transition-all duration-200 ${
                task.completed ? 'bg-slate-50 border-slate-200 task-completed opacity-80' : 'border-slate-200/80 shadow-sm'
            }`;

            const priorityBadgeMap = {
                high: '<span class="badge-priority-high text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">🔴 緊急</span>',
                medium: '<span class="badge-priority-medium text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">🟡 一般</span>',
                low: '<span class="badge-priority-low text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">🟢 次要</span>'
            };

            const isDueOverdue = task.dueDate && !task.completed && new Date(task.dueDate) < new Date(new Date().setHours(0,0,0,0));

            item.innerHTML = `
                <div class="flex items-start gap-3.5">
                    <!-- 打勾選取框 -->
                    <button type="button" class="toggle-task-btn mt-1 flex-shrink-0 w-6 h-6 rounded-md border-2 transition-all flex items-center justify-center ${
                        task.completed ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 hover:border-indigo-500 bg-white'
                    }" data-id="${task.id}" data-title="${encodeURIComponent(task.title)}" data-completed="${task.completed}">
                        ${task.completed ? '<svg class="w-4 h-4 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : ''}
                    </button>

                    <!-- 任務核心資訊 -->
                    <div class="flex-grow min-w-0">
                        <div class="flex items-center flex-wrap gap-2 mb-1">
                            <span class="task-title text-base font-semibold text-slate-800 break-words">${this.escapeHTML(task.title)}</span>
                            ${priorityBadgeMap[task.priority] || priorityBadgeMap.medium}
                            ${task.category ? `<span class="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-md font-medium">🏷️ ${this.escapeHTML(task.category)}</span>` : ''}
                        </div>

                        ${task.description ? `<p class="text-sm text-slate-500 mb-2.5 break-words line-clamp-2">${this.escapeHTML(task.description)}</p>` : ''}

                        <!-- 協作詮釋資料 (建立者、指派人、截止日、完成者) -->
                        <div class="flex items-center flex-wrap gap-y-2 gap-x-4 text-xs text-slate-500">
                            <!-- 截止日期 -->
                            ${task.dueDate ? `
                                <div class="flex items-center gap-1 ${isDueOverdue ? 'text-rose-600 font-semibold' : ''}">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                    <span>${task.dueDate} ${isDueOverdue ? '(已逾期)' : ''}</span>
                                </div>
                            ` : ''}

                            <!-- 建立者 -->
                            <div class="flex items-center gap-1">
                                <img src="${task.createdBy?.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=creator'}" class="w-4 h-4 rounded-full">
                                <span>${this.escapeHTML(task.createdBy?.displayName || '隊友')} 建立</span>
                            </div>

                            <!-- 指派成員 -->
                            ${task.assignee ? `
                                <div class="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                                    <img src="${task.assignee.photoURL}" class="w-3.5 h-3.5 rounded-full">
                                    <span>指派給: ${this.escapeHTML(task.assignee.displayName)}</span>
                                </div>
                            ` : ''}

                            <!-- 完成者資訊 -->
                            ${task.completed && task.completedBy ? `
                                <div class="flex items-center gap-1 text-emerald-600 font-medium">
                                    <img src="${task.completedBy.photoURL}" class="w-4 h-4 rounded-full">
                                    <span>由 ${this.escapeHTML(task.completedBy.displayName)} 完成</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- 操作選單 (刪除) -->
                    <div class="flex items-center gap-1 flex-shrink-0">
                        <button type="button" class="delete-task-btn p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" data-id="${task.id}" data-title="${encodeURIComponent(task.title)}" title="刪除任務">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                    </div>
                </div>
            `;

            this.tasksContainer.appendChild(item);
        });

        // 綁定打勾與刪除事件
        this.tasksContainer.querySelectorAll('.toggle-task-btn').forEach(btn => {
            btn.onclick = (e) => {
                const id = btn.dataset.id;
                const title = decodeURIComponent(btn.dataset.title);
                const currentStatus = btn.dataset.completed === 'true';
                const user = this.currentUser || { uid: 'guest', displayName: '訪客', photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=guest' };
                dbManager.toggleTask(this.currentList.id, id, !currentStatus, user, title);
            };
        });

        this.tasksContainer.querySelectorAll('.delete-task-btn').forEach(btn => {
            btn.onclick = (e) => {
                const id = btn.dataset.id;
                const title = decodeURIComponent(btn.dataset.title);
                if (confirm(`確定要刪除「${title}」嗎？所有協作成員都將無法再看到此任務。`)) {
                    const user = this.currentUser || { uid: 'guest', displayName: '訪客', photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=guest' };
                    dbManager.deleteTask(this.currentList.id, id, user, title);
                    this.showToast('已刪除任務', 'info');
                }
            };
        });
    }

    updateStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const pending = total - completed;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        if (this.totalCountBadge) this.totalCountBadge.textContent = total;
        if (this.pendingCountBadge) this.pendingCountBadge.textContent = pending;
        if (this.completedCountBadge) this.completedCountBadge.textContent = completed;
        if (this.progressPercentage) this.progressPercentage.textContent = `${percent}%`;
        if (this.progressBar) this.progressBar.style.width = `${percent}%`;
    }

    renderActivities() {
        if (!this.activitiesContainer) return;
        this.activitiesContainer.innerHTML = '';

        if (this.activities.length === 0) {
            this.activitiesContainer.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">尚無動態紀錄</p>';
            return;
        }

        this.activities.forEach(act => {
            const el = document.createElement('div');
            el.className = 'flex items-start gap-2.5 text-xs py-2 border-b border-slate-100 last:border-none';
            const timeStr = act.timestamp ? new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '剛才';

            el.innerHTML = `
                <img src="${act.user?.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=act'}" class="w-5 h-5 rounded-full mt-0.5">
                <div class="flex-grow min-w-0">
                    <p class="text-slate-700 leading-tight">
                        <span class="font-medium text-slate-900">${this.escapeHTML(act.user?.displayName || '成員')}</span>
                        ${this.escapeHTML(act.detail || '')}
                    </p>
                    <span class="text-[10px] text-slate-400">${timeStr}</span>
                </div>
            `;
            this.activitiesContainer.appendChild(el);
        });
    }

    /* ============================================================
       使用者操作綁定
       ============================================================ */

    bindEvents() {
        // Google 登入按鈕
        const googleLoginBtn = document.getElementById('google-login-btn');
        if (googleLoginBtn) {
            googleLoginBtn.onclick = async () => {
                try {
                    await authManager.loginWithGoogle();
                    this.showToast('Google 登入成功！歡迎回來', 'success');
                } catch (err) {
                    if (err.message === 'UNAUTHORIZED_DOMAIN') {
                        alert('【Firebase 授權網域提示】\n您的 Firebase 專案尚未將目前網域加入授權清單。\n\n請前往 Firebase Console -> Authentication -> Settings -> Authorized domains 加入當前網址 (例如 localhost 或 barry-shih.github.io)。');
                    } else if (err.message === 'GOOGLE_PROVIDER_DISABLED') {
                        alert('【Google 登入提供者未啟用】\n請前往 Firebase 控制台 -> Authentication -> Sign-in method，將「Google」啟用並儲存。');
                    } else if (err.message !== 'POPUP_CLOSED') {
                        this.showToast(`登入失敗: ${err.message || '未知錯誤'}`, 'error');
                    }
                }
            };
        }

        // 登出按鈕
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = async () => {
                await authManager.logout();
                this.showToast('已安全登出', 'info');
            };
        }

        // 訪客模式快速登入按鈕
        const guestLoginBtn = document.getElementById('guest-login-btn');
        if (guestLoginBtn) {
            guestLoginBtn.onclick = () => {
                const name = prompt('請輸入您的協作暱稱 (例如: Barry, Alex):', '協作工程師') || '協作工程師';
                authManager.loginAsGuest(name);
                this.showToast(`已切換為「${name}」訪客模式`, 'success');
            };
        }

        // 清單下拉切換
        if (this.listsDropdown) {
            this.listsDropdown.onchange = (e) => {
                const selected = this.lists.find(l => l.id === e.target.value);
                if (selected) this.switchList(selected);
            };
        }

        // 建立新清單按鈕
        const newBoardBtn = document.getElementById('new-list-btn');
        if (newBoardBtn) {
            newBoardBtn.onclick = () => {
                this.listModal.classList.remove('hidden');
                document.getElementById('list-name-input').focus();
            };
        }

        // 建立新清單表單送出
        if (this.listForm) {
            this.listForm.onsubmit = async (e) => {
                e.preventDefault();
                const title = document.getElementById('list-name-input').value;
                const desc = document.getElementById('list-desc-input').value;
                const user = this.currentUser || { uid: 'guest', displayName: '訪客', photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=guest' };

                try {
                    const newId = await dbManager.createList({ title, description: desc }, user);
                    this.listForm.reset();
                    this.listModal.classList.add('hidden');
                    this.showToast(`已建立新清單「${title}」`, 'success');
                } catch (err) {
                    console.error("建立清單失敗:", err);
                    this.handlePermissionError(err);
                }
            };
        }

        // 新增任務按鈕
        const addTaskBtn = document.getElementById('add-task-btn');
        if (addTaskBtn) {
            addTaskBtn.onclick = () => {
                if (!this.currentList) {
                    this.showToast('請先建立或選擇待辦清單', 'warning');
                    return;
                }
                this.populateAssigneeOptions();
                this.taskModal.classList.remove('hidden');
                document.getElementById('task-title-input').focus();
            };
        }

        // 任務表單送出
        if (this.taskForm) {
            this.taskForm.onsubmit = async (e) => {
                e.preventDefault();
                const title = document.getElementById('task-title-input').value;
                const description = document.getElementById('task-desc-input').value;
                const priority = document.getElementById('task-priority-select').value;
                const category = document.getElementById('task-category-select').value;
                const dueDate = document.getElementById('task-duedate-input').value;
                const assigneeSelect = document.getElementById('task-assignee-select');
                
                let assignee = null;
                if (assigneeSelect.value && assigneeSelect.value !== 'none') {
                    const foundMember = this.currentList?.members?.find(m => m.uid === assigneeSelect.value);
                    if (foundMember) {
                        assignee = {
                            uid: foundMember.uid,
                            displayName: foundMember.displayName,
                            photoURL: foundMember.photoURL
                        };
                    }
                }

                const user = this.currentUser || { uid: 'guest', displayName: '訪客', photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=guest' };
                try {
                    await dbManager.addTask(this.currentList.id, {
                        title, description, priority, category, dueDate, assignee
                    }, user);

                    this.taskForm.reset();
                    this.taskModal.classList.add('hidden');
                    this.showToast('已新增任務並即時同步給所有成員！', 'success');
                } catch (err) {
                    console.error("新增任務失敗:", err);
                    this.handlePermissionError(err);
                }
            };
        }

        // 複製分享/協作連結
        if (this.shareListBtn) {
            this.shareListBtn.onclick = () => {
                if (!this.currentList) return;
                const url = new URL(window.location.href);
                url.searchParams.set('listId', this.currentList.id);
                navigator.clipboard.writeText(url.toString()).then(() => {
                    this.showToast('📋 已複製協作邀請連結！傳給隊友即可即時共同編輯', 'success');
                }).catch(() => {
                    prompt('複製以下連結邀請隊友共同協作：', url.toString());
                });
            };
        }

        // 搜尋監聽
        if (this.searchInput) {
            this.searchInput.oninput = (e) => {
                this.searchQuery = e.target.value.trim();
                this.renderTasks();
            };
        }

        // 篩選標籤
        this.filterTabs.forEach(tab => {
            tab.onclick = () => {
                this.filterTabs.forEach(t => t.classList.remove('bg-indigo-600', 'text-white'));
                this.filterTabs.forEach(t => t.classList.add('text-slate-600', 'hover:bg-slate-100'));
                tab.classList.add('bg-indigo-600', 'text-white');
                tab.classList.remove('text-slate-600', 'hover:bg-slate-100');
                this.currentFilter = tab.dataset.filter;
                this.renderTasks();
            };
        });

        // 排序選單
        if (this.sortSelect) {
            this.sortSelect.onchange = (e) => {
                this.currentSort = e.target.value;
                this.renderTasks();
            };
        }

        // 彈窗關閉按鈕通配
        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.onclick = () => {
                this.taskModal.classList.add('hidden');
                this.listModal.classList.add('hidden');
            };
        });
    }

    populateAssigneeOptions() {
        const select = document.getElementById('task-assignee-select');
        if (!select) return;
        select.innerHTML = '<option value="none">未指派 (任何人皆可認領)</option>';
        const members = this.currentList?.members || [];
        members.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.uid;
            opt.textContent = `${m.displayName}${m.uid === this.currentUser?.uid ? ' (我自己)' : ''}`;
            select.appendChild(opt);
        });
    }

    handlePermissionError(err) {
        if (err?.code === 'permission-denied' || String(err?.message || '').includes('insufficient permissions')) {
            alert('【Firebase 資料庫安全性規則權限不足提示】\n\n您的 Firestore 資料庫尚未發布開放讀寫的安全性規則。\n請至 Firebase 控制台 -> Firestore Database -> 「規則 (Rules)」分頁，將規則改為允許讀寫後點擊「發布 (Publish)」即可正常運作！');
        } else {
            this.showToast(`操作失敗: ${err?.message || '未知錯誤'}`, 'error');
        }
    }

    showToast(message, type = 'info') {
        if (!this.toastContainer) return;
        const toast = document.createElement('div');
        const colorMap = {
            success: 'bg-emerald-600 text-white',
            warning: 'bg-amber-500 text-white',
            error: 'bg-rose-600 text-white',
            info: 'bg-slate-900 text-white'
        };
        toast.className = `toast px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 shadow-lg ${colorMap[type] || colorMap.info}`;
        toast.innerHTML = `<span>${this.escapeHTML(message)}</span>`;
        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

// 啟動應用
window.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.start();
});
