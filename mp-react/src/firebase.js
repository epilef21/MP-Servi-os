// ============================================================
// CONFIGURAÇÃO DO FIREBASE — MP Serviços v3 (Multi-Tenant)
// ============================================================
import { initializeApp } from 'firebase/app'

// Firestore
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  where,
  limit,
  getCountFromServer,
  arrayUnion,
  onSnapshot,
} from 'firebase/firestore'

// Storage
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage'

// Auth — adicionado para multi-tenant
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'

// ── Validação das variáveis de ambiente ─────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    'Variáveis de ambiente do Firebase não encontradas. ' +
    'Configure VITE_FIREBASE_API_KEY e VITE_FIREBASE_PROJECT_ID no painel da Vercel.'
  )
}

const app = initializeApp(firebaseConfig)

// ── Instâncias dos serviços ──────────────────────────────────
export const db      = getFirestore(app)
export const storage = getStorage(app)
export const auth    = getAuth(app)

// ── Re-exportações do Firestore ──────────────────────────────
export {
  collection, addDoc, getDocs, getDoc, updateDoc, setDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, where, limit, getCountFromServer, arrayUnion,
  storageRef, uploadBytes, getDownloadURL,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged,
}

// ── Definição dos planos disponíveis ────────────────────────
// Usado em cadastro, superadmin e para checar limites
export const PLANOS = {
  basico:     { limiteOS: 50,  preco: 97  },
  pro:        { limiteOS: -1,  preco: 197 }, // -1 = ilimitado
  enterprise: { limiteOS: -1,  preco: 397 },
}

// ── Email do superadmin (hardcoded por segurança) ────────────
// Apenas este usuário acessa /superadmin
export const SUPERADMIN_EMAIL = import.meta.env.VITE_SUPERADMIN_EMAIL || 'tvf23407@gmail.com'

// ============================================================
// QUERIES MULTI-TENANT
// Todas as funções recebem empresaId para isolar os dados
// ============================================================

// Referência à subcoleção de OS de uma empresa
export function refChecklist(empresaId) {
  return collection(db, 'empresas', empresaId, 'checklist')
}

// Referência ao documento de configuração de uma empresa
export function refConfig(empresaId) {
  return doc(db, 'empresas', empresaId, 'config', 'geral')
}

// Referência ao documento principal da empresa
export function refEmpresa(empresaId) {
  return doc(db, 'empresas', empresaId)
}

// Busca empresa pelo slug (identificador único na URL)
export async function getEmpresaBySlug(slug) {
  const q = query(
    collection(db, 'empresas'),
    where('slug', '==', slug),
    where('ativo', '==', true),
    limit(1)
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  const docSnap = snap.docs[0]
  return { id: docSnap.id, ...docSnap.data() }
}

// Busca os dados de config/personalização de uma empresa
export async function getConfigEmpresa(empresaId) {
  const snap = await getDoc(refConfig(empresaId))
  if (!snap.exists()) return {}
  return snap.data()
}

// Lista todas as OS de uma empresa, ordenadas por data de criação
export async function getOSdaEmpresa(empresaId) {
  const q = query(refChecklist(empresaId), orderBy('criado_em', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Escuta OS em tempo real — retorna unsubscribe
export function escutarOSdaEmpresa(empresaId, onData, onError) {
  const q = query(refChecklist(empresaId), orderBy('criado_em', 'desc'))
  return onSnapshot(q, snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onError)
}

// Cria uma nova OS na subcoleção da empresa
export async function criarOS(empresaId, dados) {
  return addDoc(refChecklist(empresaId), {
    ...dados,
    criado_em: serverTimestamp(),
  })
}

// Atualiza campos de uma OS específica
export async function atualizarOS(empresaId, osId, dados) {
  return updateDoc(doc(db, 'empresas', empresaId, 'checklist', osId), dados)
}

// Conta o total de OS de uma empresa no mês atual (para checar limite do plano)
export async function contarOSdoMes(empresaId) {
  const inicio = new Date()
  inicio.setDate(1)
  inicio.setHours(0, 0, 0, 0)

  const q = query(
    refChecklist(empresaId),
    where('criado_em', '>=', inicio)
  )
  const snap = await getCountFromServer(q)
  return snap.data().count
}

// Cria o documento da empresa + config inicial ao cadastrar
export async function cadastrarEmpresa(empresaId, dadosEmpresa, dadosConfig) {
  // Documento principal da empresa
  await setDoc(refEmpresa(empresaId), {
    ...dadosEmpresa,
    ativo: true,
    criadoEm: serverTimestamp(),
  })

  // Documento de configuração com valores padrão
  await setDoc(refConfig(empresaId), {
    nome:        dadosEmpresa.nome,
    telefone:    dadosConfig.telefone || '',
    seguradoras: dadosConfig.seguradoras || ['Tempo', 'Mapfre', 'Maxpar', 'Allianz'],
    logoUrl:     dadosConfig.logoUrl || '',
    corPrimaria: dadosConfig.corPrimaria || '#1a3a5c',
  })
}

// Lista todas as empresas (apenas para o superadmin)
export async function listarTodasEmpresas() {
  const snap = await getDocs(collection(db, 'empresas'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ── Upload helper (mantido, agora com path multi-tenant) ─────
export async function uploadFoto(file, empresaId, osId) {
  const ext  = file.name.split('.').pop()
  const path = `empresas/${empresaId}/fotos/${osId}/${Date.now()}.${ext}`
  const ref  = storageRef(storage, path)
  await uploadBytes(ref, file)
  return getDownloadURL(ref)
}
