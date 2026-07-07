# 📖 Manual do Financeiro — AssistHub

*Guia completo para o dia a dia. Escrito para quem usa, não para programador.*

---

## O mapa geral

O Financeiro fica no painel admin e tem **7 abas**. Cada uma responde uma pergunta:

| Aba | Pergunta que ela responde |
|-----|---------------------------|
| 📈 **DRE Mensal** | "O mês deu lucro?" |
| 💸 **Despesas** | "Quais contas tenho que pagar e quais já paguei?" |
| 🎨 **Serv. Particulares** | "Quanto ganhei com serviços fora das seguradoras?" |
| 🧾 **Impostos e Fin.** | "Quanto paguei de imposto e taxas?" |
| 📄 **Faturamento** | "Quais OS já faturei e quando a seguradora vai pagar?" |
| 👷 **Técnicos** | "Quanto devo a cada técnico e o que já paguei?" |
| 💵 **Caixa** | "Quanto dinheiro DE VERDADE entrou e saiu?" |

No topo há o **seletor de mês** (◄ Julho de 2026 ►) — tudo que você vê é do mês selecionado — e o **cadeado 🔒** para fechar o mês (explicado no final).

---

## 📈 DRE Mensal — o raio-X do mês

O DRE é uma conta de padaria, de cima para baixo:

```
  Tudo que entrou (OS + particulares)
− Impostos
− O que paguei de técnico e material
− Taxas de banco/maquininha
− Contas fixas (aluguel, luz, salários...)
= O QUE SOBROU (lucro líquido)
```

- Os valores das OS vêm automaticamente das OS do mês.
- Impostos, taxas e despesas você lança nas outras abas — o DRE junta tudo sozinho.
- **⬇️ Baixar DRE em PDF**: gera o arquivo pronto para mandar ao contador. Se o botão estiver apagado, é porque o mês não tem movimento.

---

## 💸 Despesas — todas as contas da empresa

**Aqui entra QUALQUER gasto da empresa**: aluguel, salário, gasolina, o pão do café da equipe, uma ferramenta nova. Se saiu do bolso da empresa, pode (e deve) ser lançado.

### Os dois tipos

1. **Despesa Recorrente (cadastro)** — a conta que se repete todo mês. Cadastra UMA vez:
   - **Fixa**: mesmo valor sempre (aluguel, internet). Tem o campo **"Dia de Vencimento"** — ex.: aluguel todo dia 5.
   - **Variável**: repete mas o valor muda (água, luz). O sistema te lembra de preencher o valor do mês.
2. **Lançamento avulso (+ Avulso)** — o gasto que aconteceu uma vez: abasteceu o carro, comprou pão, trocou uma peça. Lança na hora e pronto.

### Categorias (escolha a mais parecida)

- **Pessoal**: salário, pró-labore
- **Estrutura**: aluguel, água/luz, internet
- **Operacional (dia a dia)**: ⛽ combustível, 🍞 alimentação, 🚗 veículo/manutenção, 🔧 ferramentas
- **Administrativo**: contabilidade, outro

A categoria só serve para organizar o DRE em blocos — não muda o valor. Na dúvida, use "Outro".

### O ciclo do mês

1. **Virou o mês** → o sistema pergunta: *"Deseja lançar automaticamente as despesas fixas?"* → clique **Sim** e aluguel, internet etc. já entram com vencimento certo.
2. **Gastou algo no meio do mês** → **+ Avulso** → descrição ("Gasolina Fiorino"), categoria (Combustível), valor, vencimento (se for boleto) → salvar.
3. **Pagou uma conta** → clique **✓ Pagar** no item → confirma → vira selo verde **PAGO**.
4. **Esqueceu de pagar?** → o selo fica vermelho **ATRASADO** e aparece o aviso no topo: *"2 contas vencem esta semana · 1 atrasada"*.

---

## 🎨 Serviços Particulares

Serviço feito **fora das seguradoras** (cliente pagou direto). Lance a descrição, o que recebeu e o que gastou — o lucro entra no DRE junto com o resto.

---

## 🧾 Impostos e Financeiro

Duas listas simples, lançadas manualmente (os valores vêm do contador ou do extrato):

- **Impostos**: ISS, imposto federal — o que a empresa pagou de tributo no mês.
- **Taxas e juros**: tarifa bancária, taxa de maquininha, juros recebidos.

Sem lançar aqui, o DRE mostra um lucro maior do que o real — por isso o próprio DRE avisa quando o mês está sem imposto lançado.

---

## 📄 Faturamento — das OS até o dinheiro da seguradora

A aba mais importante para o caixa. Funciona como uma **gaveta de códigos + checklist**.

### Passo a passo completo

**1. Registrar os códigos (só Mapfre, Allianz e Mondial)**
Quando a seguradora libera os códigos da OS (Mapfre: 8 dígitos; Allianz/Mondial: 2 dígitos), abra a OS e registre os **dois códigos com os valores**: um de **mão de obra** e um de **deslocamento** (se não teve deslocamento, deixa vazio).
➡️ *Tempo e Maxpar não têm código — as OS finalizadas entram na fila sozinhas pelo número da assistência.*

**2. A fila**
Escolha a seguradora no seletor. A fila mostra tudo que está pronto para faturar e ainda não entrou em nota. Se estiver vazia, ela **explica o motivo** (ex.: "4 OS sem código — abra a OS e preencha").

**3. Lançar no portal da seguradora (o "parei aqui")**
Abra o AssistHub de um lado e o portal do outro. A cada código digitado no portal, marque ✓ na fila. O progresso salva sozinho — se o telefone tocar, ao voltar está lá: *"12 lançados ✓ · 5 faltando"*.
- **📋 Copiar todos os códigos**: copia a lista inteira de uma vez.
- **Tempo/Maxpar**: o valor é editável na hora (a sugestão da OS aparece em cinza) — o que você digitar é o que vale.
- **Divergência**: se a seguradora liberou R$ 226,80 mas a OS diz R$ 240,00, aparece ⚠ em vermelho com a diferença. Resolva antes de fechar a nota.

**4. Fechar a nota**
Terminou de lançar? **🧾 Fechar nota** → informe o número da fatura e a data de emissão. O sistema mostra na hora **quando a seguradora vai pagar** (calendário de cada uma, editável em Config → Tarifas):

| Seguradora | Emissão | Pagamento |
|---|---|---|
| Mapfre | 01–10 / 11–25 / 26–31 | dia 01 seg. / dia 16 seg. / dia 01 do 2º mês |
| Allianz/Mondial | 01–03 / 04–10 / 11–20 / 21–25 | dia 13 / 25 / 03 seg. / 13 seg. |
| Allianz/Mondial | **26–31** | ⛔ **não fatura — o sistema bloqueia e avisa** |
| Tempo | 01–09 / 10–fim | fim do mesmo mês / ~dia 24 seguinte |
| Maxpar | 01–15 / 16–fim | dia 25 do mesmo mês / dia 10 seguinte |

**5. Acompanhar e receber**
As notas ficam listadas com status: **aguardando** (amarelo), **paga** (verde), **atrasada** (vermelho — passou da data e você não marcou como paga: hora de cobrar). O painel do topo resume: *"Total a receber: Mapfre R$ X até 01/08..."*. Caiu o dinheiro? **Marcar como paga** — todas as OS da nota quitam juntas.

---

## 👷 Técnicos — fechamento e pagamento

1. **Uma vez só**: no cadastro do técnico (aba Técnicos do painel), preencha a **chave PIX** e a forma de pagamento.
2. **Todo mês**: a aba mostra cada técnico com as OS do mês, o valor de cada uma e o **total a pagar**.
3. **Na hora de pagar**: **copiar PIX** → paga no app do banco → **💵 Marcar como pago** (pede a data).
4. O sistema **não deixa pagar o mesmo mês duas vezes**, e o **Histórico de pagamentos** guarda tudo para sempre — se um dia alguém disser "você não me pagou aquela OS", está tudo registrado.

---

## 💵 Caixa — o dinheiro de verdade

**DRE e Caixa respondem perguntas diferentes:**
- DRE: *"o mês deu lucro?"* (conta o que foi ganho, mesmo que ainda não tenha recebido)
- Caixa: *"quanto dinheiro entrou e saiu de fato?"* (só conta o que foi pago/recebido)

Exemplo: você faturou R$ 5.000 da Mapfre em julho, mas ela só paga em agosto → o DRE de julho mostra o ganho; o Caixa de julho não — o dinheiro entra no Caixa de agosto, quando você marcar a nota como paga.

- **Entradas** = notas marcadas como pagas no mês + serviços particulares
- **Saídas** = despesas pagas + técnicos pagos no mês
- **Saldo** = sobrou (verde) ou faltou (vermelho)
- **📊 Evolução 12 meses**: barras de receita e lucro, com a margem % — para ver se a empresa está crescendo.

⚠️ **O Caixa depende de você marcar as coisas como pagas** (notas, despesas, técnicos). Se nada for marcado, o Caixa fica vazio — não é defeito, é o retrato do que foi registrado.

---

## 🔒 Fechar o mês

Quando o mês está conferido (DRE ok, contas pagas, técnicos pagos), clique no **cadeado** ao lado do seletor de mês. O mês fechado:

- Mostra o aviso *"Mês fechado em DD/MM"*
- **Trava os lançamentos** daquele mês (despesas, particulares, impostos, técnicos) contra alteração sem querer
- A aba Faturamento continua livre (nota de seguradora atravessa meses — é normal)

Precisou corrigir algo? Clique no cadeado de novo → **reabrir** → corrige → fecha de novo. O objetivo é evitar acidente, não impedir correção.

---

## Rotina sugerida

**No dia a dia** *(2 minutos)*: gastou → lança avulso · pagou conta → ✓ Pagar · chegou código → registra na OS

**Na hora de faturar**: fila → checklist → fechar nota

**Na virada do mês** *(15 minutos)*:
1. Aceitar o lançamento automático das fixas
2. Lançar impostos e taxas (aba Impostos)
3. Fechar os técnicos (copiar PIX → pagar → marcar pago)
4. Conferir notas atrasadas no Faturamento (cobrar seguradora!)
5. Olhar o DRE → **Baixar PDF** para o contador
6. Olhar o Caixa → conferir se o saldo bate com o banco
7. **Fechar o mês** 🔒

---

*Manual do AssistHub Financeiro — atualizado em julho/2026 (milestone v1.2).*
*Dúvidas ou sugestões de melhoria: anote e traga para a próxima atualização do sistema.*
