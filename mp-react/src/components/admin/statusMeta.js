// Metadados de status das OS — labels, classes CSS e cores dos badges.
// Fonte única usada pelo AdminPage, tabs e modais.

export const STATUS_META = {
  aguardando_tecnico:          { label: 'Aguardando',          cls: 'aguardando-t',    dot: '#f05a1a' },
  pendente:                    { label: 'Pendente',             cls: 'pendente-y',      dot: '#f59e0b' },
  concluido:                   { label: 'Concluído',            cls: 'processado-g',    dot: '#2d8a4e' },
  processado:                  { label: 'Processado',          cls: 'processado-g',    dot: '#1a3fa8' },
  enviado:                     { label: 'Enviado',              cls: 'enviado-b',       dot: '#7c3aed' },
  ficou_visita:                { label: 'Ficou na Visita',     cls: 'ficou-visita',    dot: '#3b82f6' },
  cliente_ausente:             { label: 'Cliente Ausente',     cls: 'cliente-ausente', dot: '#9ca3af' },
  aguardando_assinatura_cliente: { label: 'Aguard. Assinatura', cls: 'pendente-y',      dot: '#f59e0b' },
}

export const badgeLabel = s => STATUS_META[s]?.label ?? STATUS_META.pendente.label
export const badgeCls   = s => STATUS_META[s]?.cls   ?? 'pendente-y'
