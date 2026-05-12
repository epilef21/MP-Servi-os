import { useState, useEffect, useRef } from 'react'
import { sendPasswordResetEmail, updateProfile } from 'firebase/auth'
import {
  db, auth, storage,
  refConfig, refEmpresa,
  updateDoc, doc,
  storageRef, uploadBytes, getDownloadURL,
  PLANOS,
} from '../../firebase.js'
import { useAuth }        from '../../contexts/AuthContext.jsx'
import { useAdminContext } from '../../contexts/AdminContext.jsx'
import { maskPhone, maskCNPJ } from '../../utils/formatters.js'

export default function ConfigTab() {
  const { emailUsuario } = useAuth()
  const {
    empresa, config, empresaId,
    showToast, logoPreview, setLogoPreview, totalMes,
  } = useAdminContext()

  // ── Plano (calculado localmente) ─────────────────────────
  const planoAtual = empresa?.plano || 'basico'
  const planoInfo  = PLANOS[planoAtual] || PLANOS.basico
  const usagePct   = planoInfo.limiteOS === -1 ? 0 : Math.min(100, Math.round((totalMes / planoInfo.limiteOS) * 100))
  const usageCls   = usagePct >= 90 ? 'danger' : usagePct >= 70 ? 'warn' : ''

  const inicialUsuario = auth.currentUser?.displayName
    ? auth.currentUser.displayName[0].toUpperCase()
    : emailUsuario ? emailUsuario[0].toUpperCase() : 'A'

  // ── Estado local ─────────────────────────────────────────
  const [configAba, setConfigAba] = useState('empresa')

  const [configForm, setConfigForm] = useState({
    nome: '', telefone: '', whatsapp: '', endereco: '',
    cidade_estado: '', cnpj: '', site: '', seguradoras: [],
  })
  const [savingConfig,      setSavingConfig]      = useState(false)
  const [resetEmailEnviado, setResetEmailEnviado] = useState(false)
  const [nomeUsuario,       setNomeUsuario]       = useState('')
  const [savingNome,        setSavingNome]        = useState(false)
  const [logoUploading,     setLogoUploading]     = useState(false)
  const logoInputRef = useRef(null)

  // Inicializa form quando config/empresa carrega
  useEffect(() => {
    if (config || empresa) {
      setConfigForm({
        nome:          config?.nome          || empresa?.nome          || '',
        telefone:      config?.telefone      || empresa?.telefone      || '',
        whatsapp:      config?.whatsapp      || empresa?.whatsapp      || '',
        endereco:      config?.endereco      || empresa?.endereco      || '',
        cidade_estado: config?.cidade_estado || empresa?.cidade_estado || '',
        cnpj:          config?.cnpj          || empresa?.cnpj          || '',
        site:          config?.site          || empresa?.site          || '',
        seguradoras:   config?.seguradoras   || ['Tempo','Mapfre','Maxpar','Allianz'],
      })
    }
  }, [config, empresa])

  // Inicializa nome do usuário
  useEffect(() => {
    if (auth.currentUser?.displayName) {
      setNomeUsuario(auth.currentUser.displayName)
    }
  }, [])

  function toggleSeguradora(seg) {
    setConfigForm(p => ({
      ...p,
      seguradoras: p.seguradoras.includes(seg)
        ? p.seguradoras.filter(s => s !== seg)
        : [...p.seguradoras, seg],
    }))
  }

  async function saveConfig() {
    if (!empresaId) return
    setSavingConfig(true)
    try {
      const payload = {
        nome:          configForm.nome.trim(),
        telefone:      configForm.telefone.trim(),
        whatsapp:      configForm.whatsapp.trim()      || '',
        endereco:      configForm.endereco.trim()      || '',
        cidade_estado: configForm.cidade_estado.trim() || '',
        cnpj:          configForm.cnpj.trim()          || '',
        site:          configForm.site.trim()          || '',
        seguradoras:   configForm.seguradoras,
      }
      await updateDoc(refConfig(empresaId), payload)
      showToast('✅ Dados salvos com sucesso!')
    } catch (e) {
      showToast('Erro ao salvar: ' + e.message, 'error')
    } finally {
      setSavingConfig(false)
    }
  }

  async function handleLogoUpload(file) {
    if (!file || !empresaId) return
    if (file.size > 2 * 1024 * 1024) { showToast('Arquivo muito grande. Máximo 2MB.', 'error'); return }
    const allowed = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
    if (!allowed.includes(file.type)) { showToast('Formato não suportado. Use JPG, PNG ou SVG.', 'error'); return }

    setLogoUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `empresas/${empresaId}/logo.${ext}`
      const ref  = storageRef(storage, path)
      await uploadBytes(ref, file)
      const url  = await getDownloadURL(ref)
      setLogoPreview(url)
      await updateDoc(refConfig(empresaId),  { logoUrl: url })
      await updateDoc(refEmpresa(empresaId), { logoUrl: url })
      showToast('🖼️ Logo enviada com sucesso!')
    } catch (e) {
      showToast('Erro no upload: ' + e.message, 'error')
    } finally {
      setLogoUploading(false)
    }
  }

  async function saveNomeUsuario() {
    if (!nomeUsuario.trim() || !auth.currentUser) return
    setSavingNome(true)
    try {
      await updateProfile(auth.currentUser, { displayName: nomeUsuario.trim() })
      showToast('✅ Nome atualizado!')
    } catch (e) {
      showToast('Erro: ' + e.message, 'error')
    } finally {
      setSavingNome(false)
    }
  }

  async function sendResetEmail() {
    if (!emailUsuario) return
    try {
      await sendPasswordResetEmail(auth, emailUsuario)
      setResetEmailEnviado(true)
      setTimeout(() => setResetEmailEnviado(false), 5000)
    } catch (e) {
      alert('Erro: ' + e.message)
    }
  }

  return (
    <div className="tab-content">
      <div className="config-tabs-bar">
        {[
          { id: 'empresa', label: '🏢 Minha Empresa' },
          { id: 'conta',   label: '👤 Minha Conta'   },
        ].map(t => (
          <button key={t.id} className={`config-tab-btn${configAba === t.id ? ' active' : ''}`}
            onClick={() => setConfigAba(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Sub-aba: Minha Empresa ── */}
      {configAba === 'empresa' && (
        <div style={{ maxWidth: 620 }}>
          <h3 className="config-section-title" style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
            Logo da Empresa
          </h3>
          <div
            className="logo-upload-area"
            onClick={() => !logoUploading && logoInputRef.current?.click()}
            style={{ marginBottom: 24, cursor: logoUploading ? 'not-allowed' : 'pointer', opacity: logoUploading ? .7 : 1 }}
          >
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/svg+xml,image/webp"
              onChange={e => e.target.files[0] && handleLogoUpload(e.target.files[0])}
            />
            {logoPreview
              ? <img src={logoPreview} alt="Logo atual" className="logo-preview" />
              : <div className="logo-upload-icon">🖼️</div>
            }
            <div className="logo-upload-text">
              {logoUploading
                ? '⏳ Enviando...'
                : <><strong>Clique para enviar</strong> ou arraste a logo<br /><span style={{ fontSize: '.75rem' }}>JPG, PNG ou SVG • Máx. 2MB</span></>
              }
            </div>
          </div>

          <h3 style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
            Dados da Empresa
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div className="field">
              <label className="form-label">Nome da empresa <span style={{ color: '#e53e3e' }}>*</span></label>
              <input className="form-input" value={configForm.nome}
                onChange={e => setConfigForm(p => ({ ...p, nome: e.target.value }))}
                placeholder="Nome da empresa" />
            </div>
            <div className="field">
              <label className="form-label">CNPJ</label>
              <input className="form-input" value={configForm.cnpj}
                onChange={e => setConfigForm(p => ({ ...p, cnpj: maskCNPJ(e.target.value) }))}
                placeholder="00.000.000/0000-00" />
            </div>
            <div className="field">
              <label className="form-label">Telefone principal <span style={{ color: '#e53e3e' }}>*</span></label>
              <input className="form-input" type="tel" value={configForm.telefone}
                onChange={e => setConfigForm(p => ({ ...p, telefone: maskPhone(e.target.value) }))}
                placeholder="(XX) XXXXX-XXXX" />
            </div>
            <div className="field">
              <label className="form-label">WhatsApp (link flutuante)</label>
              <input className="form-input" type="tel" value={configForm.whatsapp}
                onChange={e => setConfigForm(p => ({ ...p, whatsapp: maskPhone(e.target.value) }))}
                placeholder="(XX) XXXXX-XXXX" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
            <div className="field">
              <label className="form-label">Endereço completo</label>
              <input className="form-input" value={configForm.endereco}
                onChange={e => setConfigForm(p => ({ ...p, endereco: e.target.value }))}
                placeholder="Rua, número, bairro" />
            </div>
            <div className="field">
              <label className="form-label">Cidade / Estado</label>
              <input className="form-input" value={configForm.cidade_estado}
                onChange={e => setConfigForm(p => ({ ...p, cidade_estado: e.target.value }))}
                placeholder="Ex: São Paulo - SP" />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 24 }}>
            <label className="form-label">Site (opcional)</label>
            <input className="form-input" type="url" value={configForm.site}
              onChange={e => setConfigForm(p => ({ ...p, site: e.target.value }))}
              placeholder="https://www.suaempresa.com.br" />
          </div>

          <h3 style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
            Seguradoras que você atende
          </h3>
          <div className="config-check-grid" style={{ marginBottom: 28 }}>
            {['Mapfre','Tempo','Maxpar','Allianz','Porto Seguro','Tokio Marine'].map(seg => (
              <div
                key={seg}
                className={`config-check-item${configForm.seguradoras.includes(seg) ? ' checked' : ''}`}
                onClick={() => toggleSeguradora(seg)}
              >
                <div className="config-check-box">
                  {configForm.seguradoras.includes(seg) && <span style={{ color: '#fff', fontSize: '.8rem', fontWeight: 700 }}>✓</span>}
                </div>
                <span className="config-check-label">{seg}</span>
              </div>
            ))}
          </div>

          <button className="btn-primary" onClick={saveConfig} disabled={savingConfig} style={{ padding: '10px 28px', fontSize: '.9rem' }}>
            {savingConfig ? '⏳ Salvando...' : '💾 Salvar dados'}
          </button>
        </div>
      )}

      {/* ── Sub-aba: Minha Conta ── */}
      {configAba === 'conta' && (
        <div style={{ maxWidth: 520 }}>
          <h3 style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
            Informações da Conta
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
            <div className="config-big-avatar">{inicialUsuario}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>
                Seu nome
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  value={nomeUsuario}
                  onChange={e => setNomeUsuario(e.target.value)}
                  placeholder="Seu nome completo"
                  style={{ flex: 1 }}
                />
                <button className="btn-sm btn-ok" onClick={saveNomeUsuario} disabled={savingNome} style={{ whiteSpace: 'nowrap' }}>
                  {savingNome ? '⏳' : '💾 Salvar'}
                </button>
              </div>
            </div>
          </div>

          <div className="config-info-row">
            <span className="config-info-label">E-mail</span>
            <span className="config-info-value">{emailUsuario || '—'}</span>
          </div>

          {auth.currentUser?.metadata?.creationTime && (
            <div className="config-info-row">
              <span className="config-info-label">Membro desde</span>
              <span className="config-info-value">
                {new Date(auth.currentUser.metadata.creationTime).toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}

          {/* Plano e Uso */}
          <div style={{ marginTop: 28 }}>
            <h3 style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
              Plano e Uso
            </h3>

            <div className="config-info-row">
              <span className="config-info-label">Plano atual</span>
              <span className="plan-badge">{planoAtual.charAt(0).toUpperCase() + planoAtual.slice(1)}</span>
            </div>
            <div className="config-info-row">
              <span className="config-info-label">Limite de OS/mês</span>
              <span className="config-info-value">
                {planoInfo.limiteOS === -1 ? '∞ Ilimitado' : planoInfo.limiteOS}
              </span>
            </div>
            <div className="config-info-row" style={{ borderBottom: planoInfo.limiteOS !== -1 ? '1px solid var(--border)' : 'none' }}>
              <span className="config-info-label">OS usadas este mês</span>
              <span className="config-info-value">{totalMes}</span>
            </div>

            {planoInfo.limiteOS !== -1 && (
              <div style={{ paddingTop: 10 }}>
                <div className="usage-bar-wrap">
                  <div className="usage-bar-track">
                    <div className={`usage-bar-fill ${usageCls}`} style={{ width: `${usagePct}%` }} />
                  </div>
                  <div className="usage-bar-labels">
                    <span>{totalMes} de {planoInfo.limiteOS} OS usadas</span>
                    <span>{usagePct}% do limite</span>
                  </div>
                </div>
                {usagePct >= 80 && (
                  <div style={{ background: usagePct >= 100 ? '#fff5f5' : '#fff8ec', border: `1px solid ${usagePct >= 100 ? '#fcc' : '#fce4b0'}`, borderRadius: 8, padding: '10px 14px', fontSize: '.82rem', color: usagePct >= 100 ? 'var(--danger)' : 'var(--warn-text)', fontWeight: 600, marginTop: 10 }}>
                    {usagePct >= 100
                      ? '🚫 Limite atingido — entre em contato para fazer upgrade do plano.'
                      : `⚠️ Você usou ${usagePct}% do limite. Considere fazer upgrade do plano.`
                    }
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Segurança */}
          <div style={{ marginTop: 28 }}>
            <h3 style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
              Segurança
            </h3>
            {resetEmailEnviado
              ? (
                <div style={{ background: 'var(--success-bg)', border: '1px solid #b2dfc5', borderRadius: 10, padding: '12px 16px', fontSize: '.88rem', color: 'var(--success)', fontWeight: 600 }}>
                  ✅ E-mail enviado! Verifique sua caixa de entrada.
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '.85rem', color: 'var(--muted)', marginBottom: 12 }}>
                    Um link de redefinição será enviado para <strong>{emailUsuario}</strong>.
                  </p>
                  <button className="btn-sm btn-view" onClick={sendResetEmail}>
                    🔑 Enviar link de redefinição de senha
                  </button>
                </div>
              )
            }
          </div>
        </div>
      )}
    </div>
  )
}
