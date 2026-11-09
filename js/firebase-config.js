// Firebase 設定與模組初始化
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged,
    browserLocalPersistence,
    setPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
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
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 預設專案資訊 (my-to-do-list-1e32d)
export const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "", // 請在介面設定或在此填入 Firebase Web API Key
    authDomain: "my-to-do-list-1e32d.firebaseapp.com",
    projectId: "my-to-do-list-1e32d",
    storageBucket: "my-to-do-list-1e32d.firebasestorage.app",
    messagingSenderId: "",
    appId: ""
};

const STORAGE_KEY = "mytodolist_firebase_config_v1";

// 取得當前設定 (優先取 localStorage，無則使用預設)
export function getFirebaseConfig() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            return { ...DEFAULT_FIREBASE_CONFIG, ...parsed };
        } catch (e) {
            console.error("無法解析已儲存的 Firebase 設定:", e);
        }
    }
    return { ...DEFAULT_FIREBASE_CONFIG };
}

// 儲存設定到 localStorage
export function saveFirebaseConfig(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

// 重設為預設
export function resetFirebaseConfig() {
    localStorage.removeItem(STORAGE_KEY);
}

// 判斷是否具備有效的 API Key
export function isConfigReady(config = getFirebaseConfig()) {
    return Boolean(config.apiKey && config.apiKey.trim().length > 10 && config.projectId);
}

// 執行個體變數
export let app = null;
export let auth = null;
export let db = null;
export let googleProvider = null;

// 初始化 Firebase 實體
export function initFirebase() {
    const config = getFirebaseConfig();

    if (!isConfigReady(config)) {
        console.warn("⚠️ Firebase 尚未設定有效的 API Key，部分即時雲端同步功能暫不可用。請在設定中填入。");
        return { ready: false, config };
    }

    try {
        if (!getApps().length) {
            app = initializeApp(config);
        } else {
            app = getApp();
        }

        auth = getAuth(app);
        db = getFirestore(app);
        googleProvider = new GoogleAuthProvider();
        googleProvider.setCustomParameters({ prompt: 'select_account' });

        return { ready: true, app, auth, db, googleProvider, config };
    } catch (err) {
        console.error("Firebase 初始化失敗:", err);
        return { ready: false, error: err, config };
    }
}

export { 
    initializeApp, 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged,
    getFirestore, 
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
    arrayRemove
};
