import { describe, it, expect, vi, beforeEach } from 'vitest'

// EXCECAO DOCUMENTADA: vi.mock ao nivel do SDK e necessario para testar firebase.js internamente.
// Regra do CLAUDE.md "mock via vi.mock('../firebase')" se aplica a testes de componentes/hooks —
// nao a testes da propria camada de dados. Ver 02-RESEARCH.md secao "Pattern 2".
vi.mock('firebase/firestore', () => ({
  getFirestore:       vi.fn(() => ({})),
  collection:         vi.fn(() => 'mock-collection-ref'),
  addDoc:             vi.fn(),
  updateDoc:          vi.fn(),
  getDocs:            vi.fn(),
  setDoc:             vi.fn(),
  doc:                vi.fn(() => 'mock-doc-ref'),
  query:              vi.fn(() => 'mock-query'),
  where:              vi.fn(() => 'mock-where'),
  orderBy:            vi.fn(() => 'mock-order'),
  limit:              vi.fn(() => 'mock-limit'),
  serverTimestamp:    vi.fn(() => 'SERVERTIMESTAMP'),
  getCountFromServer: vi.fn(),
  Timestamp:          { now: vi.fn() },
}))

vi.mock('firebase/auth', () => ({
  getAuth:                        vi.fn(() => ({})),
  signInWithEmailAndPassword:     vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut:                        vi.fn(),
  onAuthStateChanged:             vi.fn(),
}))

vi.mock('firebase/storage', () => ({
  getStorage:     vi.fn(() => ({})),
  ref:            vi.fn(),
  uploadBytes:    vi.fn(),
  getDownloadURL: vi.fn(),
}))

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}))

import { addDoc, updateDoc, getDocs, setDoc, getCountFromServer } from 'firebase/firestore'
import {
  criarOS,
  atualizarOS,
  getOSdaEmpresa,
  getEmpresaBySlug,
  cadastrarEmpresa,
  contarOSdoMes,
} from '../firebase'

// DATA-01: criarOS
describe('criarOS', () => {
  beforeEach(() => {
    addDoc.mockResolvedValue({ id: 'new-os-id' })
  })

  it('chama addDoc e retorna o DocumentReference', async () => {
    const dados = { seguradora: 'Mapfre', nome_segurado: 'Joao Silva' }
    const result = await criarOS('emp-123', dados)
    expect(addDoc).toHaveBeenCalledOnce()
    expect(result.id).toBe('new-os-id')
  })

  it('inclui os campos do parametro dados no documento', async () => {
    const dados = { seguradora: 'Tempo', nome_segurado: 'Ana Lima' }
    await criarOS('emp-456', dados)
    const [, docArg] = addDoc.mock.calls[0]
    expect(docArg).toMatchObject({ seguradora: 'Tempo', nome_segurado: 'Ana Lima' })
  })

  it('adiciona criado_em via serverTimestamp ao documento', async () => {
    await criarOS('emp-123', { seguradora: 'Allianz' })
    const [, docArg] = addDoc.mock.calls[0]
    expect(docArg.criado_em).toBeDefined()
  })
})

// DATA-02: atualizarOS
describe('atualizarOS', () => {
  beforeEach(() => {
    updateDoc.mockResolvedValue(undefined)
  })

  it('chama updateDoc exatamente uma vez', async () => {
    await atualizarOS('emp-123', 'os-456', { status: 'processado' })
    expect(updateDoc).toHaveBeenCalledOnce()
  })

  it('passa os dados fornecidos para updateDoc', async () => {
    const dados = { status: 'finalizado', observacoes: 'Concluido' }
    await atualizarOS('emp-123', 'os-789', dados)
    const [, updateArg] = updateDoc.mock.calls[0]
    expect(updateArg).toMatchObject(dados)
  })
})

// DATA-03: getOSdaEmpresa
describe('getOSdaEmpresa', () => {
  it('retorna array mapeado de documentos quando ha OS', async () => {
    // Shape critica: { docs: [{ id, data: () => ({}) }] }
    // NAO retornar [] diretamente — snap.docs.map seria "not a function"
    getDocs.mockResolvedValue({
      docs: [
        { id: 'os-1', data: () => ({ seguradora: 'Mapfre', status: 'pendente' }) },
        { id: 'os-2', data: () => ({ seguradora: 'Tempo',  status: 'processado' }) },
      ],
    })
    const result = await getOSdaEmpresa('emp-123')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ id: 'os-1', seguradora: 'Mapfre', status: 'pendente' })
    expect(result[1]).toEqual({ id: 'os-2', seguradora: 'Tempo',  status: 'processado' })
  })

  it('retorna array vazio quando nao ha OS', async () => {
    getDocs.mockResolvedValue({ docs: [] })
    const result = await getOSdaEmpresa('emp-999')
    expect(result).toHaveLength(0)
  })

  it('chama getDocs exatamente uma vez por chamada', async () => {
    getDocs.mockResolvedValue({ docs: [] })
    await getOSdaEmpresa('emp-123')
    expect(getDocs).toHaveBeenCalledOnce()
  })
})

// DATA-04: getEmpresaBySlug
describe('getEmpresaBySlug', () => {
  it('retorna dados da empresa quando slug e encontrado', async () => {
    // Shape critica: { empty: false, docs: [{ id, data: () => ({}) }] }
    getDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'emp-123', data: () => ({ nome: 'Empresa Teste', slug: 'teste', ativo: true }) }],
    })
    const result = await getEmpresaBySlug('teste')
    expect(result).toEqual({ id: 'emp-123', nome: 'Empresa Teste', slug: 'teste', ativo: true })
  })

  it('retorna null quando slug nao existe (snap.empty === true)', async () => {
    getDocs.mockResolvedValue({ empty: true, docs: [] })
    const result = await getEmpresaBySlug('slug-inexistente')
    expect(result).toBeNull()
  })
})

// DATA-05: cadastrarEmpresa
describe('cadastrarEmpresa', () => {
  beforeEach(() => {
    setDoc.mockResolvedValue(undefined)
  })

  it('chama setDoc exatamente 2 vezes (documento empresa + documento config)', async () => {
    await cadastrarEmpresa(
      'emp-123',
      { nome: 'Empresa Teste', plano: 'basico' },
      { telefone: '(11) 9999-9999', seguradoras: ['Mapfre'], logoUrl: '', corPrimaria: '#000' }
    )
    expect(setDoc).toHaveBeenCalledTimes(2)
  })

  it('primeira chamada ao setDoc inclui ativo: true', async () => {
    await cadastrarEmpresa(
      'emp-123',
      { nome: 'Empresa Teste', plano: 'basico' },
      { telefone: '(11) 9999-9999', seguradoras: ['Mapfre'], logoUrl: '', corPrimaria: '#000' }
    )
    const [, primeiroDoc] = setDoc.mock.calls[0]
    expect(primeiroDoc).toMatchObject({ nome: 'Empresa Teste', ativo: true })
  })

  it('primeira chamada ao setDoc inclui criadoEm via serverTimestamp', async () => {
    await cadastrarEmpresa(
      'emp-123',
      { nome: 'Empresa Teste', plano: 'basico' },
      { telefone: '(11) 9999-9999', seguradoras: ['Mapfre'], logoUrl: '', corPrimaria: '#000' }
    )
    const [, primeiroDoc] = setDoc.mock.calls[0]
    expect(primeiroDoc.criadoEm).toBeDefined()
  })

  it('segunda chamada ao setDoc inclui dados de config', async () => {
    await cadastrarEmpresa(
      'emp-123',
      { nome: 'Empresa Teste', plano: 'basico' },
      { telefone: '(11) 9999-9999', seguradoras: ['Mapfre'], logoUrl: 'logo.png', corPrimaria: '#fff' }
    )
    const [, segundoDoc] = setDoc.mock.calls[1]
    expect(segundoDoc).toMatchObject({ nome: 'Empresa Teste', telefone: '(11) 9999-9999' })
  })
})

// DATA-06: contarOSdoMes (satisfaz DATA-06 — verificarLimite e deferido para Phase 3)
// NOTA: verificarLimite esta em useEmpresa.js (React hook), nao em firebase.js.
// contarOSdoMes e a funcao de firebase.js que alimenta o limite. Testada aqui.
// verificarLimite sera testada na Phase 3 junto com os demais hooks.
describe('contarOSdoMes', () => {
  it('retorna o count retornado por getCountFromServer', async () => {
    // Shape critica: { data: () => ({ count: N }) }
    // NAO retornar { count: N } diretamente — snap.data() seria "not a function"
    getCountFromServer.mockResolvedValue({ data: () => ({ count: 37 }) })
    const count = await contarOSdoMes('emp-123')
    expect(count).toBe(37)
  })

  it('retorna 0 quando nao ha OS no mes', async () => {
    getCountFromServer.mockResolvedValue({ data: () => ({ count: 0 }) })
    const count = await contarOSdoMes('emp-123')
    expect(count).toBe(0)
  })

  it('chama getCountFromServer exatamente uma vez', async () => {
    getCountFromServer.mockResolvedValue({ data: () => ({ count: 5 }) })
    await contarOSdoMes('emp-123')
    expect(getCountFromServer).toHaveBeenCalledOnce()
  })
})
