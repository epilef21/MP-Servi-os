// ============================================================
// FINANCEIRO DA EMPRESA — DRE completo com deduções,
// resultado financeiro e despesas agrupadas por categoria
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import {
  db,
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from '../../firebase.js'
import { useAdminContext } from '../../contexts/AdminContext.jsx'
import { fmtBRL } from '../../utils/formatters.js'
import { dataVencimentoDoMes, statusDespesa, diasParaVencer, resumoAlertas } from '../../utils/contasPagar.js'
import { gerarDrePdf } from '../../utils/drePdf.js'
import { estaFechado, formatarFechadoEm } from '../../utils/fechamentoMes.js'
import AbaFaturamento from './faturamento/AbaFaturamento.jsx'
import AbaFechamentoTecnicos from './fechamento/AbaFechamentoTecnicos.jsx'
import AbaCaixa from './caixa/AbaCaixa.jsx'

const MESES_NOMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

function fmtMes(mesRef) {
  const [ano, mes] = mesRef.split('-').map(Number)
  return `${MESES_NOMES[mes - 1]} de ${ano}`
}

function mesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function navegarMes(mesRef, delta) {
  const [ano, mes] = mesRef.split('-').map(Number)
  const d = new Date(ano, mes - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Mapeamento de categorias (inclui legados) ────────────────
const LABEL_CATEGORIA = {
  // Novos
  salario_funcionario: 'Salário de Funcionário',
  pro_labore_socio:    'Pró-labore de Sócio',
  aluguel:             'Aluguel',
  agua_luz:            'Água e Luz',
  internet:            'Internet',
  contabilidade:       'Contabilidade',
  // Mantidos (dados antigos)
  salario:   'Salários',
  estrutura: 'Estrutura / Escritório',
  material:  'Material',
  outro:     'Outros',
}

// Grupos de despesa para DRE e lista
const GRUPOS_DESPESA = {
  pessoal: {
    label: '👤 Pessoal',
    cls: 'pessoal',
    cats: ['salario_funcionario', 'pro_labore_socio', 'salario'],
  },
  estrutura: {
    label: '🏢 Estrutura',
    cls: 'estrutura',
    cats: ['aluguel', 'agua_luz', 'internet', 'estrutura'],
  },
  administrativo: {
    label: '📋 Administrativo',
    cls: 'administrativo',
    cats: ['contabilidade', 'material', 'outro'],
  },
}

// ── Estados iniciais dos modais ──────────────────────────────
const FORM_DESP_RECORRENTE_INICIAL = {
  descricao: '', categoria: 'outro', valor: '', tipo: 'fixa', dia_vencimento: '',
}
const FORM_DESP_MENSAL_INICIAL = {
  descricao: '', categoria: 'outro', valor: '',
  despesa_recorrente_id: '', data_pagamento: '', data_vencimento: '',
}
const FORM_PARTICULAR_INICIAL = {
  descricao: '', cliente: '', valor_recebido: '', valor_custo: '',
  data: '', observacoes: '',
}
const FORM_DEDUCAO_INICIAL = {
  descricao: '', categoria: 'iss', valor: '', observacoes: '',
}
const FORM_RESULT_FIN_INICIAL = {
  tipo: 'despesa', categoria: 'taxa_bancaria', descricao: '', valor: '',
}

// ── Componente principal ─────────────────────────────────────
export default function FinanceiroEmpresaTab() {
  const { empresaId, reports, nomeEmpresa, showToast } = useAdminContext()

  const [mesRef, setMesRef] = useState(mesAtual)
  const [abaFin, setAbaFin] = useState('dre')
  const [carregando, setCarregando] = useState(false)

  // ── Dados do Firestore ──────────────────────────────────
  const [despesasRecorrentes, setDespesasRecorrentes] = useState([])
  const [despesasMensais,     setDespesasMensais]     = useState([])
  const [particulares,        setParticulares]        = useState([])
  const [deducoes,            setDeducoes]            = useState([])
  const [resultFinanceiro,    setResultFinanceiro]    = useState([])

  // ── Fechamento do mês (EXP-02: trava lançamentos do mês selecionado) ──
  const [fechamentoMes, setFechamentoMes] = useState(null)
  const mesFechado = estaFechado(fechamentoMes)

  // ── Estados dos modais ──────────────────────────────────
  const [showModalRecorrente, setShowModalRecorrente] = useState(false)
  const [editandoRecorrente,  setEditandoRecorrente]  = useState(null)
  const [formRecorrente,      setFormRecorrente]      = useState(FORM_DESP_RECORRENTE_INICIAL)
  const [salvandoRecorrente,  setSalvandoRecorrente]  = useState(false)

  const [showModalMensal, setShowModalMensal] = useState(false)
  const [editandoMensal,  setEditandoMensal]  = useState(null)
  const [formMensal,      setFormMensal]      = useState(FORM_DESP_MENSAL_INICIAL)
  const [salvandoMensal,  setSalvandoMensal]  = useState(false)

  const [showModalParticular, setShowModalParticular] = useState(false)
  const [editandoParticular,  setEditandoParticular]  = useState(null)
  const [formParticular,      setFormParticular]      = useState(FORM_PARTICULAR_INICIAL)
  const [salvandoParticular,  setSalvandoParticular]  = useState(false)

  const [showModalDeducao, setShowModalDeducao] = useState(false)
  const [editandoDeducao,  setEditandoDeducao]  = useState(null)
  const [formDeducao,      setFormDeducao]      = useState(FORM_DEDUCAO_INICIAL)
  const [salvandoDeducao,  setSalvandoDeducao]  = useState(false)

  const [showModalResultFin, setShowModalResultFin] = useState(false)
  const [editandoResultFin,  setEditandoResultFin]  = useState(null)
  const [formResultFin,      setFormResultFin]      = useState(FORM_RESULT_FIN_INICIAL)
  const [salvandoResultFin,  setSalvandoResultFin]  = useState(false)

  const [showAutoLancar, setShowAutoLancar] = useState(false)
  const [autoLancando,   setAutoLancando]   = useState(false)

  // ── Carrega todos os dados do mês ───────────────────────
  const carregarDados = useCallback(async () => {
    if (!empresaId) return
    setCarregando(true)
    try {
      // Despesas recorrentes (cadastro permanente, só orderBy)
      const recSnap = await getDocs(
        query(collection(db, `empresas/${empresaId}/despesasRecorrentes`), orderBy('criado_em', 'asc'))
      )
      const recorrentes = recSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setDespesasRecorrentes(recorrentes)

      // Lançamentos de despesas do mês
      const mensSnap = await getDocs(
        query(collection(db, `empresas/${empresaId}/despesasMensais`), where('mes_referencia', '==', mesRef))
      )
      const mensais = mensSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setDespesasMensais(mensais)

      // Banner auto-lançamento de fixas
      const temFixas = recorrentes.filter(r => r.tipo === 'fixa' && r.ativa !== false).length > 0
      setShowAutoLancar(mensais.length === 0 && temFixas)

      // Serviços particulares do mês
      const partSnap = await getDocs(
        query(collection(db, `empresas/${empresaId}/servicosParticulares`), where('mes_referencia', '==', mesRef))
      )
      setParticulares(partSnap.docs.map(d => ({ id: d.id, ...d.data() })))

      // Deduções da receita (impostos) do mês
      const dedSnap = await getDocs(
        query(collection(db, `empresas/${empresaId}/deducoesMensais`), where('mes_referencia', '==', mesRef))
      )
      setDeducoes(dedSnap.docs.map(d => ({ id: d.id, ...d.data() })))

      // Resultado financeiro do mês
      const rfSnap = await getDocs(
        query(collection(db, `empresas/${empresaId}/resultadoFinanceiroMensal`), where('mes_referencia', '==', mesRef))
      )
      setResultFinanceiro(rfSnap.docs.map(d => ({ id: d.id, ...d.data() })))

      // Estado de fechamento do mês selecionado (EXP-02)
      const fmSnap = await getDoc(doc(db, `empresas/${empresaId}/fechamentosMes/${mesRef}`))
      setFechamentoMes(fmSnap.exists() ? fmSnap.data() : null)

    } catch (e) {
      console.error('Erro ao carregar financeiro:', e)
      showToast('Erro ao carregar dados financeiros: ' + e.message, 'error')
    } finally {
      setCarregando(false)
    }
  }, [empresaId, mesRef])

  useEffect(() => { carregarDados() }, [carregarDados])

  // ── Fechar/Reabrir mês (EXP-02) ──────────────────────────
  // Enforcement client-side (risco aceito, single-admin — T-11-04); grava
  // fechado_em/reaberto_em via serverTimestamp para trilha de auditoria (T-11-05).
  async function fecharMes() {
    if (!window.confirm(`Fechar ${fmtMes(mesRef)}? Os lançamentos ficam protegidos contra alteração.`)) return
    try {
      await setDoc(doc(db, `empresas/${empresaId}/fechamentosMes/${mesRef}`), {
        fechado: true,
        fechado_em: serverTimestamp(),
      })
      await carregarDados()
    } catch (e) { showToast('Erro ao fechar o mês: ' + e.message, 'error') }
  }
  async function reabrirMes() {
    if (!window.confirm(`Reabrir ${fmtMes(mesRef)} para editar?`)) return
    try {
      await setDoc(doc(db, `empresas/${empresaId}/fechamentosMes/${mesRef}`), {
        fechado: false,
        reaberto_em: serverTimestamp(),
      }, { merge: true })
      await carregarDados()
    } catch (e) { showToast('Erro ao reabrir o mês: ' + e.message, 'error') }
  }

  // ── DRE calculado em memória ─────────────────────────────
  const dre = calcularDRE(reports, mesRef, particulares, despesasMensais, deducoes, resultFinanceiro)

  // ── Alertas de contas a pagar (mês corrente já carregado) ─
  const alertas = resumoAlertas(despesasMensais, hojeISO())

  // ── Despesas variáveis pendentes ─────────────────────────
  const pendentes = despesasRecorrentes.filter(r =>
    r.tipo === 'variavel' &&
    r.ativa !== false &&
    !despesasMensais.some(l => l.despesa_recorrente_id === r.id)
  )

  // ── Auto-lançamento de fixas ─────────────────────────────
  async function autoLancarFixas() {
    if (mesFechado) { showToast('Mês fechado — reabra para alterar.', 'error'); return }
    setAutoLancando(true)
    try {
      const fixas = despesasRecorrentes.filter(r => r.tipo === 'fixa' && r.ativa !== false)
      for (const f of fixas) {
        await addDoc(collection(db, `empresas/${empresaId}/despesasMensais`), {
          despesa_recorrente_id: f.id,
          descricao:      f.descricao,
          categoria:      f.categoria,
          valor:          f.valor || 0,
          mes_referencia: mesRef,
          data_pagamento: '',
          data_vencimento: f.dia_vencimento ? (dataVencimentoDoMes(f.dia_vencimento, mesRef) || '') : '',
          criado_em:      serverTimestamp(),
        })
      }
      setShowAutoLancar(false)
      await carregarDados()
    } catch (e) {
      showToast('Erro ao lançar fixas: ' + e.message, 'error')
    } finally {
      setAutoLancando(false)
    }
  }

  // ── CRUD Despesa Recorrente ──────────────────────────────
  function abrirNovaRecorrente() {
    setEditandoRecorrente(null)
    setFormRecorrente(FORM_DESP_RECORRENTE_INICIAL)
    setShowModalRecorrente(true)
  }
  function abrirEditarRecorrente(r) {
    setEditandoRecorrente(r)
    setFormRecorrente({
      descricao: r.descricao,
      categoria: r.categoria,
      valor: String(r.valor || ''),
      tipo: r.tipo,
      dia_vencimento: r.dia_vencimento ? String(r.dia_vencimento) : '',
    })
    setShowModalRecorrente(true)
  }
  async function salvarRecorrente() {
    if (mesFechado) { showToast('Mês fechado — reabra para alterar.', 'error'); return }
    if (!formRecorrente.descricao.trim()) { showToast('Informe a descrição.', 'error'); return }
    setSalvandoRecorrente(true)
    try {
      const payload = {
        descricao: formRecorrente.descricao.trim(),
        categoria: formRecorrente.categoria,
        valor:     parseFloat(formRecorrente.valor) || 0,
        tipo:      formRecorrente.tipo,
        ativa:     true,
        dia_vencimento: formRecorrente.dia_vencimento ? Number(formRecorrente.dia_vencimento) : null,
      }
      if (editandoRecorrente) {
        await updateDoc(doc(db, `empresas/${empresaId}/despesasRecorrentes`, editandoRecorrente.id), payload)
      } else {
        await addDoc(collection(db, `empresas/${empresaId}/despesasRecorrentes`), { ...payload, criado_em: serverTimestamp() })
      }
      setShowModalRecorrente(false)
      await carregarDados()
    } catch (e) { showToast('Erro ao salvar: ' + e.message, 'error') }
    finally { setSalvandoRecorrente(false) }
  }
  async function excluirRecorrente(r) {
    if (mesFechado) { showToast('Mês fechado — reabra para alterar.', 'error'); return }
    if (!window.confirm(`Excluir "${r.descricao}"?\nLançamentos existentes não serão removidos.`)) return
    try {
      await deleteDoc(doc(db, `empresas/${empresaId}/despesasRecorrentes`, r.id))
      await carregarDados()
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
  }

  // ── CRUD Lançamento Mensal ───────────────────────────────
  function abrirNovoMensal(recorrente = null) {
    setEditandoMensal(null)
    setFormMensal({
      ...FORM_DESP_MENSAL_INICIAL,
      descricao:             recorrente?.descricao || '',
      categoria:             recorrente?.categoria || 'outro',
      valor:                 recorrente ? String(recorrente.valor || '') : '',
      despesa_recorrente_id: recorrente?.id || '',
    })
    setShowModalMensal(true)
  }
  function abrirEditarMensal(l) {
    setEditandoMensal(l)
    setFormMensal({
      descricao:             l.descricao,
      categoria:             l.categoria,
      valor:                 String(l.valor || ''),
      despesa_recorrente_id: l.despesa_recorrente_id || '',
      data_pagamento:        l.data_pagamento || '',
      data_vencimento:       l.data_vencimento || '',
    })
    setShowModalMensal(true)
  }
  async function salvarMensal() {
    if (mesFechado) { showToast('Mês fechado — reabra para alterar.', 'error'); return }
    if (!formMensal.descricao.trim()) { showToast('Informe a descrição.', 'error'); return }
    setSalvandoMensal(true)
    try {
      const payload = {
        descricao:             formMensal.descricao.trim(),
        categoria:             formMensal.categoria,
        valor:                 parseFloat(formMensal.valor) || 0,
        mes_referencia:        mesRef,
        data_pagamento:        formMensal.data_pagamento || '',
        data_vencimento:       formMensal.data_vencimento || '',
        despesa_recorrente_id: formMensal.despesa_recorrente_id || '',
      }
      if (editandoMensal) {
        await updateDoc(doc(db, `empresas/${empresaId}/despesasMensais`, editandoMensal.id), payload)
      } else {
        await addDoc(collection(db, `empresas/${empresaId}/despesasMensais`), { ...payload, criado_em: serverTimestamp() })
      }
      setShowModalMensal(false)
      await carregarDados()
    } catch (e) { showToast('Erro ao salvar: ' + e.message, 'error') }
    finally { setSalvandoMensal(false) }
  }
  async function excluirMensal(l) {
    if (mesFechado) { showToast('Mês fechado — reabra para alterar.', 'error'); return }
    if (!window.confirm(`Excluir lançamento "${l.descricao}"?`)) return
    try {
      await deleteDoc(doc(db, `empresas/${empresaId}/despesasMensais`, l.id))
      await carregarDados()
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
  }
  async function pagarMensal(l) {
    if (mesFechado) { showToast('Mês fechado — reabra para alterar.', 'error'); return }
    if (!window.confirm(`Marcar "${l.descricao}" como paga hoje?`)) return
    try {
      await updateDoc(doc(db, `empresas/${empresaId}/despesasMensais`, l.id), { data_pagamento: hojeISO() })
      await carregarDados()
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
  }

  // ── CRUD Serviços Particulares ───────────────────────────
  function abrirNovoParticular() {
    setEditandoParticular(null)
    setFormParticular({ ...FORM_PARTICULAR_INICIAL })
    setShowModalParticular(true)
  }
  function abrirEditarParticular(p) {
    setEditandoParticular(p)
    setFormParticular({
      descricao:      p.descricao,
      cliente:        p.cliente || '',
      valor_recebido: String(p.valor_recebido || ''),
      valor_custo:    String(p.valor_custo    || ''),
      data:           p.data || '',
      observacoes:    p.observacoes || '',
    })
    setShowModalParticular(true)
  }
  async function salvarParticular() {
    if (mesFechado) { showToast('Mês fechado — reabra para alterar.', 'error'); return }
    if (!formParticular.descricao.trim()) { showToast('Informe a descrição.', 'error'); return }
    setSalvandoParticular(true)
    try {
      const rec   = parseFloat(formParticular.valor_recebido) || 0
      const custo = parseFloat(formParticular.valor_custo)    || 0
      const payload = {
        descricao:      formParticular.descricao.trim(),
        cliente:        formParticular.cliente.trim(),
        valor_recebido: rec,
        valor_custo:    custo,
        lucro:          rec - custo,
        mes_referencia: mesRef,
        data:           formParticular.data || '',
        observacoes:    formParticular.observacoes || '',
      }
      if (editandoParticular) {
        await updateDoc(doc(db, `empresas/${empresaId}/servicosParticulares`, editandoParticular.id), payload)
      } else {
        await addDoc(collection(db, `empresas/${empresaId}/servicosParticulares`), { ...payload, criado_em: serverTimestamp() })
      }
      setShowModalParticular(false)
      await carregarDados()
    } catch (e) { showToast('Erro ao salvar: ' + e.message, 'error') }
    finally { setSalvandoParticular(false) }
  }
  async function excluirParticular(p) {
    if (mesFechado) { showToast('Mês fechado — reabra para alterar.', 'error'); return }
    if (!window.confirm(`Excluir "${p.descricao}"?`)) return
    try {
      await deleteDoc(doc(db, `empresas/${empresaId}/servicosParticulares`, p.id))
      await carregarDados()
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
  }

  // ── CRUD Deduções (impostos) ─────────────────────────────
  function abrirNovaDeducao() {
    setEditandoDeducao(null)
    setFormDeducao(FORM_DEDUCAO_INICIAL)
    setShowModalDeducao(true)
  }
  function abrirEditarDeducao(d) {
    setEditandoDeducao(d)
    setFormDeducao({ descricao: d.descricao, categoria: d.categoria, valor: String(d.valor || ''), observacoes: d.observacoes || '' })
    setShowModalDeducao(true)
  }
  async function salvarDeducao() {
    if (mesFechado) { showToast('Mês fechado — reabra para alterar.', 'error'); return }
    if (!formDeducao.descricao.trim()) { showToast('Informe a descrição.', 'error'); return }
    if (!formDeducao.valor)            { showToast('Informe o valor.', 'error'); return }
    setSalvandoDeducao(true)
    try {
      const payload = {
        descricao:      formDeducao.descricao.trim(),
        categoria:      formDeducao.categoria,
        valor:          parseFloat(formDeducao.valor) || 0,
        mes_referencia: mesRef,
        observacoes:    formDeducao.observacoes || '',
      }
      if (editandoDeducao) {
        await updateDoc(doc(db, `empresas/${empresaId}/deducoesMensais`, editandoDeducao.id), payload)
      } else {
        await addDoc(collection(db, `empresas/${empresaId}/deducoesMensais`), { ...payload, criado_em: serverTimestamp() })
      }
      setShowModalDeducao(false)
      await carregarDados()
    } catch (e) { showToast('Erro ao salvar: ' + e.message, 'error') }
    finally { setSalvandoDeducao(false) }
  }
  async function excluirDeducao(d) {
    if (mesFechado) { showToast('Mês fechado — reabra para alterar.', 'error'); return }
    if (!window.confirm(`Excluir "${d.descricao}"?`)) return
    try {
      await deleteDoc(doc(db, `empresas/${empresaId}/deducoesMensais`, d.id))
      await carregarDados()
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
  }

  // ── CRUD Resultado Financeiro ────────────────────────────
  function abrirNovoResultFin() {
    setEditandoResultFin(null)
    setFormResultFin(FORM_RESULT_FIN_INICIAL)
    setShowModalResultFin(true)
  }
  function abrirEditarResultFin(f) {
    setEditandoResultFin(f)
    setFormResultFin({ tipo: f.tipo, categoria: f.categoria, descricao: f.descricao, valor: String(f.valor || '') })
    setShowModalResultFin(true)
  }
  async function salvarResultFin() {
    if (mesFechado) { showToast('Mês fechado — reabra para alterar.', 'error'); return }
    if (!formResultFin.descricao.trim()) { showToast('Informe a descrição.', 'error'); return }
    if (!formResultFin.valor)            { showToast('Informe o valor.', 'error'); return }
    setSalvandoResultFin(true)
    try {
      const payload = {
        tipo:           formResultFin.tipo,
        categoria:      formResultFin.categoria,
        descricao:      formResultFin.descricao.trim(),
        valor:          parseFloat(formResultFin.valor) || 0,
        mes_referencia: mesRef,
      }
      if (editandoResultFin) {
        await updateDoc(doc(db, `empresas/${empresaId}/resultadoFinanceiroMensal`, editandoResultFin.id), payload)
      } else {
        await addDoc(collection(db, `empresas/${empresaId}/resultadoFinanceiroMensal`), { ...payload, criado_em: serverTimestamp() })
      }
      setShowModalResultFin(false)
      await carregarDados()
    } catch (e) { showToast('Erro ao salvar: ' + e.message, 'error') }
    finally { setSalvandoResultFin(false) }
  }
  async function excluirResultFin(f) {
    if (mesFechado) { showToast('Mês fechado — reabra para alterar.', 'error'); return }
    if (!window.confirm(`Excluir "${f.descricao}"?`)) return
    try {
      await deleteDoc(doc(db, `empresas/${empresaId}/resultadoFinanceiroMensal`, f.id))
      await carregarDados()
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="tab-content">

      {/* Cabeçalho + seletor de período */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: 4 }}>{nomeEmpresa}</div>
        <div className="fin-periodo">
          <button className="fin-periodo-btn" onClick={() => setMesRef(m => navegarMes(m, -1))}>◄</button>
          <span className="fin-periodo-label">{fmtMes(mesRef)}</span>
          <button className="fin-periodo-btn" onClick={() => setMesRef(m => navegarMes(m, +1))}>►</button>
          {mesFechado ? (
            <button className="fin-periodo-btn fin-cadeado-btn fechado" onClick={reabrirMes}>🔓 Reabrir mês</button>
          ) : (
            <button className="fin-periodo-btn fin-cadeado-btn" onClick={fecharMes}>🔒 Fechar mês</button>
          )}
        </div>
      </div>

      {mesFechado && (
        <div className="fin-banner-fechado">
          🔒 Mês fechado em {formatarFechadoEm(fechamentoMes?.fechado_em)} — reabra para alterar.
        </div>
      )}

      {!carregando && alertas.total > 0 && (
        <div className="fin-alerta-contas">
          <span>
            🔔 {[
              alertas.aVencer > 0 ? `${alertas.aVencer} conta${alertas.aVencer > 1 ? 's' : ''} vence${alertas.aVencer > 1 ? 'm' : ''} esta semana` : null,
              alertas.atrasadas > 0 ? `${alertas.atrasadas} atrasada${alertas.atrasadas > 1 ? 's' : ''}` : null,
            ].filter(Boolean).join(' · ')}
          </span>
          <button className="btn-sm btn-view" onClick={() => setAbaFin('despesas')}>Ver despesas</button>
        </div>
      )}

      {/* Abas internas */}
      <div className="fin-tabs">
        {[
          { id: 'dre',          label: '📈 DRE Mensal'         },
          { id: 'despesas',     label: '💸 Despesas'            },
          { id: 'particulares', label: '🎨 Serv. Particulares'  },
          { id: 'impostos',     label: '🧾 Impostos e Fin.'     },
          { id: 'faturamento',  label: '📄 Faturamento'         },
          { id: 'tecnicos',     label: '👷 Técnicos'             },
          { id: 'caixa',        label: '💵 Caixa'                },
        ].map(t => (
          <button
            key={t.id}
            className={`fin-tab${abaFin === t.id ? ' active' : ''}`}
            onClick={() => setAbaFin(t.id)}
          >{t.label}</button>
        ))}
      </div>

      {carregando && (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Carregando...
        </div>
      )}

      {!carregando && abaFin === 'dre' && (
        <AbaDRE
          dre={dre}
          onIrImpostos={() => setAbaFin('impostos')}
          mesRef={mesRef}
          nomeEmpresa={nomeEmpresa}
        />
      )}

      {!carregando && abaFin === 'despesas' && (
        <AbaDespesas
          despesasRecorrentes={despesasRecorrentes}
          despesasMensais={despesasMensais}
          pendentes={pendentes}
          mesRef={mesRef}
          mesFechado={mesFechado}
          showAutoLancar={showAutoLancar}
          autoLancando={autoLancando}
          onAutoLancar={autoLancarFixas}
          onDismissAuto={() => setShowAutoLancar(false)}
          onNovaRecorrente={abrirNovaRecorrente}
          onEditarRecorrente={abrirEditarRecorrente}
          onExcluirRecorrente={excluirRecorrente}
          onNovoMensal={abrirNovoMensal}
          onEditarMensal={abrirEditarMensal}
          onExcluirMensal={excluirMensal}
          onPagarMensal={pagarMensal}
        />
      )}

      {!carregando && abaFin === 'particulares' && (
        <AbaParticulares
          particulares={particulares}
          mesFechado={mesFechado}
          onNovo={abrirNovoParticular}
          onEditar={abrirEditarParticular}
          onExcluir={excluirParticular}
        />
      )}

      {!carregando && abaFin === 'impostos' && (
        <AbaImpostosFinanceiro
          deducoes={deducoes}
          resultFinanceiro={resultFinanceiro}
          mesRef={mesRef}
          mesFechado={mesFechado}
          onNovaDeducao={abrirNovaDeducao}
          onEditarDeducao={abrirEditarDeducao}
          onExcluirDeducao={excluirDeducao}
          onNovoResultFin={abrirNovoResultFin}
          onEditarResultFin={abrirEditarResultFin}
          onExcluirResultFin={excluirResultFin}
        />
      )}

      {/* Faturamento NÃO é bloqueado pelo fechamento do mês: a nota é emitida
          por seguradora (calendário próprio), não por mês de competência —
          por isso não recebe a prop mesFechado (EXP-02). */}
      {!carregando && abaFin === 'faturamento' && <AbaFaturamento />}

      {!carregando && abaFin === 'tecnicos' && <AbaFechamentoTecnicos mesRef={mesRef} mesFechado={mesFechado} />}

      {!carregando && abaFin === 'caixa' && <AbaCaixa mesRef={mesRef} />}

      {/* ══ MODAIS ══ */}

      {showModalRecorrente && (
        <ModalDespesaRecorrente
          form={formRecorrente} setForm={setFormRecorrente}
          salvando={salvandoRecorrente} editando={!!editandoRecorrente}
          onSalvar={salvarRecorrente} onFechar={() => setShowModalRecorrente(false)}
        />
      )}

      {showModalMensal && (
        <ModalLancamentoMensal
          form={formMensal} setForm={setFormMensal}
          salvando={salvandoMensal} editando={!!editandoMensal}
          mesRef={mesRef}
          onSalvar={salvarMensal} onFechar={() => setShowModalMensal(false)}
        />
      )}

      {showModalParticular && (
        <ModalServicoParticular
          form={formParticular} setForm={setFormParticular}
          salvando={salvandoParticular} editando={!!editandoParticular}
          onSalvar={salvarParticular} onFechar={() => setShowModalParticular(false)}
        />
      )}

      {showModalDeducao && (
        <ModalDeducao
          form={formDeducao} setForm={setFormDeducao}
          salvando={salvandoDeducao} editando={!!editandoDeducao}
          mesRef={mesRef}
          onSalvar={salvarDeducao} onFechar={() => setShowModalDeducao(false)}
        />
      )}

      {showModalResultFin && (
        <ModalResultFinanceiro
          form={formResultFin} setForm={setFormResultFin}
          salvando={salvandoResultFin} editando={!!editandoResultFin}
          mesRef={mesRef}
          onSalvar={salvarResultFin} onFechar={() => setShowModalResultFin(false)}
        />
      )}
    </div>
  )
}

// ── Cálculo do DRE em cascata ────────────────────────────────
function calcularDRE(reports, mesRef, particulares, despesasMensais, deducoes, resultFinanceiro) {
  // OS do mês
  const osDoMes = reports.filter(r => {
    try {
      const d = r.criado_em?.toDate?.()
      return d && d.toISOString().slice(0, 7) === mesRef
    } catch { return false }
  })

  // Receita bruta
  const receitaOS = osDoMes.reduce((acc, r) =>
    acc +
    (parseFloat(r.mo_seguradora)              || 0) +
    (parseFloat(r.valor_deslocamento)          || 0) +
    (parseFloat(r.material_cobrado_seguradora) || 0)
  , 0)

  const custoTecnicos = osDoMes.reduce((acc, r) => acc + (parseFloat(r.valor_prestador)   || 0), 0)
  const custoMaterial = osDoMes.reduce((acc, r) => acc + (parseFloat(r.material_custo_real) || 0), 0)
  const margemMaterial = osDoMes.reduce((acc, r) => acc + (parseFloat(r.margem_material)   || 0), 0)

  const receitaParticulares = particulares.reduce((acc, p) => acc + (parseFloat(p.valor_recebido) || 0), 0)
  const custoParticulares   = particulares.reduce((acc, p) => acc + (parseFloat(p.valor_custo)    || 0), 0)

  const receitaTotal = receitaOS + receitaParticulares

  // Deduções (impostos)
  const totalDeducoes = (deducoes || []).reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0)
  const receitaLiquida = receitaTotal - totalDeducoes

  // Custos variáveis
  const custoVariavelTotal = custoTecnicos + custoMaterial + custoParticulares
  const lucroBruto = receitaLiquida - custoVariavelTotal

  // Resultado financeiro
  const rf = resultFinanceiro || []
  const despesasFin = rf.filter(f => f.tipo === 'despesa').reduce((acc, f) => acc + (parseFloat(f.valor) || 0), 0)
  const receitasFin = rf.filter(f => f.tipo === 'receita').reduce((acc, f) => acc + (parseFloat(f.valor) || 0), 0)
  const saldoFinanceiro = receitasFin - despesasFin

  // Despesas fixas agrupadas por grupo
  const totalDespesas = despesasMensais.reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0)

  const despesasPorGrupo = {}
  for (const [grupo, cfg] of Object.entries(GRUPOS_DESPESA)) {
    const itens = despesasMensais.filter(d => cfg.cats.includes(d.categoria))
    if (itens.length > 0) {
      despesasPorGrupo[grupo] = {
        label: cfg.label,
        itens: itens,
        subtotal: itens.reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0),
      }
    }
  }

  // Cascata final
  const lucroLiquido  = lucroBruto + saldoFinanceiro - totalDespesas
  const margemLiquida = receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : 0

  return {
    qtdOS: osDoMes.length,
    receitaOS, receitaParticulares, margemMaterial,
    receitaTotal,
    deducoes: deducoes || [],
    totalDeducoes,
    receitaLiquida,
    custoTecnicos, custoMaterial, custoParticulares,
    custoVariavelTotal,
    lucroBruto,
    despesasFin, receitasFin, saldoFinanceiro,
    resultFinanceiro: rf,
    despesasPorGrupo,
    totalDespesas,
    lucroLiquido,
    margemLiquida,
  }
}

// ── ABA DRE ─────────────────────────────────────────────────
function AbaDRE({ dre, onIrImpostos, mesRef, nomeEmpresa }) {
  const semDados = dre.qtdOS === 0 && dre.receitaParticulares === 0
  return (
    <div>
      {semDados && (
        <div className="empty-state" style={{ marginBottom: 20 }}>
          <div className="e-icon">📊</div>
          <p>Nenhuma OS ou serviço particular neste mês ainda.</p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          className="btn-primary"
          disabled={semDados}
          onClick={() => gerarDrePdf(dre, mesRef, nomeEmpresa)}
        >
          ⬇️ Baixar DRE em PDF
        </button>
      </div>

      <div className="dre-container">

        {/* ── RECEITA BRUTA ── */}
        <div className="dre-secao-titulo">(+) Receita Bruta</div>
        <div className="dre-linha">
          <span>OS Seguradoras ({dre.qtdOS} OS)</span>
          <span className="dre-valor-positivo">{fmtBRL(dre.receitaOS)}</span>
        </div>
        <div className="dre-linha">
          <span>Serviços Particulares</span>
          <span className="dre-valor-positivo">{fmtBRL(dre.receitaParticulares)}</span>
        </div>
        {dre.margemMaterial !== 0 && (
          <div className="dre-linha">
            <span>Margem em Material</span>
            <span className={dre.margemMaterial >= 0 ? 'dre-valor-positivo' : 'dre-valor-negativo'}>
              {fmtBRL(dre.margemMaterial)}
            </span>
          </div>
        )}
        <div className="dre-linha subtotal">
          <span>TOTAL RECEITA BRUTA</span>
          <span>{fmtBRL(dre.receitaTotal)}</span>
        </div>

        {/* ── DEDUÇÕES DA RECEITA ── */}
        <div className="dre-secao-titulo">(-) Deduções da Receita Bruta</div>
        {dre.deducoes.length === 0 ? (
          <div className="dre-aviso-vazio">
            <span>⚠️ Nenhum imposto lançado este mês. A Receita Líquida está igual à Receita Bruta.</span>
            <button className="btn-sm btn-view" onClick={onIrImpostos}>Lançar imposto</button>
          </div>
        ) : (
          dre.deducoes.map((d, i) => (
            <div className="dre-linha" key={i}>
              <span>{d.descricao}</span>
              <span className="dre-valor-negativo">{fmtBRL(d.valor)}</span>
            </div>
          ))
        )}
        <div className="dre-linha subtotal">
          <span>TOTAL DEDUÇÕES</span>
          <span className="dre-valor-negativo">{fmtBRL(dre.totalDeducoes)}</span>
        </div>

        {/* ── RECEITA LÍQUIDA ── */}
        <div className={`dre-linha resultado${dre.receitaLiquida < 0 ? ' negativo' : ''}`}>
          <span>(=) RECEITA LÍQUIDA</span>
          <span>{fmtBRL(dre.receitaLiquida)}</span>
        </div>

        {/* ── CUSTOS VARIÁVEIS ── */}
        <div className="dre-secao-titulo">(-) Custos Variáveis</div>
        <div className="dre-linha">
          <span>Pagamento Técnicos</span>
          <span className="dre-valor-negativo">{fmtBRL(dre.custoTecnicos)}</span>
        </div>
        <div className="dre-linha">
          <span>Custo Material Real</span>
          <span className="dre-valor-negativo">{fmtBRL(dre.custoMaterial)}</span>
        </div>
        {dre.custoParticulares > 0 && (
          <div className="dre-linha">
            <span>Custo Serviços Particulares</span>
            <span className="dre-valor-negativo">{fmtBRL(dre.custoParticulares)}</span>
          </div>
        )}
        <div className="dre-linha subtotal">
          <span>TOTAL CUSTOS VARIÁVEIS</span>
          <span>{fmtBRL(dre.custoVariavelTotal)}</span>
        </div>

        {/* ── LUCRO BRUTO ── */}
        <div className={`dre-linha resultado${dre.lucroBruto < 0 ? ' negativo' : ''}`}>
          <span>(=) LUCRO BRUTO</span>
          <span>{fmtBRL(dre.lucroBruto)}</span>
        </div>

        {/* ── RESULTADO FINANCEIRO ── */}
        <div className="dre-secao-titulo">(+/-) Resultado Financeiro</div>
        {dre.resultFinanceiro.length === 0 ? (
          <div className="dre-linha" style={{ color: 'var(--muted)', fontSize: '.85rem' }}>
            <span>Nenhuma taxa ou juro lançado</span>
            <span>R$ 0,00</span>
          </div>
        ) : (
          <>
            {dre.despesasFin > 0 && (
              <div className="dre-linha">
                <span>Taxas e tarifas</span>
                <span className="dre-valor-negativo">{fmtBRL(dre.despesasFin)}</span>
              </div>
            )}
            {dre.receitasFin > 0 && (
              <div className="dre-linha">
                <span>Juros / rendimentos recebidos</span>
                <span className="dre-valor-positivo">{fmtBRL(dre.receitasFin)}</span>
              </div>
            )}
          </>
        )}
        <div className="dre-linha subtotal">
          <span>TOTAL RESULTADO FINANCEIRO</span>
          <span className={dre.saldoFinanceiro >= 0 ? 'dre-valor-positivo' : 'dre-valor-negativo'}>
            {fmtBRL(dre.saldoFinanceiro)}
          </span>
        </div>

        {/* ── DESPESAS FIXAS (agrupadas) ── */}
        <div className="dre-secao-titulo">(-) Despesas Fixas</div>
        {Object.keys(dre.despesasPorGrupo).length === 0 ? (
          <div className="dre-linha" style={{ color: 'var(--muted)', fontSize: '.85rem' }}>
            <span>Nenhuma despesa lançada neste mês</span>
            <span>R$ 0,00</span>
          </div>
        ) : (
          Object.entries(dre.despesasPorGrupo).map(([grupo, g]) => (
            <div key={grupo}>
              <div className="dre-secao-titulo" style={{ background: '#f5f7fa', color: 'var(--muted)', fontSize: '.75rem', paddingLeft: 28 }}>
                {g.label}
              </div>
              {g.itens.map((d, i) => (
                <div className="dre-linha" key={i} style={{ paddingLeft: 32 }}>
                  <span style={{ color: 'var(--muted)', fontSize: '.88rem' }}>{d.descricao}</span>
                  <span className="dre-valor-negativo" style={{ fontSize: '.88rem' }}>{fmtBRL(d.valor)}</span>
                </div>
              ))}
              <div className="dre-linha subtotal" style={{ paddingLeft: 32, fontSize: '.88rem' }}>
                <span>Subtotal {g.label.split(' ').slice(1).join(' ')}</span>
                <span>{fmtBRL(g.subtotal)}</span>
              </div>
            </div>
          ))
        )}
        <div className="dre-linha subtotal">
          <span>TOTAL DESPESAS FIXAS</span>
          <span>{fmtBRL(dre.totalDespesas)}</span>
        </div>

        {/* ── LUCRO LÍQUIDO ── */}
        <div className={`dre-linha resultado${dre.lucroLiquido < 0 ? ' negativo' : ''}`}>
          <span>(=) LUCRO LÍQUIDO</span>
          <div style={{ textAlign: 'right' }}>
            <div>{fmtBRL(dre.lucroLiquido)}</div>
            <div style={{ fontSize: '.78rem', fontWeight: 400, opacity: .8 }}>
              Margem: {dre.margemLiquida.toFixed(1)}%
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── ABA DESPESAS ─────────────────────────────────────────────
function AbaDespesas({
  despesasRecorrentes, despesasMensais, pendentes, mesRef, mesFechado,
  showAutoLancar, autoLancando,
  onAutoLancar, onDismissAuto,
  onNovaRecorrente, onEditarRecorrente, onExcluirRecorrente,
  onNovoMensal, onEditarMensal, onExcluirMensal, onPagarMensal,
}) {
  const fixas = despesasRecorrentes.filter(r => r.tipo === 'fixa' && r.ativa !== false)

  // Agrupa recorrentes por grupo
  const recorrentesPorGrupo = {}
  for (const [grupo, cfg] of Object.entries(GRUPOS_DESPESA)) {
    const itens = despesasRecorrentes.filter(r => cfg.cats.includes(r.categoria))
    if (itens.length > 0) recorrentesPorGrupo[grupo] = { label: cfg.label, cls: cfg.cls, itens }
  }
  // Sem grupo
  const semGrupo = despesasRecorrentes.filter(r =>
    !Object.values(GRUPOS_DESPESA).some(cfg => cfg.cats.includes(r.categoria))
  )

  return (
    <div>
      {/* Banner auto-lançamento — não renderiza com o mês fechado (levaria a gravar) */}
      {!mesFechado && showAutoLancar && fixas.length > 0 && (
        <div className="fin-auto-lancamento">
          <h4>🗓️ Mês sem lançamentos</h4>
          <p>
            Detectamos que ainda não há lançamentos para <strong>{fmtMes(mesRef)}</strong>.
            Deseja lançar automaticamente as despesas <strong>fixas</strong> recorrentes?<br />
            ({fixas.map(f => `${f.descricao}: ${fmtBRL(f.valor)}`).join(' · ')})
          </p>
          <div className="fin-auto-lancamento-acoes">
            <button className="btn-sm" style={{ background: 'var(--light)', border: '1px solid var(--border)', color: 'var(--muted)' }}
              onClick={onDismissAuto}>Não, vou lançar manualmente</button>
            <button className="btn-sm btn-ok" disabled={autoLancando} onClick={onAutoLancar}>
              {autoLancando ? '⏳ Lançando...' : '✅ Sim, lançar fixas'}
            </button>
          </div>
        </div>
      )}

      {/* Alerta variáveis pendentes — botão de lançar some com o mês fechado */}
      {pendentes.length > 0 && (
        <div className="despesa-alerta">
          <div className="despesa-alerta-text">
            ⚠️ <strong>{pendentes.length} despesa{pendentes.length > 1 ? 's' : ''} variável{pendentes.length > 1 ? 'is' : ''}</strong> precisam de valor em {fmtMes(mesRef)}:{' '}
            {pendentes.map(p => p.descricao).join(', ')}
          </div>
          {!mesFechado && <button className="btn-sm btn-view" onClick={() => onNovoMensal(null)}>+ Lançar</button>}
        </div>
      )}

      {/* Cadastro recorrente */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h4 style={{ fontFamily: 'Barlow Condensed,sans-serif', fontSize: '.95rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
          💰 Despesas Recorrentes (Cadastro)
        </h4>
        {!mesFechado && <button className="btn-sm btn-view" onClick={onNovaRecorrente}>+ Nova</button>}
      </div>

      {despesasRecorrentes.length === 0 && (
        <div className="empty-state" style={{ padding: '24px', marginBottom: 16 }}>
          <p>Nenhuma despesa recorrente cadastrada ainda.</p>
        </div>
      )}

      {/* Renderiza por grupo */}
      {Object.entries(recorrentesPorGrupo).map(([grupo, g]) => (
        <div key={grupo}>
          <div className="despesa-grupo-titulo">{g.label}</div>
          {g.itens.map(r => (
            <ItemRecorrente key={r.id} r={r} grupoCls={g.cls} mesFechado={mesFechado}
              onEditar={onEditarRecorrente} onExcluir={onExcluirRecorrente} />
          ))}
        </div>
      ))}
      {semGrupo.map(r => (
        <ItemRecorrente key={r.id} r={r} grupoCls="administrativo" mesFechado={mesFechado}
          onEditar={onEditarRecorrente} onExcluir={onExcluirRecorrente} />
      ))}

      {/* Lançamentos do mês */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 10px' }}>
        <h4 style={{ fontFamily: 'Barlow Condensed,sans-serif', fontSize: '.95rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
          📅 Lançamentos de {fmtMes(mesRef)}
        </h4>
        {!mesFechado && <button className="btn-sm btn-view" onClick={() => onNovoMensal(null)}>+ Avulso</button>}
      </div>

      {despesasMensais.length === 0 && (
        <div className="empty-state" style={{ padding: '24px' }}>
          <p>Nenhum lançamento neste mês.</p>
        </div>
      )}

      {despesasMensais.map(l => {
        const recId  = l.despesa_recorrente_id
        const rec    = recId ? despesasRecorrentes.find(r => r.id === recId) : null
        const ehPend = rec && rec.tipo === 'variavel' && !l.valor
        const st     = statusDespesa(l, hojeISO())
        const dias   = diasParaVencer(l.data_vencimento, hojeISO())

        let badge
        if (ehPend) {
          badge = <span className="despesa-status-pend">⚠️ Pendente</span>
        } else if (st === 'pago') {
          badge = <span className="despesa-status-ok">✅ Pago</span>
        } else if (st === 'atrasado') {
          badge = <span className="despesa-status-atrasado">⚠️ Atrasada há {Math.abs(dias)} dia{Math.abs(dias) > 1 ? 's' : ''}</span>
        } else if (dias !== null) {
          badge = <span className="despesa-status-pend">{dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia${dias > 1 ? 's' : ''}`}</span>
        } else {
          badge = <span className="despesa-status-pend">⚠️ Pendente</span>
        }

        return (
          <div className={`despesa-item ${ehPend ? 'pendente' : 'lancado'}${st === 'atrasado' ? ' atrasado' : ''}`} key={l.id}>
            <div className="despesa-item-info">
              <div className="despesa-item-desc">{l.descricao}</div>
              <div className="despesa-item-sub">
                {LABEL_CATEGORIA[l.categoria] || l.categoria}
                {l.data_pagamento ? ` · pago em ${l.data_pagamento}` : ''}
              </div>
            </div>
            <div className="despesa-item-right">
              <span style={{ fontWeight: 700 }}>{fmtBRL(l.valor)}</span>
              {badge}
              {st !== 'pago' && (
                <button className="btn-sm btn-ok" disabled={mesFechado} title={mesFechado ? 'Mês fechado' : ''} onClick={() => onPagarMensal(l)}>✓ Pagar</button>
              )}
              <button className="btn-sm btn-view" disabled={mesFechado} title={mesFechado ? 'Mês fechado' : ''} onClick={() => onEditarMensal(l)}>✏️</button>
              <button className="btn-sm" style={{ background: 'var(--danger)', color: '#fff' }} disabled={mesFechado} title={mesFechado ? 'Mês fechado' : ''} onClick={() => onExcluirMensal(l)}>🗑️</button>
            </div>
          </div>
        )
      })}

      {!mesFechado && pendentes.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 8 }}>Lançar rapidamente:</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {pendentes.map(p => (
              <button key={p.id} className="btn-sm btn-view" onClick={() => onNovoMensal(p)}>
                + {p.descricao}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Card de despesa recorrente com badge de grupo
function ItemRecorrente({ r, grupoCls, mesFechado, onEditar, onExcluir }) {
  return (
    <div className="despesa-item" key={r.id}>
      <div className="despesa-item-info">
        <div className="despesa-item-desc">
          {r.descricao}
          <span className={`despesa-badge-tipo ${r.tipo}`}>{r.tipo === 'fixa' ? 'Fixa' : 'Variável'}</span>
          <span className={`despesa-badge-categoria ${grupoCls}`}>{LABEL_CATEGORIA[r.categoria] || r.categoria}</span>
        </div>
      </div>
      <div className="despesa-item-right">
        <span style={{ fontWeight: 700 }}>{fmtBRL(r.valor)}</span>
        <button className="btn-sm btn-view" disabled={mesFechado} title={mesFechado ? 'Mês fechado' : ''} onClick={() => onEditar(r)}>✏️</button>
        <button className="btn-sm" style={{ background: 'var(--danger)', color: '#fff' }} disabled={mesFechado} title={mesFechado ? 'Mês fechado' : ''} onClick={() => onExcluir(r)}>🗑️</button>
      </div>
    </div>
  )
}

// ── ABA SERVIÇOS PARTICULARES ────────────────────────────────
function AbaParticulares({ particulares, mesFechado, onNovo, onEditar, onExcluir }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h4 style={{ fontFamily: 'Barlow Condensed,sans-serif', fontSize: '.95rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
          🎨 Serviços Particulares
        </h4>
        {!mesFechado && <button className="btn-sm btn-view" onClick={onNovo}>+ Novo Serviço</button>}
      </div>

      {particulares.length === 0 && (
        <div className="empty-state">
          <div className="e-icon">🎨</div>
          <p>Nenhum serviço particular neste mês.</p>
        </div>
      )}

      {particulares.map(p => (
        <div className="particular-item" key={p.id}>
          <div className="particular-item-header">
            <div>
              <div className="particular-item-desc">{p.descricao}</div>
              {p.cliente && <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Cliente: {p.cliente}</div>}
            </div>
            <div className="particular-item-data">{p.data || '—'}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div className="particular-valores">
              <span>Recebido: <strong>{fmtBRL(p.valor_recebido)}</strong></span>
              <span>Custo: <strong>{fmtBRL(p.valor_custo)}</strong></span>
              <span className="particular-lucro">Lucro: {fmtBRL(p.lucro)}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-sm btn-view" disabled={mesFechado} title={mesFechado ? 'Mês fechado' : ''} onClick={() => onEditar(p)}>✏️ Editar</button>
              <button className="btn-sm" style={{ background: 'var(--danger)', color: '#fff' }} disabled={mesFechado} title={mesFechado ? 'Mês fechado' : ''} onClick={() => onExcluir(p)}>🗑️</button>
            </div>
          </div>
          {p.observacoes && (
            <div style={{ marginTop: 8, fontSize: '.8rem', color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
              {p.observacoes}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── ABA IMPOSTOS E FINANCEIRO ────────────────────────────────
function AbaImpostosFinanceiro({
  deducoes, resultFinanceiro, mesRef, mesFechado,
  onNovaDeducao, onEditarDeducao, onExcluirDeducao,
  onNovoResultFin, onEditarResultFin, onExcluirResultFin,
}) {
  const totalDeducoes   = deducoes.reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0)
  const despesasFin     = resultFinanceiro.filter(f => f.tipo === 'despesa').reduce((acc, f) => acc + (parseFloat(f.valor) || 0), 0)
  const receitasFin     = resultFinanceiro.filter(f => f.tipo === 'receita').reduce((acc, f) => acc + (parseFloat(f.valor) || 0), 0)
  const saldoFinanceiro = receitasFin - despesasFin

  const LABEL_DEDUCAO = { iss: 'ISS', imposto_federal: 'Imposto Federal', outro: 'Outro' }
  const LABEL_RF_CAT  = { taxa_gateway: 'Taxa de Maquininha/Gateway', taxa_bancaria: 'Tarifa Bancária', juros: 'Juros', outro: 'Outro' }

  return (
    <div>
      {/* ── Seção: Impostos ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ fontFamily: 'Barlow Condensed,sans-serif', fontSize: '.95rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
          🧾 Impostos e Deduções — {fmtMes(mesRef)}
        </h4>
        {!mesFechado && <button className="btn-sm btn-view" onClick={onNovaDeducao}>+ Lançar Imposto</button>}
      </div>

      <div style={{ fontSize: '.8rem', color: 'var(--muted)', background: '#f5f7fa', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '10px 14px', marginBottom: 14 }}>
        ℹ️ Valores informados manualmente pelo contador. Lance aqui todo mês para o DRE refletir o resultado real.
      </div>

      {deducoes.length === 0 && (
        <div className="empty-state" style={{ padding: '24px', marginBottom: 16 }}>
          <p>Nenhum imposto lançado neste mês.</p>
        </div>
      )}

      {deducoes.map(d => (
        <div className="deducao-item" key={d.id}>
          <div className="deducao-item-info">
            <div className="deducao-item-desc">{d.descricao}</div>
            <div className="deducao-item-sub">
              {LABEL_DEDUCAO[d.categoria] || d.categoria}
              {d.observacoes ? ` · ${d.observacoes}` : ''}
            </div>
          </div>
          <div className="deducao-item-right">
            <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmtBRL(d.valor)}</span>
            <button className="btn-sm btn-view" disabled={mesFechado} title={mesFechado ? 'Mês fechado' : ''} onClick={() => onEditarDeducao(d)}>✏️</button>
            <button className="btn-sm" style={{ background: 'var(--danger)', color: '#fff' }} disabled={mesFechado} title={mesFechado ? 'Mês fechado' : ''} onClick={() => onExcluirDeducao(d)}>🗑️</button>
          </div>
        </div>
      ))}

      {deducoes.length > 0 && (
        <div className="deducao-total">
          <span>TOTAL DEDUÇÕES DO MÊS</span>
          <span style={{ color: 'var(--danger)' }}>{fmtBRL(totalDeducoes)}</span>
        </div>
      )}

      {/* ── Seção: Resultado Financeiro ── */}
      <div className="subsecao-financeiro">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="subsecao-titulo">💳 Resultado Financeiro</div>
          {!mesFechado && <button className="btn-sm btn-view" onClick={onNovoResultFin}>+ Lançar Taxa/Juro</button>}
        </div>

        {resultFinanceiro.length === 0 && (
          <div className="empty-state" style={{ padding: '24px', marginBottom: 16 }}>
            <p>Nenhuma taxa ou juro lançado neste mês.</p>
          </div>
        )}

        {resultFinanceiro.map(f => (
          <div className="deducao-item" key={f.id}>
            <div className="deducao-item-info">
              <div className="deducao-item-desc">
                {f.tipo === 'despesa' ? '(-) ' : '(+) '}{f.descricao}
              </div>
              <div className="deducao-item-sub">{LABEL_RF_CAT[f.categoria] || f.categoria}</div>
            </div>
            <div className="deducao-item-right">
              <span style={{ fontWeight: 700, color: f.tipo === 'despesa' ? 'var(--danger)' : 'var(--success)' }}>
                {f.tipo === 'despesa' ? '- ' : '+ '}{fmtBRL(f.valor)}
              </span>
              <button className="btn-sm btn-view" disabled={mesFechado} title={mesFechado ? 'Mês fechado' : ''} onClick={() => onEditarResultFin(f)}>✏️</button>
              <button className="btn-sm" style={{ background: 'var(--danger)', color: '#fff' }} disabled={mesFechado} title={mesFechado ? 'Mês fechado' : ''} onClick={() => onExcluirResultFin(f)}>🗑️</button>
            </div>
          </div>
        ))}

        {resultFinanceiro.length > 0 && (
          <div className="deducao-total">
            <span>RESULTADO FINANCEIRO DO MÊS</span>
            <span style={{ color: saldoFinanceiro >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 800 }}>
              {fmtBRL(saldoFinanceiro)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── MODAL: Despesa Recorrente ────────────────────────────────
function ModalDespesaRecorrente({ form, setForm, salvando, editando, onSalvar, onFechar }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="modal-box" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2>{editando ? '✏️ Editar Despesa Recorrente' : '+ Nova Despesa Recorrente'}</h2>
          <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={onFechar}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Descrição <span className="req">*</span></label>
            <input value={form.descricao}
              onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
              placeholder="Ex: Salário Felipe, Aluguel sala..." />
          </div>

          <div className="row col-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Categoria</label>
              <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                <optgroup label="Pessoal">
                  <option value="salario_funcionario">Salário de Funcionário</option>
                  <option value="pro_labore_socio">Pró-labore de Sócio</option>
                </optgroup>
                <optgroup label="Estrutura">
                  <option value="aluguel">Aluguel</option>
                  <option value="agua_luz">Água e Luz</option>
                  <option value="internet">Internet</option>
                  <option value="estrutura">Estrutura / Outros do Escritório</option>
                </optgroup>
                <optgroup label="Administrativo">
                  <option value="contabilidade">Contabilidade</option>
                  <option value="outro">Outro</option>
                </optgroup>
              </select>
            </div>
            <div className="field">
              <label>Valor Base (R$)</label>
              <input type="number" step="0.01" min="0"
                value={form.valor}
                onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                placeholder="0,00" />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Dia de Vencimento</label>
            <input type="number" min="1" max="31"
              value={form.dia_vencimento}
              onChange={e => setForm(p => ({ ...p, dia_vencimento: e.target.value }))}
              placeholder="Ex: 10" />
            <small style={{ color: 'var(--muted)' }}>Dia do mês em que vence (opcional)</small>
          </div>

          <div className="field" style={{ marginBottom: 4 }}>
            <label>Tipo</label>
          </div>
          <div className="radio-group">
            <div className={`ri${form.tipo === 'fixa' ? ' rs' : ''}`} onClick={() => setForm(p => ({ ...p, tipo: 'fixa' }))}>
              <div className="rdot"><div className="rdot-i" /></div>
              Fixa (não muda todo mês)
            </div>
            <div className={`ri${form.tipo === 'variavel' ? ' rs' : ''}`} onClick={() => setForm(p => ({ ...p, tipo: 'variavel' }))}>
              <div className="rdot"><div className="rdot-i" /></div>
              Variável (preciso atualizar todo mês)
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-sm" style={{ background: 'var(--light)', color: 'var(--muted)', border: '1px solid var(--border)' }} onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" style={{ padding: '9px 22px', fontSize: '.9rem' }} disabled={salvando} onClick={onSalvar}>
            {salvando ? '⏳ Salvando...' : '💾 Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL: Lançamento Mensal ─────────────────────────────────
function ModalLancamentoMensal({ form, setForm, salvando, editando, mesRef, onSalvar, onFechar }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="modal-box" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2>{editando ? '✏️ Editar Lançamento' : `+ Lançamento de ${fmtMes(mesRef)}`}</h2>
          <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={onFechar}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Descrição <span className="req">*</span></label>
            <input value={form.descricao}
              onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
              placeholder="Ex: Conta de luz maio..." />
          </div>

          <div className="row col-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Categoria</label>
              <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                <optgroup label="Pessoal">
                  <option value="salario_funcionario">Salário de Funcionário</option>
                  <option value="pro_labore_socio">Pró-labore de Sócio</option>
                </optgroup>
                <optgroup label="Estrutura">
                  <option value="aluguel">Aluguel</option>
                  <option value="agua_luz">Água e Luz</option>
                  <option value="internet">Internet</option>
                  <option value="estrutura">Estrutura / Outros do Escritório</option>
                </optgroup>
                <optgroup label="Administrativo">
                  <option value="contabilidade">Contabilidade</option>
                  <option value="outro">Outro</option>
                </optgroup>
              </select>
            </div>
            <div className="field">
              <label>Valor (R$) <span className="req">*</span></label>
              <input type="number" step="0.01" min="0"
                value={form.valor}
                onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                placeholder="0,00" />
            </div>
          </div>

          <div className="row col-2">
            <div className="field">
              <label>Vence em</label>
              <input type="date" value={form.data_vencimento}
                onChange={e => setForm(p => ({ ...p, data_vencimento: e.target.value }))} />
            </div>
            <div className="field">
              <label>Pago em</label>
              <input type="date" value={form.data_pagamento}
                onChange={e => setForm(p => ({ ...p, data_pagamento: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-sm" style={{ background: 'var(--light)', color: 'var(--muted)', border: '1px solid var(--border)' }} onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" style={{ padding: '9px 22px', fontSize: '.9rem' }} disabled={salvando} onClick={onSalvar}>
            {salvando ? '⏳ Salvando...' : '💾 Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL: Serviço Particular ────────────────────────────────
function ModalServicoParticular({ form, setForm, salvando, editando, onSalvar, onFechar }) {
  const rec   = parseFloat(form.valor_recebido) || 0
  const custo = parseFloat(form.valor_custo)    || 0
  const lucro = rec - custo

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="modal-box" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h2>{editando ? '✏️ Editar Serviço Particular' : '+ Novo Serviço Particular'}</h2>
          <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={onFechar}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Descrição <span className="req">*</span></label>
            <input value={form.descricao}
              onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
              placeholder="Ex: Pintura residência — Sítio Bela Vista" />
          </div>

          <div className="row col-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Cliente</label>
              <input value={form.cliente}
                onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))}
                placeholder="Nome do cliente" />
            </div>
            <div className="field">
              <label>Data</label>
              <input type="date" value={form.data}
                onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
            </div>
          </div>

          <div className="row col-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Valor Recebido (R$)</label>
              <input type="number" step="0.01" min="0"
                value={form.valor_recebido}
                onChange={e => setForm(p => ({ ...p, valor_recebido: e.target.value }))}
                placeholder="0,00" />
            </div>
            <div className="field">
              <label>Custo / Pago (R$)</label>
              <input type="number" step="0.01" min="0"
                value={form.valor_custo}
                onChange={e => setForm(p => ({ ...p, valor_custo: e.target.value }))}
                placeholder="0,00" />
            </div>
          </div>

          {(rec > 0 || custo > 0) && (
            <div className={`margem-material-box${lucro < 0 ? ' negativa' : ''}`} style={{ marginBottom: 12 }}>
              <span>Lucro calculado</span>
              <span>{fmtBRL(lucro)}</span>
            </div>
          )}

          <div className="field">
            <label>Observações</label>
            <textarea rows={2} value={form.observacoes}
              onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
              placeholder="Informações adicionais..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-sm" style={{ background: 'var(--light)', color: 'var(--muted)', border: '1px solid var(--border)' }} onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" style={{ padding: '9px 22px', fontSize: '.9rem' }} disabled={salvando} onClick={onSalvar}>
            {salvando ? '⏳ Salvando...' : '💾 Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL: Lançar Imposto / Dedução ─────────────────────────
function ModalDeducao({ form, setForm, salvando, editando, mesRef, onSalvar, onFechar }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2>{editando ? '✏️ Editar Imposto' : `🧾 Lançar Imposto — ${fmtMes(mesRef)}`}</h2>
          <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={onFechar}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Descrição <span className="req">*</span></label>
            <input value={form.descricao}
              onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
              placeholder="Ex: ISS, Imposto Federal, Simples Nacional..." />
          </div>

          <div className="row col-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Categoria</label>
              <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                <option value="iss">ISS</option>
                <option value="imposto_federal">Imposto Federal</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div className="field">
              <label>Valor (R$) <span className="req">*</span></label>
              <input type="number" step="0.01" min="0"
                value={form.valor}
                onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                placeholder="0,00" />
            </div>
          </div>

          <div className="field">
            <label>Observações</label>
            <textarea rows={2} value={form.observacoes}
              onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
              placeholder="Ex: Valor informado pelo contador em DD/MM" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-sm" style={{ background: 'var(--light)', color: 'var(--muted)', border: '1px solid var(--border)' }} onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" style={{ padding: '9px 22px', fontSize: '.9rem' }} disabled={salvando} onClick={onSalvar}>
            {salvando ? '⏳ Salvando...' : '💾 Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL: Lançar Taxa / Juro ────────────────────────────────
function ModalResultFinanceiro({ form, setForm, salvando, editando, mesRef, onSalvar, onFechar }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2>{editando ? '✏️ Editar Lançamento Financeiro' : `💳 Lançar Taxa/Juro — ${fmtMes(mesRef)}`}</h2>
          <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={onFechar}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Tipo</label>
          </div>
          <div className="radio-group" style={{ marginBottom: 14 }}>
            <div className={`ri${form.tipo === 'despesa' ? ' rs' : ''}`} onClick={() => setForm(p => ({ ...p, tipo: 'despesa' }))}>
              <div className="rdot"><div className="rdot-i" /></div>
              Despesa (taxa, tarifa, juros pagos)
            </div>
            <div className={`ri${form.tipo === 'receita' ? ' rs' : ''}`} onClick={() => setForm(p => ({ ...p, tipo: 'receita' }))}>
              <div className="rdot"><div className="rdot-i" /></div>
              Receita (juros recebidos, rendimento)
            </div>
          </div>

          <div className="row col-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Categoria</label>
              <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                <option value="taxa_gateway">Taxa de Maquininha/Gateway</option>
                <option value="taxa_bancaria">Tarifa Bancária</option>
                <option value="juros">Juros</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div className="field">
              <label>Valor (R$) <span className="req">*</span></label>
              <input type="number" step="0.01" min="0"
                value={form.valor}
                onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                placeholder="0,00" />
            </div>
          </div>

          <div className="field">
            <label>Descrição <span className="req">*</span></label>
            <input value={form.descricao}
              onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
              placeholder="Ex: Taxa maquininha cartão, Tarifa mensal Bradesco..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-sm" style={{ background: 'var(--light)', color: 'var(--muted)', border: '1px solid var(--border)' }} onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" style={{ padding: '9px 22px', fontSize: '.9rem' }} disabled={salvando} onClick={onSalvar}>
            {salvando ? '⏳ Salvando...' : '💾 Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
