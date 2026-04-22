// ============================================================
// CADASTRO DE NOVA EMPRESA — /cadastro
// Cria usuário no Firebase Auth + documentos no Firestore
// ============================================================
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  auth,
  db,
  cadastrarEmpresa,
  PLANOS,
  doc,
  setDoc,
} from '../firebase'
import { useAuth } from '../contexts/AuthContext'

// Gera um slug a partir do nome da empresa
// Ex: "MP Serviços & Cia" → "mp-servicos-cia"
function gerarSlug(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s-]/g, '')   // remove caracteres especiais
    .trim()
    .replace(/\s+/g, '-')            // espaços → hífen
    .replace(/-+/g, '-')             // hífens duplos → simples
    .slice(0, 40)                    // limite de 40 caracteres
}

// Seguradoras padrão que todo tenant começa com
const SEGURADORAS_PADRAO = ['Tempo', 'Mapfre', 'Maxpar', 'Allianz']

export default function CadastroPage() {
  const navigate = useNavigate()
  const { cadastrar } = useAuth()

  const [form, setForm] = useState({
    nome:       '',
    email:      '',
    senha:      '',
    confirma:   '',
    telefone:   '',
    plano:      'basico',
  })

  const [slugPreview, setSlugPreview] = useState('')
  const [erro,        setErro]        = useState('')
  const [loading,     setLoading]     = useState(false)
  const [sucesso,     setSucesso]     = useState(false)

  // Atualiza campo do formulário e recalcula slug ao digitar o nome
  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (name === 'nome') setSlugPreview(gerarSlug(value))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')

    // ── Validações básicas ───────────────────────────────────
    if (!form.nome.trim())     return setErro('Informe o nome da empresa.')
    if (!form.email.trim())    return setErro('Informe o e-mail.')
    if (form.senha.length < 6) return setErro('A senha deve ter pelo menos 6 caracteres.')
    if (form.senha !== form.confirma) return setErro('As senhas não coincidem.')
    if (!slugPreview)          return setErro('Nome da empresa inválido para gerar o link.')

    setLoading(true)

    try {
      // 1. Cria o usuário no Firebase Auth
      const user = await cadastrar(form.email, form.senha)

      // 2. Cria os documentos da empresa no Firestore
      await cadastrarEmpresa(
        user.uid, // empresaId = uid do usuário admin
        {
          nome:  form.nome.trim(),
          email: form.email.trim(),
          plano: form.plano,
          slug:  slugPreview,
        },
        {
          telefone:    form.telefone.trim(),
          seguradoras: SEGURADORAS_PADRAO,
          logoUrl:     '',
          corPrimaria: '#1a3fa8',
        }
      )

      // 3. Cria o documento do usuário para o AuthContext
      // saber qual empresa este uid administra
      await setDoc(doc(db, 'usuarios', user.uid), {
        empresaId: user.uid,
        email:     form.email.trim(),
        nome:      form.nome.trim(),
      })

      setSucesso(true)

      // Redireciona para o painel admin da empresa após 2s
      setTimeout(() => {
        navigate(`/${slugPreview}/admin`, { replace: true })
      }, 2000)

    } catch (err) {
      console.error('[CadastroPage] Erro no cadastro:', err)

      // Traduz erros comuns do Firebase Auth para português
      const mensagens = {
        'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
        'auth/invalid-email':        'E-mail inválido.',
        'auth/weak-password':        'Senha muito fraca. Use pelo menos 6 caracteres.',
      }
      setErro(mensagens[err.code] || 'Erro ao cadastrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // ── Tela de sucesso ──────────────────────────────────────
  if (sucesso) {
    return (
      <div className="login-container">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
          <h2 style={{ color: '#2d8a4e', marginBottom: '0.5rem' }}>Empresa cadastrada!</h2>
          <p style={{ color: '#555' }}>
            Redirecionando para o seu painel...
          </p>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#888' }}>
            Seu link de formulário será:<br />
            <strong>/{slugPreview}</strong>
          </p>
        </div>
      </div>
    )
  }

  // ── Formulário de cadastro ───────────────────────────────
  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '480px' }}>

        {/* Cabeçalho */}
        <div className="login-header">
          <div className="login-icon">
            <img src="/logo.png" height="48" alt="AssistHub" style={{ display: 'block' }} />
          </div>
          <h1 className="login-title">AssistHub</h1>
          <p className="login-subtitle">Cadastre sua empresa no sistema</p>
        </div>

        {erro && (
          <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          {/* Nome da empresa */}
          <div className="form-group">
            <label className="form-label">Nome da empresa *</label>
            <input
              className="form-input"
              type="text"
              name="nome"
              value={form.nome}
              onChange={handleChange}
              placeholder="Ex: AssistHub Serviços"
              required
            />
            {slugPreview && (
              <span style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px', display: 'block' }}>
                Link do formulário: <strong>/{slugPreview}</strong>
              </span>
            )}
          </div>

          {/* E-mail */}
          <div className="form-group">
            <label className="form-label">E-mail do administrador *</label>
            <input
              className="form-input"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="admin@suaempresa.com"
              required
            />
          </div>

          {/* Telefone */}
          <div className="form-group">
            <label className="form-label">Telefone de contato</label>
            <input
              className="form-input"
              type="tel"
              name="telefone"
              value={form.telefone}
              onChange={handleChange}
              placeholder="(11) 99999-9999"
            />
          </div>

          {/* Plano */}
          <div className="form-group">
            <label className="form-label">Plano *</label>
            <select
              className="form-input"
              name="plano"
              value={form.plano}
              onChange={handleChange}
            >
              {Object.entries(PLANOS).map(([chave, info]) => (
                <option key={chave} value={chave}>
                  {chave.charAt(0).toUpperCase() + chave.slice(1)} —{' '}
                  R$ {info.preco}/mês{' '}
                  ({info.limiteOS === -1 ? 'OS ilimitadas' : `até ${info.limiteOS} OS/mês`})
                </option>
              ))}
            </select>
          </div>

          {/* Senha */}
          <div className="form-group">
            <label className="form-label">Senha *</label>
            <input
              className="form-input"
              type="password"
              name="senha"
              value={form.senha}
              onChange={handleChange}
              placeholder="Mínimo 6 caracteres"
              required
            />
          </div>

          {/* Confirmar senha */}
          <div className="form-group">
            <label className="form-label">Confirmar senha *</label>
            <input
              className="form-input"
              type="password"
              name="confirma"
              value={form.confirma}
              onChange={handleChange}
              placeholder="Repita a senha"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: '#666' }}>
          Já tem conta?{' '}
          <Link to="/login" style={{ color: '#1a3fa8', fontWeight: '600' }}>
            Entrar
          </Link>
        </p>

      </div>
    </div>
  )
}
