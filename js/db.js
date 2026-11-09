// 資料庫與即時多人協作模組
import { 
    db, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    onSnapshot, 
    query, 
    where, 
    orderBy, 
    serverTimestamp,
    arrayUnion,
    isConfigReady 
} from "./firebase-config.js";

// 用於跨分頁即時同步的廣播通道 (離線/展示模式支援)
const localChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('mytodolist_sync_channel') : null;

class DatabaseManager {
    constructor() {
        this.activeUnsubscribers = [];
        this.currentListId = null;
        this.localStorePrefix = 'mytodolist_local_';
        this.setupBroadcastChannel();
    }

    setupBroadcastChannel() {
        if (!localChannel) return;
        localChannel.onmessage = (event) => {
            const { type, listId } = event.data || {};
            if (listId === this.currentListId) {
                if (this.onTasksUpdateLocal && (type === 'task_change' || type === 'activity_change')) {
                    this.triggerLocalTasksUpdate(listId);
                }
                if (this.onActivitiesUpdateLocal && type === 'activity_change') {
                    this.triggerLocalActivitiesUpdate(listId);
                }
            }
        };
    }

    // 清除現有的 Firestore 監聽器
    clearListeners() {
        this.activeUnsubscribers.forEach(unsub => {
            try { unsub(); } catch (e) {}
        });
        this.activeUnsubscribers = [];
    }

    /* ============================================================
       清單 (Lists / Workspaces) 管理
       ============================================================ */

    // 建立新清單
    async createList(listData, user) {
        const payload = {
            title: listData.title.trim(),
            description: listData.description?.trim() || "",
            theme: listData.theme || "indigo",
            owner: {
                uid: user.uid,
                displayName: user.displayName,
                photoURL: user.photoURL,
                email: user.email || ""
            },
            members: [{
                uid: user.uid,
                displayName: user.displayName,
                photoURL: user.photoURL,
                email: user.email || "",
                role: "owner",
                joinedAt: new Date().toISOString()
            }],
            createdAt: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
            updatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString()
        };

        if (isConfigReady() && db) {
            const listRef = await addDoc(collection(db, "lists"), payload);
            await this.recordActivity(listRef.id, user, "建立清單", `建立「${payload.title}」`);
            return listRef.id;
        } else {
            // 本地儲存模式
            const id = 'list_' + Date.now();
            payload.id = id;
            payload.createdAt = new Date().toISOString();
            payload.updatedAt = new Date().toISOString();
            
            const lists = this.getLocalLists();
            lists.unshift(payload);
            localStorage.setItem(this.localStorePrefix + 'lists', JSON.stringify(lists));
            this.recordLocalActivity(id, user, "建立清單", `建立「${payload.title}」`);
            return id;
        }
    }

    // 監聽使用者的清單列表 (包含自己擁有的或加入成員的)
    subscribeUserLists(user, onUpdate, onError) {
        if (!user) return () => {};

        if (isConfigReady() && db) {
            // 監聽所有清單 (可根據 Firestore Rules 或前端過濾)
            const q = query(collection(db, "lists"), orderBy("createdAt", "desc"));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const lists = [];
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    lists.push({ id: docSnap.id, ...data });
                });
                onUpdate(lists);
            }, (error) => {
                console.error("監聽清單出錯:", error);
                if (onError) onError(error);
                // 降級為本地資料
                onUpdate(this.getLocalLists());
            });
            this.activeUnsubscribers.push(unsubscribe);
            return unsubscribe;
        } else {
            // 本地模式
            const update = () => onUpdate(this.getLocalLists());
            update();
            window.addEventListener('storage', update);
            return () => window.removeEventListener('storage', update);
        }
    }

    // 加入協作清單 (透過分享連結或清單代碼)
    async joinList(listId, user) {
        if (!user || !listId) return false;

        const memberData = {
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            email: user.email || "",
            role: "collaborator",
            joinedAt: new Date().toISOString()
        };

        if (isConfigReady() && db) {
            try {
                const listRef = doc(db, "lists", listId);
                const listSnap = await getDoc(listRef);
                if (!listSnap.exists()) return false;

                const data = listSnap.data();
                const members = data.members || [];
                const alreadyMember = members.some(m => m.uid === user.uid);

                if (!alreadyMember) {
                    await updateDoc(listRef, {
                        members: arrayUnion(memberData),
                        updatedAt: serverTimestamp()
                    });
                    await this.recordActivity(listId, user, "加入協作", `${user.displayName} 加入了此清單`);
                }
                return true;
            } catch (err) {
                console.error("加入清單失敗:", err);
                return false;
            }
        } else {
            // 本地清單
            const lists = this.getLocalLists();
            const list = lists.find(l => l.id === listId);
            if (list) {
                if (!list.members.some(m => m.uid === user.uid)) {
                    list.members.push(memberData);
                    localStorage.setItem(this.localStorePrefix + 'lists', JSON.stringify(lists));
                    this.recordLocalActivity(listId, user, "加入協作", `${user.displayName} 加入了此清單`);
                }
                return true;
            }
            return false;
        }
    }

    // 取得單一清單資訊
    async getListInfo(listId) {
        if (!listId) return null;
        if (isConfigReady() && db) {
            try {
                const snap = await getDoc(doc(db, "lists", listId));
                if (snap.exists()) {
                    return { id: snap.id, ...snap.data() };
                }
            } catch (e) {
                console.error("取得清單錯誤:", e);
            }
        }
        const lists = this.getLocalLists();
        return lists.find(l => l.id === listId) || null;
    }

    /* ============================================================
       任務 (Tasks) 即時協作與 CRUD
       ============================================================ */

    // 監聽特定清單的即時待辦事項
    subscribeTasks(listId, onUpdate, onError) {
        this.currentListId = listId;

        if (isConfigReady() && db) {
            const q = query(
                collection(db, "tasks"), 
                where("listId", "==", listId),
                orderBy("createdAt", "desc")
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const tasks = [];
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    tasks.push({
                        id: docSnap.id,
                        ...data,
                        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now())
                    });
                });
                onUpdate(tasks);
            }, (error) => {
                console.error("Tasks snapshot error:", error);
                if (onError) onError(error);
                onUpdate(this.getLocalTasks(listId));
            });

            this.activeUnsubscribers.push(unsubscribe);
            return unsubscribe;
        } else {
            this.onTasksUpdateLocal = onUpdate;
            const update = () => onUpdate(this.getLocalTasks(listId));
            update();
            return () => { this.onTasksUpdateLocal = null; };
        }
    }

    // 新增任務
    async addTask(listId, taskData, user) {
        const payload = {
            listId,
            title: taskData.title.trim(),
            description: taskData.description?.trim() || "",
            priority: taskData.priority || "medium", // high | medium | low
            category: taskData.category || "開發",
            dueDate: taskData.dueDate || "",
            completed: false,
            assignee: taskData.assignee || null,
            createdBy: {
                uid: user.uid,
                displayName: user.displayName,
                photoURL: user.photoURL
            },
            completedBy: null,
            completedAt: null,
            createdAt: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
            updatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString()
        };

        if (isConfigReady() && db) {
            const docRef = await addDoc(collection(db, "tasks"), payload);
            await this.recordActivity(listId, user, "新增任務", `新增了「${payload.title}」`);
            return docRef.id;
        } else {
            const id = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
            payload.id = id;
            payload.createdAt = new Date().toISOString();
            payload.updatedAt = new Date().toISOString();

            const tasks = this.getLocalTasks(listId);
            tasks.unshift(payload);
            localStorage.setItem(this.localStorePrefix + 'tasks_' + listId, JSON.stringify(tasks));
            this.recordLocalActivity(listId, user, "新增任務", `新增了「${payload.title}」`);
            this.notifyLocalChange('task_change', listId);
            return id;
        }
    }

    // 切換任務完成狀態 (多人即時回饋)
    async toggleTask(listId, taskId, isCompleted, user, taskTitle = "") {
        const updateData = {
            completed: isCompleted,
            completedBy: isCompleted ? {
                uid: user.uid,
                displayName: user.displayName,
                photoURL: user.photoURL
            } : null,
            completedAt: isCompleted ? (serverTimestamp ? serverTimestamp() : new Date().toISOString()) : null,
            updatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString()
        };

        if (isConfigReady() && db) {
            await updateDoc(doc(db, "tasks", taskId), updateData);
            const action = isCompleted ? "完成任務" : "重啟任務";
            await this.recordActivity(listId, user, action, `${action}「${taskTitle}」`);
        } else {
            const tasks = this.getLocalTasks(listId);
            const target = tasks.find(t => t.id === taskId);
            if (target) {
                target.completed = isCompleted;
                target.completedBy = updateData.completedBy;
                target.completedAt = updateData.completedAt;
                target.updatedAt = new Date().toISOString();
                localStorage.setItem(this.localStorePrefix + 'tasks_' + listId, JSON.stringify(tasks));
                
                const action = isCompleted ? "完成任務" : "重啟任務";
                this.recordLocalActivity(listId, user, action, `${action}「${taskTitle || target.title}」`);
                this.notifyLocalChange('task_change', listId);
            }
        }
    }

    // 更新任務詳情
    async updateTask(listId, taskId, updates, user, taskTitle = "") {
        const payload = {
            ...updates,
            updatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString()
        };

        if (isConfigReady() && db) {
            await updateDoc(doc(db, "tasks", taskId), payload);
            await this.recordActivity(listId, user, "更新任務", `修改了任務內容`);
        } else {
            const tasks = this.getLocalTasks(listId);
            const idx = tasks.findIndex(t => t.id === taskId);
            if (idx !== -1) {
                tasks[idx] = { ...tasks[idx], ...payload, updatedAt: new Date().toISOString() };
                localStorage.setItem(this.localStorePrefix + 'tasks_' + listId, JSON.stringify(tasks));
                this.recordLocalActivity(listId, user, "更新任務", `修改了任務內容`);
                this.notifyLocalChange('task_change', listId);
            }
        }
    }

    // 刪除任務
    async deleteTask(listId, taskId, user, taskTitle = "") {
        if (isConfigReady() && db) {
            await deleteDoc(doc(db, "tasks", taskId));
            await this.recordActivity(listId, user, "刪除任務", `移除了「${taskTitle}」`);
        } else {
            let tasks = this.getLocalTasks(listId);
            tasks = tasks.filter(t => t.id !== taskId);
            localStorage.setItem(this.localStorePrefix + 'tasks_' + listId, JSON.stringify(tasks));
            this.recordLocalActivity(listId, user, "刪除任務", `移除了「${taskTitle}」`);
            this.notifyLocalChange('task_change', listId);
        }
    }

    /* ============================================================
       協作活動記錄 (Activity Stream / Audit Log)
       ============================================================ */

    async recordActivity(listId, user, action, detail) {
        try {
            if (isConfigReady() && db) {
                await addDoc(collection(db, "activities"), {
                    listId,
                    user: {
                        uid: user.uid,
                        displayName: user.displayName,
                        photoURL: user.photoURL
                    },
                    action,
                    detail,
                    timestamp: serverTimestamp()
                });
            }
        } catch (e) {
            console.error("無法寫入活動記錄:", e);
        }
    }

    subscribeActivities(listId, onUpdate) {
        if (isConfigReady() && db) {
            const q = query(
                collection(db, "activities"),
                where("listId", "==", listId),
                orderBy("timestamp", "desc")
            );
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const logs = [];
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    logs.push({
                        id: docSnap.id,
                        ...data,
                        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp || Date.now())
                    });
                });
                onUpdate(logs.slice(0, 30)); // 顯示最新 30 筆
            }, (error) => {
                console.warn("Activities snapshot error:", error);
                onUpdate(this.getLocalActivities(listId));
            });
            this.activeUnsubscribers.push(unsubscribe);
            return unsubscribe;
        } else {
            this.onActivitiesUpdateLocal = onUpdate;
            const update = () => onUpdate(this.getLocalActivities(listId));
            update();
            return () => { this.onActivitiesUpdateLocal = null; };
        }
    }

    /* ============================================================
       在線在線協作者 (Presence)
       ============================================================ */

    async updatePresence(listId, user) {
        if (!user || !listId) return;
        const presenceDocId = `${listId}_${user.uid}`;
        const data = {
            listId,
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            lastSeen: serverTimestamp ? serverTimestamp() : new Date().toISOString()
        };

        if (isConfigReady() && db) {
            try {
                await setDoc(doc(db, "presence", presenceDocId), data, { merge: true });
            } catch (e) {}
        }
    }

    subscribePresence(listId, onUpdate) {
        if (isConfigReady() && db) {
            const q = query(collection(db, "presence"), where("listId", "==", listId));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const online = [];
                const threshold = Date.now() - 5 * 60 * 1000; // 5 分鐘內視為在線
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    const time = data.lastSeen?.toDate ? data.lastSeen.toDate().getTime() : new Date(data.lastSeen).getTime();
                    if (time > threshold || !data.lastSeen) {
                        online.push(data);
                    }
                });
                onUpdate(online);
            }, () => {});
            this.activeUnsubscribers.push(unsubscribe);
            return unsubscribe;
        }
        return () => {};
    }

    /* ============================================================
       Local Fallback 處理
       ============================================================ */

    getLocalLists() {
        try {
            const raw = localStorage.getItem(this.localStorePrefix + 'lists');
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        // 預設示範清單
        const defaultLists = [{
            id: 'demo_list_general',
            title: '🚀 產品協作衝刺看板',
            description: '支援 Google 登入、即時多人編輯、優先級分類與活動紀錄',
            theme: 'indigo',
            owner: { uid: 'system', displayName: '系統範本', photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=system' },
            members: [
                { uid: 'system', displayName: '管理員', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', role: 'owner' }
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }];
        localStorage.setItem(this.localStorePrefix + 'lists', JSON.stringify(defaultLists));
        return defaultLists;
    }

    getLocalTasks(listId) {
        try {
            const raw = localStorage.getItem(this.localStorePrefix + 'tasks_' + listId);
            if (raw) return JSON.parse(raw);
        } catch (e) {}

        if (listId === 'demo_list_general') {
            const defaultTasks = [
                {
                    id: 'task_demo_1',
                    listId: 'demo_list_general',
                    title: '填寫 Firebase Web API Key',
                    description: '點擊右上角「Firebase 設定」填入 API Key 即可開啟真正的雲端同步！',
                    priority: 'high',
                    category: '設定',
                    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                    completed: false,
                    createdBy: { displayName: '系統精靈', photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=wizard' },
                    createdAt: new Date(Date.now() - 3600000).toISOString()
                },
                {
                    id: 'task_demo_2',
                    listId: 'demo_list_general',
                    title: '嘗試透過右上角「Google 登入」',
                    description: '使用 Google 帳號授權，頭像與個人識別將自動同步至所有任務。',
                    priority: 'high',
                    category: '帳號',
                    dueDate: '',
                    completed: false,
                    createdBy: { displayName: '系統精靈', photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=wizard' },
                    createdAt: new Date(Date.now() - 7200000).toISOString()
                },
                {
                    id: 'task_demo_3',
                    listId: 'demo_list_general',
                    title: '測試多人即時打勾完成與活動追蹤',
                    description: '支援點選勾選框，標記為完成後會記錄完成者頭像與時間戳記。',
                    priority: 'medium',
                    category: '體驗',
                    dueDate: '',
                    completed: true,
                    completedBy: { displayName: '展示成員', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo' },
                    completedAt: new Date().toISOString(),
                    createdBy: { displayName: '系統精靈', photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=wizard' },
                    createdAt: new Date(Date.now() - 10800000).toISOString()
                }
            ];
            localStorage.setItem(this.localStorePrefix + 'tasks_' + listId, JSON.stringify(defaultTasks));
            return defaultTasks;
        }
        return [];
    }

    recordLocalActivity(listId, user, action, detail) {
        const activities = this.getLocalActivities(listId);
        activities.unshift({
            id: 'act_' + Date.now(),
            listId,
            user: {
                uid: user.uid,
                displayName: user.displayName,
                photoURL: user.photoURL
            },
            action,
            detail,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem(this.localStorePrefix + 'activities_' + listId, JSON.stringify(activities.slice(0, 30)));
        this.notifyLocalChange('activity_change', listId);
    }

    getLocalActivities(listId) {
        try {
            const raw = localStorage.getItem(this.localStorePrefix + 'activities_' + listId);
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return [
            {
                id: 'act_init',
                listId,
                user: { displayName: '系統精靈', photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=wizard' },
                action: '系統初始化',
                detail: '已建立協作待辦清單',
                timestamp: new Date().toISOString()
            }
        ];
    }

    notifyLocalChange(type, listId) {
        if (localChannel) {
            localChannel.postMessage({ type, listId });
        }
    }

    triggerLocalTasksUpdate(listId) {
        if (this.onTasksUpdateLocal) {
            this.onTasksUpdateLocal(this.getLocalTasks(listId));
        }
    }

    triggerLocalActivitiesUpdate(listId) {
        if (this.onActivitiesUpdateLocal) {
            this.onActivitiesUpdateLocal(this.getLocalActivities(listId));
        }
    }
}

export const dbManager = new DatabaseManager();
