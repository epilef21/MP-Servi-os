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
import { fmtBRL, fmtDate } from '../../../utils/formatters.js'
import { fluxoCaixaDoMes, dataEntradaNota, serieEvolucao12Meses } from '../../../utils/fluxoCaixa.js'

const MESES_NOMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

const MESES_ABREV = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function fmtMes(mesRef) {
  const [ano, mes] = mesRef.split('-').map(Number)
  return `${MESES_NOMES[mes - 1]} de ${ano}`
}

// Label curto 'MMM/AA' a partir de 'YYYY-MM' — split simples, sem new Date()/
// toISOString (mesma cautela LOCKED do resto da Fase 10).
function fmtMesAbrev(mes) {
  const [ano, m] = mes.split('-')
  return `${MESES_ABREV[Number(m) - 1]}/${ano.slice(2)}`
}

export default function AbaCaixa({ mesRef }) {
  const { empresaId, reports, showToast } = useAdminContext()

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

  // Série de evolução 12 meses (CAIXA-02) — janela termina no mesRef, recalcula
  // ao navegar de mês, sem refetch (mesmos dados já carregados acima).
  const serie = serieEvolucao12Meses({ reports, particulares, despesas, deducoes, resultadoFinanceiro }, mesRef)

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

          {!semMovimentacao && (
            <>
              <DetalheEntradas entradas={caixa.entradas} />
              <DetalheSaidas saidas={caixa.saidas} />
            </>
          )}

          <EvolucaoSection serie={serie} />
        </>
      )}
    </div>
  )
}

// ── Seção "📊 Evolução 12 meses" (CAIXA-02) — barras 100% CSS, LOCKED: zero
// dependência nova de gráfico. Escala normalizada por maxVal (piso 1) para
// nunca quebrar layout com valores extremos ou zerados (T-10-07/T-10-08).
const ALTURA_BARRAS = 120

function EvolucaoSection({ serie }) {
  const semHistorico = serie.every((p) => p.receita === 0 && p.lucroLiquido === 0)

  return (
    <div style={{ marginTop: 28 }}>
      <h5 style={{ fontFamily: 'Barlow Condensed,sans-serif', fontSize: '.9rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 12 }}>
        📊 Evolução 12 meses
      </h5>

      {semHistorico ? (
        <div className="empty-state" style={{ padding: 24 }}>
          <p>Ainda não há histórico para montar a evolução — os meses vão aparecendo aqui conforme as OS e lançamentos forem registrados.</p>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 10 }}>
            <span style={{ color: 'var(--primary)' }}>▪</span> Receita
            <span style={{ marginLeft: 14, color: '#2e7d32' }}>▪</span> Lucro líquido
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            <BarrasEvolucao serie={serie} />
          </div>
        </>
      )}
    </div>
  )
}

function BarrasEvolucao({ serie }) {
  const maxVal = Math.max(...serie.map((p) => Math.max(p.receita, Math.abs(p.lucroLiquido))), 1)
  const altura = (v) => {
    const valor = Math.abs(v || 0)
    if (valor <= 0) return 0
    return Math.max((valor / maxVal) * ALTURA_BARRAS, 2)
  }

  return serie.map((p) => {
    const corLucro = p.lucroLiquido >= 0 ? '#2e7d32' : 'var(--danger)'
    return (
      <div key={p.mes} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto', minWidth: 46 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: ALTURA_BARRAS }}>
          <div
            title={`Receita: ${fmtBRL(p.receita)}`}
            style={{ width: 14, height: altura(p.receita), background: 'var(--primary)', borderRadius: '2px 2px 0 0' }}
          />
          <div
            title={`Lucro: ${fmtBRL(p.lucroLiquido)}`}
            style={{ width: 14, height: altura(p.lucroLiquido), background: corLucro, borderRadius: '2px 2px 0 0' }}
          />
        </div>
        <div style={{ fontSize: '.68rem', color: 'var(--muted)', marginTop: 4, whiteSpace: 'nowrap' }}>{fmtMesAbrev(p.mes)}</div>
        <div style={{ fontSize: '.68rem', fontWeight: 700, color: p.margem < 0 ? 'var(--danger)' : 'var(--text)' }}>
          {p.margem.toFixed(0)}%
        </div>
      </div>
    )
  })
}

// ── Detalhamento expansível: entradas (notas pagas + particulares) ──
function DetalheEntradas({ entradas }) {
  const n = entradas.notas.length + entradas.particulares.length
  return (
    <details style={{ marginBottom: 12 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--primary)', padding: '8px 0' }}>
        Ver entradas ({n})
      </summary>
      <div style={{ padding: '8px 0 0 8px' }}>
        {entradas.notas.length === 0 ? (
          <p style={{ fontSize: '.85rem', color: 'var(--muted)' }}>Nenhuma nota paga neste mês.</p>
        ) : (
          entradas.notas.map(nota => (
            <div key={nota.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
              <span>Nota {nota.numero || '—'} · {nota.seguradora || '—'} · pago em {fmtDate(dataEntradaNota(nota))}</span>
              <span>{fmtBRL(nota.total)}</span>
            </div>
          ))
        )}
        {entradas.notas.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', fontWeight: 700, padding: '6px 0' }}>
            <span>Subtotal notas</span>
            <span>{fmtBRL(entradas.totalNotas)}</span>
          </div>
        )}

        {entradas.particulares.length === 0 ? (
          <p style={{ fontSize: '.85rem', color: 'var(--muted)', marginTop: 8 }}>Nenhum serviço particular recebido neste mês.</p>
        ) : (
          entradas.particulares.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
              <span>{p.descricao || '—'}</span>
              <span>{fmtBRL(p.valor_recebido)}</span>
            </div>
          ))
        )}
        {entradas.particulares.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', fontWeight: 700, padding: '6px 0' }}>
            <span>Subtotal particulares</span>
            <span>{fmtBRL(entradas.totalParticulares)}</span>
          </div>
        )}
      </div>
    </details>
  )
}

// ── Detalhamento expansível: saídas (despesas pagas + técnicos pagos) ──
function DetalheSaidas({ saidas }) {
  const n = saidas.despesas.length + saidas.tecnicos.length
  return (
    <details>
      <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--primary)', padding: '8px 0' }}>
        Ver saídas ({n})
      </summary>
      <div style={{ padding: '8px 0 0 8px' }}>
        {saidas.despesas.length === 0 ? (
          <p style={{ fontSize: '.85rem', color: 'var(--muted)' }}>Nenhuma despesa paga neste mês.</p>
        ) : (
          saidas.despesas.map(d => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
              <span>{d.descricao || '—'} · pago em {fmtDate(d.data_pagamento)}</span>
              <span>{fmtBRL(d.valor)}</span>
            </div>
          ))
        )}
        {saidas.despesas.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', fontWeight: 700, padding: '6px 0' }}>
            <span>Subtotal despesas</span>
            <span>{fmtBRL(saidas.totalDespesas)}</span>
          </div>
        )}

        {saidas.tecnicos.length === 0 ? (
          <p style={{ fontSize: '.85rem', color: 'var(--muted)', marginTop: 8 }}>Nenhum técnico pago neste mês.</p>
        ) : (
          saidas.tecnicos.map(f => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
              <span>{f.tecnico || '—'} · ref. {f.mes_referencia || '—'} · pago em {fmtDate(f.pago_em)}</span>
              <span>{fmtBRL(f.total)}</span>
            </div>
          ))
        )}
        {saidas.tecnicos.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', fontWeight: 700, padding: '6px 0' }}>
            <span>Subtotal técnicos</span>
            <span>{fmtBRL(saidas.totalTecnicos)}</span>
          </div>
        )}
      </div>
    </details>
  )
}
