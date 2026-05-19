// ============================================================
// HOOK useEmpresa — Detecta e fornece dados da empresa atual
// Usado em FormPage e AdminPage para isolar dados por tenant
// ============================================================
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getEmpresaBySlug, getConfigEmpresa, PLANOS } from '../firebase'

// Cache em memória para evitar múltiplas leituras ao Firestore
// durante a sessão (slug → dados da empresa)
const cache = {}

export function useEmpresa() {
  const { slug } = useParams()
  const navigate  = useNavigate()

  const [empresa,  setEmpresa]  = useState(null)
  const [config,   setConfig]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [erro,     setErro]     = useState(null)

  useEffect(() => {
    if (!slug) {
      setErro('Slug da empresa não informado na URL.')
      setLoading(false)
      return
    }

    async function buscarEmpresa() {
      setLoading(true)
      setErro(null)

      try {
        // Verifica o cache antes de ir ao Firestore
        if (cache[slug]) {
          setEmpresa(cache[slug].empresa)
          setConfig(cache[slug].config)
          setLoading(false)
          return
        }

        // Busca a empresa pelo slug no Firestore
        const dadosEmpresa = await getEmpresaBySlug(slug)

        if (!dadosEmpresa) {
          // Empresa não encontrada ou inativa → página de erro
          navigate('/empresa-nao-encontrada', { replace: true })
          return
        }

        // Busca as configurações de personalização da empresa
        const dadosConfig = await getConfigEmpresa(dadosEmpresa.id)

        // Salva no cache para evitar re-fetches na mesma sessão
        cache[slug] = { empresa: dadosEmpresa, config: dadosConfig }

        setEmpresa(dadosEmpresa)
        setConfig(dadosConfig)
      } catch (err) {
        console.error('[useEmpresa] Erro ao buscar empresa:', err)
        setErro('Não foi possível carregar os dados da empresa.')
      } finally {
        setLoading(false)
      }
    }

    buscarEmpresa()
  }, [slug, navigate])

  // Plano da empresa com fallback para "basico"
  const plano     = empresa ? (PLANOS[empresa.plano] ?? PLANOS.basico) : null
  const empresaId = empresa?.id ?? null

  // Verifica se a empresa atingiu o limite de OS do plano
  // Recebe a contagem atual de OS do mês como argumento
  function verificarLimite(totalOSdoMes) {
    if (!plano) return { bloqueado: false, aviso: false }

    // -1 significa ilimitado (plano pro ou enterprise)
    if (plano.limiteOS === -1) return { bloqueado: false, aviso: false }

    const percentual = totalOSdoMes / plano.limiteOS
    return {
      bloqueado: totalOSdoMes >= plano.limiteOS,
      aviso:     percentual >= 0.8 && totalOSdoMes < plano.limiteOS,
      restantes: plano.limiteOS - totalOSdoMes,
      limite:    plano.limiteOS,
      total:     totalOSdoMes,
    }
  }

  return {
    empresa,       // dados principais: id, nome, slug, plano, ativo
    config,        // personalização: nome, telefone, seguradoras, logoUrl, corPrimaria
    plano,         // objeto do plano atual com limiteOS e preco
    empresaId,     // atalho para empresa.id
    slug,          // slug lido da URL
    loading,
    erro,
    verificarLimite,
  }
}

// Helper de teste — limpa o cache de módulo entre testes para isolamento correto.
// Uso: importar _clearCacheForTest no beforeEach dos testes de useEmpresa.
// Não usar em código de produção.
export function _clearCacheForTest() {
  Object.keys(cache).forEach(k => delete cache[k])
}
