import { vi } from 'vitest'

// Factory function — chame no beforeEach de cada arquivo de teste para
// garantir vi.fn() frescos e isolamento completo entre testes.
export function createFirebaseMocks() {
  return {
    // Instâncias dos serviços (objetos vazios — nunca usam a rede)
    db: {},
    storage: {},
    auth: {},

    // Auth — mock síncrono crítico: chama cb(null) imediatamente
    // Retorna unsubscribe como () => {} para evitar TypeError no cleanup
    onAuthStateChanged: vi.fn((auth, cb) => {
      cb(null)
      return () => {}
    }),
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),

    // Firestore — operações de leitura
    getDocs: vi.fn(),
    getDoc: vi.fn(),
    getCountFromServer: vi.fn(),

    // Firestore — operações de escrita
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    setDoc: vi.fn(),
    deleteDoc: vi.fn(),

    // Firestore — helpers de query e referência
    collection: vi.fn(),
    doc: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),

    // Firestore — server timestamp
    serverTimestamp: vi.fn(() => ({ toDate: () => new Date('2024-01-15') })),

    // Storage
    storageRef: vi.fn(),
    uploadBytes: vi.fn(),
    getDownloadURL: vi.fn(),

    // Constantes e utilitários
    SUPERADMIN_EMAIL: 'superadmin@test.com',
    PLANOS: {
      basico:     { limiteOS: 50,  preco: 97  },
      pro:        { limiteOS: -1,  preco: 197 },
      enterprise: { limiteOS: -1,  preco: 397 },
    },
    refChecklist: vi.fn(),
    refConfig: vi.fn(),
    getEmpresaBySlug: vi.fn().mockResolvedValue(null),
    getConfigEmpresa: vi.fn().mockResolvedValue({}),
  }
}
