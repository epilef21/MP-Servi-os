// ============================================================
// tarifas.js — Tabelas de preço por seguradora + utilitários
// ============================================================

// Tabela Residencial Mapfre — Versão 7 / 2024
// Fonte: documento assinado via DocuSign
// id: número do item na tabela
// visita: taxa de visita/saída (R$)
// mo: mão de obra principal (R$)
// pontoAdicional: valor por ponto extra além do 1º (null = não se aplica)
export const TABELA_MAPFRE = [
  { id: '01', servico: 'Encanador',                          descricao: 'Encanador (somente mão de obra)',                                                           visita: 45, mo: 75,  pontoAdicional: 50  },
  { id: '02', servico: 'Eletricista',                        descricao: 'Eletricista (somente mão de obra)',                                                          visita: 45, mo: 70,  pontoAdicional: 50  },
  { id: '03', servico: 'Desentupimento (simples)',           descricao: 'Desentupimento simples (ralo, vaso, etc.)',                                                   visita: 45, mo: 120, pontoAdicional: 80  },
  { id: '04', servico: 'Desentupimento — Caixa de Esgoto',  descricao: 'Desentupimento/Limpeza (Caixa Esgoto). Sem valor adicional por uso de Rotor Rooter.',        visita: 45, mo: 150, pontoAdicional: 100 },
  { id: '05', servico: 'Desentupimento — Caixa de Gordura', descricao: 'Desentupimento/Limpeza (Caixa de Gordura). Sem valor adicional por metragem de mola.',       visita: 45, mo: 150, pontoAdicional: 100 },
  { id: '06', servico: 'Cobertura Provisória',               descricao: 'Cobertura Provisória (serviço mínimo até 5 metros)',                                         visita: 45, mo: 120, pontoAdicional: 4   },
  { id: '07', servico: 'Caça-Vazamento',                     descricao: 'Caça-Vazamento com aparelho detector. Mínimo 1h de mão de obra.',                            visita: 45, mo: 350, pontoAdicional: null },
  { id: '08', servico: 'Vigia/Segurança',                    descricao: 'Vigia/Segurança Não Armada — por hora (mínimo garantido: 6 horas)',                          visita: 45, mo: 180, pontoAdicional: 30  },
  { id: '09', servico: 'Vidraceiro',                         descricao: 'Vidraceiro até 1m² (somente mão de obra). Material por conta do segurado.',                  visita: 45, mo: 80,  pontoAdicional: null },
  { id: '10', servico: 'Chaveiro — Yale',                    descricao: 'Abertura + Confecção Yale (perda ou quebra de chave)',                                        visita: 45, mo: 90,  pontoAdicional: 60  },
  { id: '11', servico: 'Chaveiro — Tetra',                   descricao: 'Abertura + Confecção Tetra (perda ou quebra de chave)',                                       visita: 45, mo: 130, pontoAdicional: 70  },
  { id: '12', servico: 'Chaveiro — Roubo/Furto',             descricao: 'Troca de Segredo / Substituição de Fechadura (Yale ou Tetra)',                                visita: 45, mo: 150, pontoAdicional: 80  },
  { id: '13', servico: 'Fechadura Eletrônica',               descricao: 'Instalação de Fechadura Eletrônica',                                                          visita: 45, mo: 275, pontoAdicional: null },
  { id: '14', servico: 'Saída Falida',                       descricao: 'Saída Falida (serviço não coberto, segurado ausente ou orçamento não autorizado)',            visita: 45, mo: 0,   pontoAdicional: null },
  { id: '16', servico: 'Manutenção AC Residencial',          descricao: 'Manutenção Preventiva de Ar-Condicionado Residencial (até 30.000 BTUs). Instalação: R$350/aparelho.', visita: 45, mo: 150, pontoAdicional: 100 },
  { id: '17', servico: 'Linha Branca',                       descricao: 'Reparo de Eletrodomésticos Danificados (Geladeira, Freezer, Fogão, Máquina de Lavar, etc.). MO máx R$130.', visita: 65, mo: 85,  pontoAdicional: null },
  { id: '18', servico: 'Linha Marrom — Som/Imagem',          descricao: 'Reparo de Equipamentos de Som e Imagem (TV, DVD, Aparelho de Som). MO máx R$130. Sem fornecimento de peças.', visita: 65, mo: 85,  pontoAdicional: null },
  { id: '19', servico: 'Interfone',                          descricao: 'Reparo/Instalação de Interfone',                                                              visita: 45, mo: 180, pontoAdicional: null },
  { id: '20', servico: 'Reparo Emergencial de Portas',       descricao: 'Instalação de Porta (Reparo Emergencial de Portas/Janelas)',                                  visita: 45, mo: 100, pontoAdicional: 100 },
  { id: '21', servico: 'Instalação de Fogões/Cooktop',       descricao: 'Instalação de Fogões e Cooktop',                                                              visita: 45, mo: 130, pontoAdicional: 130 },
  { id: '22', servico: 'Limpeza/Remoção de Entulhos',        descricao: 'Limpeza, Remoção e Entulhos (condicionado a envio de orçamento)',                            visita: 45, mo: 0,   pontoAdicional: null },
  { id: '23', servico: 'Limpeza de Placa Solar',             descricao: 'Serviço de Limpeza de Placa Solar',                                                          visita: 45, mo: 0,   pontoAdicional: null },
  { id: '24', servico: 'Limpeza Geral de Residência',        descricao: 'Serviço de Limpeza Geral de Residência',                                                     visita: 45, mo: 0,   pontoAdicional: null },
  { id: '25', servico: 'Instalação/Reparação de Gás',        descricao: 'Instalação/Reparação de Gás',                                                                visita: 45, mo: 0,   pontoAdicional: null },
  { id: '26', servico: 'Extintores — Recarga de Gás',        descricao: 'Verificação de Extintores — Extintores (Recarga de Gás)',                                    visita: 45, mo: 600, pontoAdicional: null },
  { id: '27', servico: 'Manutenção de Extintores',           descricao: 'Verificação de Extintores — Manutenção de Extintores',                                       visita: 45, mo: 120, pontoAdicional: null },
  { id: '29', servico: 'Revisão Elétrica',                   descricao: 'Verificação de pontos de iluminação, força (tomadas e interruptores) e quadro de distribuição interno', visita: 45, mo: 70,  pontoAdicional: null },
  { id: '30', servico: 'Revisão Hidráulica',                 descricao: 'Verificação de torneiras, boia de caixa d\'água, válvula de descarga, registros, sifões e flexíveis', visita: 45, mo: 70,  pontoAdicional: null },
  { id: '31', servico: 'Caçamba',                            descricao: 'Locação de caçamba de até 4m³. Até 05 dias corridos.',                                       visita: 70, mo: 315, pontoAdicional: null },
  { id: '32', servico: 'Retirada de Entulho (MO)',           descricao: 'Mão de obra para retirada de entulho existente na residência',                               visita: 45, mo: 0,   pontoAdicional: null },
  { id: '33', servico: 'Limpeza de Caixa d\'Água',           descricao: 'Limpeza interna de caixa d\'água (até 2.000 litros). Ponto adicional a cada 1.000 litros.',  visita: 45, mo: 100, pontoAdicional: 50  },
  { id: '34', servico: 'Fixação de Quadros',                 descricao: 'Fixação em paredes de alvenaria (sem material). Até 02 unidades.',                          visita: 45, mo: 70,  pontoAdicional: 20  },
  { id: '35', servico: 'Fixação de Prateleiras',             descricao: 'Fixação em paredes de alvenaria (sem material). Até 02 unidades.',                          visita: 45, mo: 70,  pontoAdicional: 20  },
  { id: '36', servico: 'Fixação de Persianas',               descricao: 'Fixação em paredes de alvenaria (sem material). Até 02 unidades.',                          visita: 45, mo: 70,  pontoAdicional: 20  },
  { id: '37', servico: 'Fixação de Cortinas/Trilho',         descricao: 'Fixação de Cortinas/Trilho de Cortina em paredes de alvenaria (sem material). Até 02 unidades.', visita: 45, mo: 70,  pontoAdicional: 20  },
  { id: '38', servico: 'Fixação de Varal de Teto',           descricao: 'Fixação de Varal de Teto em paredes de alvenaria (sem material). Até 01 unidade.',          visita: 45, mo: 70,  pontoAdicional: 45  },
  { id: '39', servico: 'Instalação de Olho Mágico',          descricao: 'Instalação de olho mágico em porta de madeira (sem material). Até 01 unidade.',             visita: 45, mo: 70,  pontoAdicional: 15  },
  { id: '40', servico: 'Suporte de TV/Micro-ondas',          descricao: 'Instalação/Fixação de Suportes de TVs e Micro-ondas em parede de alvenaria (sem material). Até 01 unidade.', visita: 45, mo: 70,  pontoAdicional: 30  },
  { id: '41', servico: 'Fixação de Ganchos',                 descricao: 'Instalação/Fixação de Ganchos em paredes de alvenaria (sem material). Até 03 unidades.',   visita: 45, mo: 70,  pontoAdicional: 15  },
  { id: '42', servico: 'Fixação de Itens Decoração',         descricao: 'Instalação/Fixação de Itens de utensílio e decoração em paredes de alvenaria (sem material). Até 02 unidades.', visita: 45, mo: 70,  pontoAdicional: null },
  { id: '43', servico: 'Vedante/Rodo de Porta',              descricao: 'Instalação de vedante/rodo de porta de entrada',                                             visita: 45, mo: 70,  pontoAdicional: 10  },
  { id: '44', servico: 'Instalação de Mosqueteiro',          descricao: 'Instalação em Geral — Instalação de Mosqueteiro',                                            visita: 45, mo: 70,  pontoAdicional: null },
  { id: '45', servico: 'Película de Box',                    descricao: 'Instalação em Geral — Instalação de Película de Box',                                        visita: 45, mo: 350, pontoAdicional: null },
  { id: '46', servico: 'Rede de Proteção',                   descricao: 'Instalação em Geral — Instalação de Rede de Proteção',                                      visita: 45, mo: 400, pontoAdicional: null },
  { id: '47', servico: 'Limpeza de Calhas',                  descricao: 'Limpeza de calhas — até 16 metros lineares e no máximo 3,5m de altura. Ponto por metro.',   visita: 45, mo: 80,  pontoAdicional: 4   },
  { id: '48', servico: 'Troca de Reatores',                  descricao: 'Substituição de reatores (instalação elétrica compatível). Sem material. Até 01 unidade.',   visita: 45, mo: 70,  pontoAdicional: 30  },
  { id: '49', servico: 'Troca de Lâmpadas',                  descricao: 'Substituição de lâmpadas — até 03 unidades.',                                               visita: 45, mo: 70,  pontoAdicional: 5   },
  { id: '50', servico: 'Mudança de Móveis',                  descricao: 'Mudança de móveis de um cômodo para outro (simples, sem desmontagem). Até 01 unidade.',     visita: 45, mo: 100, pontoAdicional: 50  },
  { id: '51', servico: 'Limpeza de Ralos e Sifões',          descricao: 'Limpeza simples de Ralos e Sifões (sem equipamentos mecânicos). Até 01 unidade.',           visita: 45, mo: 70,  pontoAdicional: 30  },
  { id: '52', servico: 'Fixação/Retirada de Antena',         descricao: 'Fixação de suporte e antena (sem materiais, cabos ou sintonia fina). Até 01 ponto.',        visita: 45, mo: 150, pontoAdicional: 50  },
  { id: '53', servico: 'Instalação de Antenas',              descricao: 'Instalação de Antenas/Assistência (exceto TV a Cabo). Fixação ou retirada + passagem de cabos. Até 01 ponto.', visita: 45, mo: 150, pontoAdicional: 50  },
  { id: '54', servico: 'Rejuntamento',                       descricao: 'Rejuntamento em azulejos ou pisos — até 05m². Sem material. Ponto adicional por m².',       visita: 45, mo: 80,  pontoAdicional: 8   },
  { id: '55', servico: 'Troca de Telhas (Cerâmica)',         descricao: 'Somente mão de obra — até 10 peças tipo cerâmica.',                                         visita: 45, mo: 100, pontoAdicional: 10  },
  { id: '56', servico: 'Troca de Telhas (Fibrocimento)',     descricao: 'Somente mão de obra — até 03 peças tipo fibrocimento (acima de 1,00×0,90 de 4 a 8mm).',    visita: 45, mo: 180, pontoAdicional: 50  },
  { id: '57', servico: 'Ventilador de Teto',                 descricao: 'Instalação/Substituição de ventilador de teto (com ou sem passagem de fiação). 01 unidade.', visita: 45, mo: 130, pontoAdicional: 75  },
  { id: '58', servico: 'Lubrificação Ferro/Alumínio',        descricao: 'Lubrificação de dobradiças e fechaduras em portas/janelas de ferro/alumínio. Até 02 unidades. Ponto por porta/janela.', visita: 45, mo: 70,  pontoAdicional: 5   },
  { id: '59', servico: 'Lubrificação Porta de Aço',          descricao: 'Lubrificação de dobradiças e fechaduras em portas/janelas de Aço.',                         visita: 45, mo: 200, pontoAdicional: null },
  { id: '60', servico: 'Torneiras e Misturadores',           descricao: 'Instalação/Substituição de Torneiras e misturadores (instalação hidráulica compatível). 01 unidade.', visita: 45, mo: 75,  pontoAdicional: 45  },
  { id: '61', servico: 'Chuveiro Elétrico',                  descricao: 'Instalação/Substituição de Chuveiro Elétrico sem passagem de fiação (instalação elétrica compatível). 01 unidade.', visita: 45, mo: 70,  pontoAdicional: 45  },
  { id: '62', servico: 'Troca de Resistências',              descricao: 'Troca de Resistências (instalação elétrica compatível). 01 unidade.',                       visita: 45, mo: 70,  pontoAdicional: 45  },
  { id: '63', servico: 'Tomadas/Interruptores/Extensões',    descricao: 'Instalação de Tomadas, Interruptores e Extensões (instalação elétrica compatível). Até 03 unidades.', visita: 45, mo: 70,  pontoAdicional: 10  },
  { id: '64', servico: 'Pias, Pias Sobrepostas e Tanques',   descricao: 'Instalação de Pias/Tanques (só colocação e fixação, sem adequação hidráulica). Até 01 unidade.', visita: 45, mo: 150, pontoAdicional: 100 },
  { id: '65', servico: 'Luminárias, Lustres e Spots',        descricao: 'Instalação de Luminárias, Lustres e Spots (instalação elétrica compatível). 01 unidade.',   visita: 45, mo: 100, pontoAdicional: 50  },
  { id: '66', servico: 'Instalação de Sifões',               descricao: 'Instalação de Sifões (tecnicamente possível, sem adequação hidráulica). 01 unidade.',       visita: 45, mo: 75,  pontoAdicional: 45  },
]

// Tabelas de outras seguradoras — a ser preenchido quando disponível
export const TABELAS = {
  Mapfre: TABELA_MAPFRE,
}

// Faixas de deslocamento padrão
// ate200km: até 200km | acima200km: acima de 200km
export const DESL_FAIXAS_PADRAO = {
  ate200km:   1.20,
  acima200km: 1.80,
}

// Retorna as faixas de deslocamento da seguradora (ou o padrão)
export function getDeslocFaixas(config, seguradora) {
  return config?.tarifas?.[seguradora]?.deslocamento || DESL_FAIXAS_PADRAO
}

// Calcula o valor do deslocamento com base nas faixas
export function calcDeslocamento(km, faixas) {
  if (!km || km <= 0) return 0
  const taxa = km <= 200 ? (faixas?.ate200km || 1.20) : (faixas?.acima200km || 1.80)
  return parseFloat((km * taxa).toFixed(2))
}

// Calcula o total do serviço: visita + MO + pontos extras
export function calcServico(item, pontos) {
  if (!item) return { visita: 0, mo: 0, pontosExtras: 0, totalServico: 0 }
  const visita       = item.visita || 0
  const mo           = item.mo || 0
  const pontoAd      = item.pontoAdicional || 0
  const extras       = pontoAd > 0 ? Math.max(0, (parseInt(pontos) || 1) - 1) * pontoAd : 0
  return {
    visita,
    mo,
    pontosExtras: extras,
    totalServico: visita + mo + extras,
  }
}

// Gera a mensagem formatada para copiar no WhatsApp da seguradora
export function gerarMsgWhatsApp(os, item, pontos, km, faixas) {
  const r = n => Number(n).toFixed(2).replace('.', ',')
  const { visita, mo, pontosExtras, totalServico } = calcServico(item, pontos)
  const desl  = calcDeslocamento(km, faixas)
  const total = totalServico + desl

  const linhas = [
    `*Nº Assistência:* ${os.num_assist || '—'}`,
    `*Segurado:* ${os.nome_segurado || '—'}${os.cidade ? ` — ${os.cidade}` : ''}`,
    `*Serviço:* ${item ? `${item.id} — ${item.servico}` : os.servico || '—'}`,
    (os.desc_problema || os.desc_servico)
      ? `*Laudo:* ${os.desc_problema || os.desc_servico}`
      : null,
    '',
    '*Tarifação:*',
    item && visita > 0  ? `• Visita/Saída: R$ ${r(visita)}`                                                                    : null,
    item && mo > 0      ? `• MO (${item.id} — ${item.servico}): R$ ${r(mo)}`                                                   : null,
    pontosExtras > 0    ? `• Pontos extras (${Math.max(0,(parseInt(pontos)||1)-1)} × R$ ${r(item?.pontoAdicional||0)}): R$ ${r(pontosExtras)}` : null,
    km > 0              ? `• Deslocamento: ${km}km × R$ ${r(km <= 200 ? (faixas?.ate200km||1.20) : (faixas?.acima200km||1.80))} = R$ ${r(desl)}` : null,
    `• *Total proposto: R$ ${r(total)}*`,
  ]
  return linhas.filter(l => l !== null).join('\n')
}
