// 身份驗證模組 (Google 登入與使用者狀態管理)
import { 
    auth, 
    googleProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged,
    isConfigReady 
} from "./firebase-config.js";

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.subscribers = new Set();
        this.initialized = false;
        this.isGuest = false;
    }

    // 初始化認證監聽器
    init() {
        if (!auth) {
            console.warn("Auth 服務尚未初始化");
            // 嘗試從本機還原訪客模式
            const savedGuest = localStorage.getItem("mytodolist_guest_user");
            if (savedGuest) {
                try {
                    this.currentUser = JSON.parse(savedGuest);
                    this.isGuest = true;
                } catch (e) {}
            }
            this.initialized = true;
            this.notify();
            return;
        }

        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.currentUser = {
                    uid: user.uid,
                    displayName: user.displayName || "Google 使用者",
                    email: user.email || "",
                    photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
                    isAnonymous: false,
                    isGuest: false
                };
                this.isGuest = false;
                localStorage.removeItem("mytodolist_guest_user");
            } else {
                // 檢查是否有訪客身份
                const savedGuest = localStorage.getItem("mytodolist_guest_user");
                if (savedGuest) {
                    this.currentUser = JSON.parse(savedGuest);
                    this.isGuest = true;
                } else {
                    this.currentUser = null;
                    this.isGuest = false;
                }
            }
            this.initialized = true;
            this.notify();
        });
    }

    // Google 彈窗登入
    async loginWithGoogle() {
        if (!isConfigReady()) {
            throw new Error("CONFIG_NOT_READY");
        }
        if (!auth || !googleProvider) {
            throw new Error("AUTH_NOT_INITIALIZED");
        }

        try {
            const result = await signInWithPopup(auth, googleProvider);
            return result.user;
        } catch (error) {
            console.error("Google 登入失敗:", error);
            // 常見錯誤友善解析
            if (error.code === 'auth/unauthorized-domain') {
                throw new Error("UNAUTHORIZED_DOMAIN");
            } else if (error.code === 'auth/popup-closed-by-user') {
                throw new Error("POPUP_CLOSED");
            } else if (error.code === 'auth/operation-not-allowed') {
                throw new Error("GOOGLE_PROVIDER_DISABLED");
            }
            throw error;
        }
    }

    // 以自訂名稱或訪客體驗登入 (無 API Key 或離線測試用)
    loginAsGuest(nickname = "協作測試員") {
        const guestId = "guest_" + Math.random().toString(36).substring(2, 9);
        const guestUser = {
            uid: guestId,
            displayName: nickname,
            email: `${guestId}@guest.local`,
            photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestId}`,
            isAnonymous: true,
            isGuest: true
        };
        this.currentUser = guestUser;
        this.isGuest = true;
        localStorage.setItem("mytodolist_guest_user", JSON.stringify(guestUser));
        this.notify();
        return guestUser;
    }

    // 登出
    async logout() {
        if (this.isGuest) {
            this.currentUser = null;
            this.isGuest = false;
            localStorage.removeItem("mytodolist_guest_user");
            this.notify();
            return;
        }

        if (auth) {
            await signOut(auth);
        }
        this.currentUser = null;
        this.notify();
    }

    // 訂閱狀態更新
    subscribe(callback) {
        this.subscribers.add(callback);
        if (this.initialized) {
            callback(this.currentUser);
        }
        return () => this.subscribers.delete(callback);
    }

    notify() {
        for (const cb of this.subscribers) {
            try {
                cb(this.currentUser);
            } catch (err) {
                console.error("Auth subscriber error:", err);
            }
        }
    }

    getUser() {
        return this.currentUser;
    }
}

export const authManager = new AuthManager();
