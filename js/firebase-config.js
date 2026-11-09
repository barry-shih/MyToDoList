// Firebase 設定與模組初始化
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged
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

// 正式環境 Firebase 專案設定 (my-to-do-list-1e32d)
export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBnbJVxqBa_XXO96ChMqB8AVyrdcP0V3Ms",
    authDomain: "my-to-do-list-1e32d.firebaseapp.com",
    projectId: "my-to-do-list-1e32d",
    storageBucket: "my-to-do-list-1e32d.firebasestorage.app",
    messagingSenderId: "301601692855",
    appId: "1:301601692855:web:47f340ca42a5321e674132",
    measurementId: "G-R2QEVEZGMH"
};

// 取得當前設定
export function getFirebaseConfig() {
    return FIREBASE_CONFIG;
}

// 判斷是否具備有效的 API Key (永遠為 true)
export function isConfigReady() {
    return true;
}

// 執行個體變數
export let app = null;
export let auth = null;
export let db = null;
export let googleProvider = null;

// 初始化 Firebase 實體
export function initFirebase() {
    try {
        if (!getApps().length) {
            app = initializeApp(FIREBASE_CONFIG);
        } else {
            app = getApp();
        }

        auth = getAuth(app);
        db = getFirestore(app);
        googleProvider = new GoogleAuthProvider();
        googleProvider.setCustomParameters({ prompt: 'select_account' });

        return { ready: true, app, auth, db, googleProvider, config: FIREBASE_CONFIG };
    } catch (err) {
        console.error("Firebase 初始化失敗:", err);
        return { ready: false, error: err, config: FIREBASE_CONFIG };
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
