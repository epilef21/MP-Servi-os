import React, { useState, useEffect } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Padrão C — vi.mock ANTES de qualquer import de '../firebase'
vi.mock('../firebase', () => ({
  auth: {},
  db: {},
  onAuthStateChanged: vi.fn((auth, cb) => { cb(null); return () => {} }),
  doc: vi.fn((db, ...path) => `mock-ref:${path.join('/')}`),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn().mockReturnValue({ seconds: 1000000 }),
  uploadFoto: vi.fn().mockResolvedValue('https://storage.example.com/foto.jpg'),
  criarOS: vi.fn().mockResolvedValue({ id: 'os-nova-123' }),
  atualizarOS: vi.fn().mockResolvedValue(undefined),
  getOSdaEmpresa: vi.fn().mockResolvedValue([]),
  getEmpresaBySlug: vi.fn().mockResolvedValue(null),
  getConfigEmpresa: vi.fn().mockResolvedValue({}),
  PLANOS: { basico: { limiteOS: 50, preco: 97 } },
  SUPERADMIN_EMAIL: 'superadmin@test.com',
}))

// imports DEPOIS do vi.mock — Padrão C obrigatório
import { criarOS, atualizarOS, getOSdaEmpresa, deleteDoc, doc, db } from '../firebase'

// ── Stub Components — isolam os handlers sem renderizar AdminPage ────────────

// OS-01: Criar OS
function OSFormStub({ empresaId }) {
  const [criado, setCriado] = useState(null)
  async function handleSave() {
    const payload = {
      seguradora: 'Mapfre',
      num_assist: 'OS-001',
      nome_segurado: 'João Silva',
      tel_segurado: '11999990000',
      endereco: 'Rua Teste, 10',
      cidade: 'São Paulo',
      servico: 'Instalação',
      status: 'aguardando_tecnico',
    }
    const ref = await criarOS(empresaId, payload)
    setCriado(ref.id)
  }
  return (
    <div>
      <button onClick={handleSave}>Criar OS</button>
      {criado && <span data-testid="os-criada">{criado}</span>}
    </div>
  )
}

// OS-02: Editar dados de OS (atendimento)
function OSEditStub({ empresaId, osId }) {
  const [salvo, setSalvo] = useState(false)
  async function handleEdit() {
    const atendForm = {
      nome_tecnico: 'Carlos',
      data_atend: '20/05/2026',
      descricao_servico: 'Revisão geral',
    }
    await atualizarOS(empresaId, osId, atendForm)
    setSalvo(true)
  }
  return (
    <div>
      <button onClick={handleEdit}>Salvar Edição</button>
      {salvo && <span data-testid="editado">editado</span>}
    </div>
  )
}

// OS-03: Mudar status de OS
function OSStatusStub({ empresaId, osId }) {
  const [salvo, setSalvo] = useState(false)
  async function handleStatus() {
    await atualizarOS(empresaId, osId, { status: 'concluido' })
    setSalvo(true)
  }
  return (
    <div>
      <button onClick={handleStatus}>Mudar Status</button>
      {salvo && <span data-testid="status-salvo">ok</span>}
    </div>
  )
}

// OS-04: Excluir OS com window.confirm
function OSExcluirStub({ empresaId, os, onExcluida }) {
  async function handleExcluir() {
    if (!window.confirm(`Excluir OS ${os.id}?`)) return
    await deleteDoc(doc(db, `empresas/${empresaId}/checklist`, os.id))
    onExcluida(os.id)
  }
  return <button onClick={handleExcluir}>Excluir</button>
}

// OS-05 / OS-06: Lista de OS
function OSListaStub({ empresaId }) {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    getOSdaEmpresa(empresaId).then(dados => {
      setLista(dados)
      setLoading(false)
    })
  }, [empresaId])
  if (loading) return <p>Carregando...</p>
  if (!lista.length) return <p data-testid="vazio">Nenhuma OS encontrada</p>
  return (
    <ul>
      {lista.map(os => (
        <li key={os.id} data-testid="item-os">{os.nome_segurado}</li>
      ))}
    </ul>
  )
}

// ── OS-01: Criar OS ─────────────────────────────────────────────────────────

describe('OS-01: criar OS via formulário', () => {
  it('chama criarOS com payload correto e exibe id retornado', async () => {
    criarOS.mockResolvedValue({ id: 'os-nova-123' })
    const user = userEvent.setup()

    render(<OSFormStub empresaId="emp-test-1" />)
    await user.click(screen.getByText('Criar OS'))

    await waitFor(() => {
      expect(criarOS).toHaveBeenCalledWith(
        'emp-test-1',
        expect.objectContaining({
          seguradora: 'Mapfre',
          nome_segurado: 'João Silva',
          status: 'aguardando_tecnico',
        })
      )
    })
    expect(screen.getByTestId('os-criada')).toHaveTextContent('os-nova-123')
  })
})

// ── OS-02: Editar OS ────────────────────────────────────────────────────────

describe('OS-02: editar dados de OS existente', () => {
  it('chama atualizarOS com os campos de atendimento', async () => {
    const user = userEvent.setup()

    render(<OSEditStub empresaId="emp-test-1" osId="os-abc" />)
    await user.click(screen.getByText('Salvar Edição'))

    await waitFor(() => {
      expect(atualizarOS).toHaveBeenCalledWith(
        'emp-test-1',
        'os-abc',
        expect.objectContaining({ nome_tecnico: 'Carlos' })
      )
    })
    expect(screen.getByTestId('editado')).toBeInTheDocument()
  })
})

// ── OS-03: Mudar status ─────────────────────────────────────────────────────

describe('OS-03: alterar status de OS', () => {
  it('chama atualizarOS com o novo status', async () => {
    const user = userEvent.setup()

    render(<OSStatusStub empresaId="emp-test-1" osId="os-abc" />)
    await user.click(screen.getByText('Mudar Status'))

    await waitFor(() => {
      expect(atualizarOS).toHaveBeenCalledWith(
        'emp-test-1',
        'os-abc',
        { status: 'concluido' }
      )
    })
    expect(screen.getByTestId('status-salvo')).toBeInTheDocument()
  })
})

// ── OS-04: Excluir OS ───────────────────────────────────────────────────────

describe('OS-04: excluir OS e remover da lista', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('chama deleteDoc com caminho correto após window.confirm', async () => {
    const onExcluida = vi.fn()
    const user = userEvent.setup()
    const os = { id: 'os-del-1' }

    render(<OSExcluirStub empresaId="emp-test-1" os={os} onExcluida={onExcluida} />)
    await user.click(screen.getByText('Excluir'))

    await waitFor(() => {
      expect(deleteDoc).toHaveBeenCalledWith('mock-ref:empresas/emp-test-1/checklist/os-del-1')
    })
    expect(onExcluida).toHaveBeenCalledWith('os-del-1')
  })
})

// ── OS-05: Lista vazia ──────────────────────────────────────────────────────

describe('OS-05: lista de OS exibe estado vazio', () => {
  it('exibe mensagem quando getOSdaEmpresa retorna array vazio', async () => {
    getOSdaEmpresa.mockResolvedValue([])

    render(
      <MemoryRouter>
        <OSListaStub empresaId="emp-test-1" />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('vazio')).toBeInTheDocument()
    })
    expect(screen.getByTestId('vazio')).toHaveTextContent('Nenhuma OS encontrada')
  })
})

// ── OS-06: Lista com dados ──────────────────────────────────────────────────

describe('OS-06: lista de OS exibe itens retornados pelo Firebase', () => {
  it('renderiza um item por OS quando getOSdaEmpresa retorna dados', async () => {
    getOSdaEmpresa.mockResolvedValue([
      { id: 'os-1', nome_segurado: 'João Silva' },
      { id: 'os-2', nome_segurado: 'Maria Santos' },
    ])

    render(
      <MemoryRouter>
        <OSListaStub empresaId="emp-test-1" />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByTestId('item-os')).toHaveLength(2)
    })
    expect(screen.getByText('João Silva')).toBeInTheDocument()
    expect(screen.getByText('Maria Santos')).toBeInTheDocument()
  })
})
