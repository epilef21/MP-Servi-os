// ============================================================
// MODAL: CONVERTER ORÇAMENTO EM OS — extraído do AdminPage.jsx
// Cria uma OS pré-preenchida a partir de um orçamento aprovado.
// ============================================================
import { useState } from 'react'
import { db, doc, updateDoc, criarOS } from '../../firebase.js'
import { useAdminContext } from '../../contexts/AdminContext.jsx'
import { fmtDate } from '../../utils/formatters.js'

export default function ConverterOSModal({ orc, onClose, onConverted }) {
  const {
    empresaId, buildLink,
    setReports, setTotalMes, setOrcamentos, setGeneratedLink, showToast,
  } = useAdminContext()

  const [saving, setSaving] = useState(false)

  // Converte orçamento aprovado em Ordem de Serviço
  async function converterEmOS() {
    setSaving(true)
    try {
      const servicoDesc = orc.tipo === 'linha_branca'
        ? `${orc.tipo_equipamento || ''} ${orc.marca || ''} ${orc.modelo || ''}`.trim()
        : orc.tipo_emergencia || orc.tipo || ''
      const payload = {
        seguradora:    orc.seguradora    || '',
        num_assist:    orc.num_assist    || '',
        nome_segurado: orc.nome_cliente  || '',
        tel_segurado:  orc.tel_cliente   || '',
        endereco:      orc.endereco      || '',
        cidade:        orc.cidade        || '',
        servico:       servicoDesc,
        desc_problema: orc.diagnostico   || orc.defeito || orc.desc_problema || '',
        status:        'pendente',
        origem:        'orcamento',
        tecnico_nome:  orc.tecnico_nome  || '',
        tecnico_id:    orc.tecnico_id    || '',
        data_chegada:  '',
        publicToken:   crypto.randomUUID(),
      }
      const ref    = await criarOS(empresaId, payload)
      const newRec = { id: ref.id, ...payload, criado_em: { toDate: () => new Date() } }
      await updateDoc(doc(db, `empresas/${empresaId}/orcamentos`, orc.id), { os_vinculada: ref.id, status: 'executado' })
      setOrcamentos(p => p.map(o => o.id === orc.id ? { ...o, os_vinculada: ref.id, status: 'executado' } : o))
      setReports(p => [newRec, ...p])
      setTotalMes(p => p + 1)
      setGeneratedLink({ link: buildLink(newRec), os: ref.id, nome: orc.nome_cliente, seguradora: orc.seguradora, num_assist: orc.num_assist })
      showToast('🎉 OS criada com sucesso!')
      onConverted()
    } catch (e) { showToast('Erro ao criar OS: ' + e.message, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:520 }}>
        <div className="modal-header" style={{ background:'#1e7040' }}>
          <h2>🚀 Converter em OS</h2>
          <button className="btn-sm" style={{ background:'rgba(255,255,255,.15)', color:'#fff' }} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="orc-aprovado-banner" style={{ marginBottom:16 }}>
            <h3>🎉 Orçamento aprovado por {orc.aprovado_por}!</h3>
            <p>Assinado em: {fmtDate(orc.aprovado_em)}</p>
          </div>
          <p style={{ fontSize:'.88rem', color:'var(--muted)', marginBottom:16 }}>
            Os dados abaixo serão pré-preenchidos na Ordem de Serviço:
          </p>

          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
            {[
              { l:'Nome',      v: orc.nome_cliente },
              { l:'Telefone',  v: orc.tel_cliente  },
              { l:'Endereço',  v: orc.endereco     },
              { l:'Cidade',    v: orc.cidade       },
              { l:'Serviço',   v: orc.tipo === 'linha_branca'
                  ? `${orc.tipo_equipamento||''} ${orc.marca||''} + manutenção`.trim()
                  : orc.tipo_emergencia || orc.tipo || '—' },
            ].map((f,i) => (
              <div key={i} style={{ display:'flex', gap:12, padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:'.88rem' }}>
                <span style={{ color:'var(--muted)', minWidth:80 }}>{f.l}</span>
                <span style={{ fontWeight:600 }}>{f.v || '—'} ✅</span>
              </div>
            ))}
          </div>

          {orc.tipo !== 'particular' && (
            <div className="os-grid">
              <div className="field">
                <label>Seguradora</label>
                <input defaultValue={orc.seguradora || ''} readOnly className="locked" />
              </div>
              <div className="field">
                <label>Nº Assistência</label>
                <input defaultValue={orc.num_assist || ''} readOnly className="locked" />
              </div>
            </div>
          )}

          <div className="os-callout" style={{ marginTop:12 }}>
            💡 A OS será criada como "Pendente" e ficará disponível no painel para acompanhamento.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-sm" style={{ background:'var(--light)', color:'var(--muted)', border:'1px solid var(--border)' }}
            onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={converterEmOS} disabled={saving} style={{ padding:'9px 22px', fontSize:'.9rem' }}>
            {saving ? '⏳ Criando...' : '🚀 Criar OS Agora'}
          </button>
        </div>
      </div>
    </div>
  )
}
