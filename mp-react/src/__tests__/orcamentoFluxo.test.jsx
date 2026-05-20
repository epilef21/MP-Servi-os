import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Padrão C — vi.mock ANTES de qualquer import de '../firebase' ou módulos externos

vi.mock('../firebase', () => ({
  auth: {},
  db: {},
  onAuthStateChanged: vi.fn((auth, cb) => { cb(null); return () => {} }),
  doc: vi.fn((db, ...path) => `mock-ref:${path.join('/')}`),
  getDoc: vi.fn(),
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

vi.mock('react-signature-canvas', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  return {
    default: forwardRef((props, ref) => {
      useImperativeHandle(ref, () => ({
        toDataURL: () => 'data:image/png;base64,ASSINATURA',
        isEmpty: () => false,
        clear: vi.fn(),
      }))
      return <canvas data-testid="assinatura" onClick={() => props.onEnd?.()} />
    })
  }
})

vi.mock('browser-image-compression', () => ({
  default: vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/jpeg' }))
}))

vi.mock('../utils/validarUpload', () => ({
  validarUpload: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../utils/comprimirImagem', () => ({
  comprimirImagem: vi.fn().mockImplementation(f => Promise.resolve(f))
}))

// imports DEPOIS do vi.mock — Padrão C obrigatório
import { getDoc, updateDoc, getEmpresaBySlug, getConfigEmpresa } from '../firebase'
import { _clearCacheForTest } from '../hooks/useEmpresa'
import OrcamentoTecnicoPage from '../pages/OrcamentoTecnicoPage'
import AprovarOrcamentoPage from '../pages/AprovarOrcamentoPage'

// ── Dados de empresa padrão para todos os testes ────────────────────────────
const EMPRESA_TESTE = {
  id: 'emp-test-1',
  nome: 'Empresa Teste',
  slug: 'empresa-teste',
  ativo: true,
  plano: 'basico',
}

// ── Helper: configura mocks de empresa e renderiza com rota parametrizada ───
function renderOrcamento(Componente, snapRetorno) {
  getEmpresaBySlug.mockResolvedValue(EMPRESA_TESTE)
  getConfigEmpresa.mockResolvedValue({ nome: 'Empresa Teste' })
  getDoc.mockResolvedValue(snapRetorno)

  return render(
    <MemoryRouter initialEntries={['/empresa-teste/orc-123']}>
      <Routes>
        <Route path="/:slug/:orcamentoId" element={<Componente />} />
      </Routes>
    </MemoryRouter>
  )
}

// ── Limpar cache de useEmpresa antes de cada teste (Pitfall 6) ───────────────
beforeEach(() => {
  _clearCacheForTest()
})

// ── Snap de orçamento aguardando_tecnico (ORC-01..03) ───────────────────────
const snapTecnico = {
  exists: () => true,
  id: 'orc-123',
  data: () => ({
    status: 'aguardando_tecnico',
    nome_cliente: 'João Silva',
    tel_cliente: '11999990000',
    endereco: 'Rua Teste',
    cidade: 'São Paulo',
    tipo: 'eletrico',
    itens: [],
    diagnostico: '',
    fotos: [],
  }),
}

// ── Snap de orçamento enviado_cliente (ORC-04..06) ──────────────────────────
const snapCliente = {
  exists: () => true,
  id: 'orc-123',
  data: () => ({
    status: 'enviado_cliente',
    nome_cliente: 'Maria Santos',
    tel_cliente: '11888880000',
    endereco: 'Av. Brasil, 200',
    cidade: 'Rio de Janeiro',
    tipo: 'eletrico',
    itens: [
      { id: 'i1', descricao: 'Serviço de instalação', quantidade: 1, valor_unit: 150, valor_total: 150, paga_cliente: 150 }
    ],
    total_geral: 150,
    diagnostico: 'Cabo partido',
  }),
}

// ── ORC-01: Técnico visualiza formulário de orçamento ───────────────────────

describe('ORC-01: técnico visualiza formulário de orçamento', () => {
  it('renderiza OrcamentoTecnicoPage sem crash com orçamento aguardando_tecnico', async () => {
    renderOrcamento(OrcamentoTecnicoPage, snapTecnico)

    // Aguardar carregamento: useEmpresa resolve → getDoc resolve → formulário visível
    await waitFor(() => {
      expect(screen.queryByText('Carregando orçamento...')).not.toBeInTheDocument()
    })

    // nome_cliente é renderizado em <input readOnly> — usar getByDisplayValue
    expect(screen.getByDisplayValue('João Silva')).toBeInTheDocument()
  })
})

// ── ORC-02: Técnico preenche o diagnóstico no formulário ────────────────────
// Nota: OrcamentoTecnicoPage não possui canvas de assinatura.
// ORC-02 cobre a edição do campo de diagnóstico — principal entrada do formulário técnico.

describe('ORC-02: técnico pode preencher o diagnóstico do orçamento', () => {
  it('campo de diagnóstico aceita input após carregamento do formulário', async () => {
    renderOrcamento(OrcamentoTecnicoPage, snapTecnico)

    await waitFor(() => {
      expect(screen.queryByText('Carregando orçamento...')).not.toBeInTheDocument()
    })

    const user = userEvent.setup()

    // Localizar o textarea de diagnóstico pelo placeholder definido no componente
    const textarea = screen.getByPlaceholderText(/Descreva detalhadamente o problema/i)
    await user.type(textarea, 'Curto-circuito no quadro elétrico')

    expect(textarea).toHaveValue('Curto-circuito no quadro elétrico')
  })
})

// ── ORC-03: Orçamento salvo com status em_revisao ───────────────────────────

describe('ORC-03: orçamento é salvo com status em_revisao', () => {
  it('updateDoc é chamado com status: em_revisao ao submeter o formulário técnico', async () => {
    renderOrcamento(OrcamentoTecnicoPage, snapTecnico)

    // Aguardar carregamento completo
    await waitFor(() => {
      expect(screen.queryByText('Carregando orçamento...')).not.toBeInTheDocument()
    })

    const user = userEvent.setup()

    // Preencher diagnóstico (obrigatório pela validação do componente)
    const textarea = screen.getByPlaceholderText(/Descreva detalhadamente o problema/i)
    await user.type(textarea, 'Cabo partido na tomada')

    // Preencher item obrigatório — descrição e valor unit
    const inputDescricao = screen.getByPlaceholderText(/Ex: Compressor/i)
    await user.clear(inputDescricao)
    await user.type(inputDescricao, 'Troca de cabo')

    const inputValor = screen.getByPlaceholderText('0,00')
    await user.clear(inputValor)
    await user.type(inputValor, '50')

    // Clicar no botão de submit — texto exato confirmado no componente
    const btnSubmit = screen.getByRole('button', { name: /Enviar para Revisão do Admin/i })
    await user.click(btnSubmit)

    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'em_revisao' })
      )
    })
  })
})

// ── ORC-04: Cliente visualiza orçamento na página de aprovação ───────────────

describe('ORC-04: cliente visualiza orçamento na página de aprovação', () => {
  it('renderiza AprovarOrcamentoPage com dados do orçamento enviado_cliente', async () => {
    renderOrcamento(AprovarOrcamentoPage, snapCliente)

    await waitFor(() => {
      expect(screen.queryByText('Carregando orçamento...')).not.toBeInTheDocument()
    })

    // Verificar que dados do cliente estão visíveis
    expect(screen.getByText(/Maria Santos/i)).toBeInTheDocument()
  })
})

// ── ORC-05: Cliente preenche nome e assina para aprovar ─────────────────────

describe('ORC-05: cliente preenche nome e assina para aprovar', () => {
  it('permite preencher nome e acionar o canvas de assinatura', async () => {
    renderOrcamento(AprovarOrcamentoPage, snapCliente)

    await waitFor(() => {
      expect(screen.queryByText('Carregando orçamento...')).not.toBeInTheDocument()
    })

    const user = userEvent.setup()

    // Preencher nome — placeholder confirmado no componente: "Digite seu nome completo"
    const inputNome = screen.getByPlaceholderText('Digite seu nome completo')
    await user.type(inputNome, 'Maria Santos')

    // Assinar — clique no canvas dispara onEnd → hasSig=true (Pitfall 3)
    await user.click(screen.getByTestId('assinatura'))

    // Verificar estado pós-interação
    expect(inputNome).toHaveValue('Maria Santos')
    expect(screen.getByTestId('assinatura')).toBeInTheDocument()
  })
})

// ── ORC-06: Aprovação atualiza status no Firestore ──────────────────────────

describe('ORC-06: orçamento aprovado atualiza status no Firestore', () => {
  it('updateDoc é chamado com status: aprovado, aprovado_por e assinatura_cliente', async () => {
    renderOrcamento(AprovarOrcamentoPage, snapCliente)

    await waitFor(() => {
      expect(screen.queryByText('Carregando orçamento...')).not.toBeInTheDocument()
    })

    const user = userEvent.setup()

    // Preencher nome (obrigatório para handleAprovar não bloquear com "Informe seu nome completo")
    const inputNome = screen.getByPlaceholderText('Digite seu nome completo')
    await user.type(inputNome, 'Maria Santos')

    // Assinar (hasSig=true — obrigatório para handleAprovar não bloquear com "Assine para confirmar")
    // O mock do canvas chama props.onEnd?.() no onClick → setHasSig(true) (Pitfall 3)
    await user.click(screen.getByTestId('assinatura'))

    // Clicar em aprovar — texto exato confirmado no componente: "✅ Aprovar e Assinar"
    const btnAprovar = screen.getByRole('button', { name: /Aprovar e Assinar/i })
    await user.click(btnAprovar)

    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'aprovado',
          aprovado_por: 'Maria Santos',
          assinatura_cliente: 'data:image/png;base64,ASSINATURA',
        })
      )
    })
  })
})
