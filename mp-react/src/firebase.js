// ============================================================
// 🔧 CONFIGURAÇÃO DO FIREBASE — MP Serviços v2
// ============================================================
import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore'
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig)

export const db      = getFirestore(app)
export const storage = getStorage(app)

export {
  collection, addDoc, getDocs, updateDoc,
  doc, serverTimestamp, query, orderBy,
  storageRef, uploadBytes, getDownloadURL,
}

// ── Upload helper ───────────────────────────────────────────
export async function uploadFoto(file, osId) {
  const ext  = file.name.split('.').pop()
  const path = `fotos/${osId}/${Date.now()}.${ext}`
  const ref  = storageRef(storage, path)
  await uploadBytes(ref, file)
  return await getDownloadURL(ref)
}
