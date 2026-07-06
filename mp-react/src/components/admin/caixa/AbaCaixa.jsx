// ============================================================
// ABA CAIXA — fluxo de caixa real do mês (CAIXA-01)
// Entradas: notas pagas + serviços particulares do mês.
// Saídas: despesas pagas + técnicos pagos no mês.
// Carga própria (6 coleções, leitura completa — decisão LOCKED),
// cálculo delegado a utils/fluxoCaixa.js (fluxoCaixaDoMes).
// ============================================================
import { useState, useEffect } from 'react'
import { db, collection, getDocs } from '../../../firebase.js'
import { useAdminContext } from '../../../contexts/AdminContext.jsx'
import { fmtBRL } from '../../../utils/formatters.js'
import { fluxoCaixaDoMes } from '../../../utils/fluxoCaixa.js'

const MESES_NOMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

function fmtMes(mesRef) {
  const [ano, mes] = mesRef.split('-').map(Number)
  return `${MESES_NOMES[mes - 1]} de ${ano}`
}

export default function AbaCaixa({ mesRef }) {
  const { empresaId, showToast } = useAdminContext()

  const [notas, setNotas] = useState([])
  const [fechamentos, setFechamentos] = useState([])
  const [despesas, setDespesas] = useState([])
  const [deducoes, setDeducoes] = useState([])
  const [resultadoFinanceiro, setResultadoFinanceiro] = useState([])
  const [particulares, setParticulares] = useState([])
  const [carregando, setCarregando] = useState(true)

  // Carga única por empresaId (NUNCA por mesRef) — as 6 coleções inteiras
  // são lidas uma vez e a navegação de mês só recalcula em memória.
  useEffect(() => {
    if (!empresaId) return
    setCarregando(true)
    Promise.all([
      getDocs(collection(db, `empresas/${empresaId}/notasFiscais`)),
      getDocs(collection(db, `empresas/${empresaId}/fechamentosTecnicos`)),
      getDocs(collection(db, `empresas/${empresaId}/despesasMensais`)),
      getDocs(collection(db, `empresas/${empresaId}/deducoesMensais`)),
      getDocs(collection(db, `empresas/${empresaId}/resultadoFinanceiroMensal`)),
      getDocs(collection(db, `empresas/${empresaId}/servicosParticulares`)),
    ])
      .then(([notasSnap, fechSnap, despSnap, dedSnap, rfSnap, partSnap]) => {
        setNotas(notasSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setFechamentos(fechSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setDespesas(despSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setDeducoes(dedSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setResultadoFinanceiro(rfSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setParticulares(partSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      })
      .catch(e => showToast('Erro ao carregar caixa: ' + e.message, 'error'))
      .finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  // Recalcula a cada navegação de mês, sem refetch — dados já em memória.
  const caixa = fluxoCaixaDoMes({ notas, particulares, despesas, fechamentos }, mesRef)
  const semMovimentacao = caixa.entradas.total === 0 && caixa.saidas.total === 0

  return (
    <div>
      <h4 style={{ fontFamily: 'Barlow Condensed,sans-serif', fontSize: '.95rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 12 }}>
        💵 Caixa — {fmtMes(mesRef)}
      </h4>

      <div style={{ fontSize: '.8rem', color: 'var(--muted)', background: '#f5f7fa', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '10px 14px', marginBottom: 16 }}>
        ℹ️ O DRE responde "o mês deu lucro?". O Caixa responde "quanto dinheiro entrou e saiu de verdade?" — aqui só contam notas, despesas e técnicos já PAGOS.
      </div>

      {carregando && (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Carregando...
        </div>
      )}

      {!carregando && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ flex: '1 1 200px', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 6 }}>💰 Entradas</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--ok, green)' }}>{fmtBRL(caixa.entradas.total)}</div>
            </div>
            <div style={{ flex: '1 1 200px', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 6 }}>💸 Saídas</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--danger)' }}>{fmtBRL(caixa.saidas.total)}</div>
            </div>
            <div style={{ flex: '1 1 200px', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 6 }}>🏦 Sobrou no caixa</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: caixa.saldo >= 0 ? 'var(--ok, green)' : 'var(--danger)' }}>
                {fmtBRL(caixa.saldo)}
              </div>
            </div>
          </div>

          {semMovimentacao && (
            <div className="empty-state" style={{ padding: 24 }}>
              <p>Nenhuma movimentação de caixa em {fmtMes(mesRef)}.</p>
              <p style={{ fontSize: '.85rem', color: 'var(--muted)', marginTop: 8 }}>
                Entradas aparecem quando você marca notas como pagas na aba 📄 Faturamento;
                saídas quando paga despesas (💸 Despesas) e técnicos (👷 Técnicos).
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
