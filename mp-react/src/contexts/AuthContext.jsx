// ============================================================
// CONTEXTO DE AUTENTICAÇÃO — Firebase Auth multi-tenant
// Envolve toda a aplicação e disponibiliza o usuário logado,
// dados da empresa vinculada e helpers de login/logout
// ============================================================
import { createContext, useContext, useEffect, useState } from 'react'
import {
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  SUPERADMIN_EMAIL,
} from '../firebase'

// ── Criação do contexto ──────────────────────────────────────
const AuthContext = createContext(null)

// ── Provider — envolve o App inteiro em main.jsx ─────────────
export function AuthProvider({ children }) {
  const [usuario,    setUsuario]    = useState(null)   // objeto do Firebase Auth
  const [empresaId,  setEmpresaId]  = useState(null)   // ID da empresa vinculada ao usuário
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loadingAuth,  setLoadingAuth]  = useState(true) // aguarda resolução inicial do Auth

  // Escuta mudanças de estado do Firebase Auth
  // Disparado automaticamente no carregamento e ao logar/deslogar
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUsuario(user)

        // Verifica se é o superadmin pelo e-mail
        if (user.email === SUPERADMIN_EMAIL) {
          setIsSuperAdmin(true)
          setEmpresaId(null)
        } else {
          setIsSuperAdmin(false)

          try {
            // Tentativa primária: empresas/{uid} (por convenção empresaId === uid)
            const snapEmpresa = await getDoc(doc(db, 'empresas', user.uid))
            if (snapEmpresa.exists()) {
              setEmpresaId(user.uid)
            } else {
              // Fallback: usuarios/{uid} → empresaId (compatibilidade com cadastros antigos)
              const snapUsuario = await getDoc(doc(db, 'usuarios', user.uid))
              if (snapUsuario.exists()) {
                setEmpresaId(snapUsuario.data().empresaId ?? null)
              } else {
                setEmpresaId(null)
              }
            }
          } catch (err) {
            console.error('[AuthContext] Erro ao buscar empresaId do usuário:', err)
            setEmpresaId(null)
          }
        }
      } else {
        // Usuário deslogado — limpa todo o estado
        setUsuario(null)
        setEmpresaId(null)
        setIsSuperAdmin(false)
      }

      setLoadingAuth(false)
    })

    // Cancela o listener ao desmontar o Provider
    return () => unsubscribe()
  }, [])

  // ── Login com e-mail e senha ─────────────────────────────
  async function login(email, senha) {
    const credencial = await signInWithEmailAndPassword(auth, email, senha)
    return credencial.user
  }

  // ── Logout ───────────────────────────────────────────────
  async function logout() {
    await signOut(auth)
  }

  // ── Cadastro de novo admin de empresa ───────────────────
  // Cria o usuário no Firebase Auth e retorna o objeto user
  // O cadastro completo da empresa é feito em CadastroPage
  async function cadastrar(email, senha) {
    const credencial = await createUserWithEmailAndPassword(auth, email, senha)
    return credencial.user
  }

  const valor = {
    usuario,
    empresaId,
    isSuperAdmin,
    loadingAuth,
    login,
    logout,
    cadastrar,
    // Atalhos úteis nos componentes
    estaLogado:    !!usuario,
    emailUsuario:  usuario?.email ?? null,
  }

  // Enquanto o Firebase resolve o estado inicial de auth,
  // não renderiza nada para evitar flash de conteúdo protegido
  if (loadingAuth) {
    return (
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        height:         '100vh',
        fontFamily:     'Barlow, sans-serif',
        color:          '#1a3a5c',
        fontSize:       '1rem',
      }}>
        Carregando...
      </div>
    )
  }

  return (
    <AuthContext.Provider value={valor}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook de acesso ao contexto ───────────────────────────────
// Uso: const { usuario, login, logout, isSuperAdmin } = useAuth()
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  }
  return ctx
}
