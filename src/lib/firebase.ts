import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBR6hXHteLmIIuAeYyZdbiv6eVZt4CSBrI",
  authDomain: "isr-firebase-3f5f3.firebaseapp.com",
  projectId: "isr-firebase-3f5f3",
  storageBucket: "isr-firebase-3f5f3.appspot.com", // Corrected storage bucket
  messagingSenderId: "829118730970",
  appId: "1:829118730970:web:bb4cbad592fd98a05ecbe3",
  measurementId: "G-K4HXNG30QN"
};


// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);


export { app, auth, db, storage };
