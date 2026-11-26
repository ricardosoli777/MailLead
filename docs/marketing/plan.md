# E-mail marketing — Plano em ondas

Base: [spec.md](spec.md) e [design.md](design.md).

## Loop de cada tarefa
1. Escolher um requisito (ID).
2. Escrever o teste do critério de aceite e vê-lo falhar.
3. Implementar o mínimo.
4. Rodar testes, `tsc` e build; comparar com a linha de base (11 testes já falhavam em 2026-11-26).
5. Falhou: corrigir e voltar ao 4. Na terceira falha pelo mesmo motivo, parar e perguntar.
6. Revisar o diff (segurança e consentimento), marcar a tarefa e commitar na `main`.

## Loop de cada onda
Tarefas → verificação de todos os IDs → demonstração → **aprovação do dono** → ponto de restauração do banco → migrações → deploy → conferência em produção. Sem aprovação, a onda seguinte não começa.

## Ondas

### Onda 0 — Preparação (sem código de produto)
- [ ] Responder as perguntas em aberto.
- [x] SES: `us-east-1`, produção, 50.000 por 24 h, 14 por segundo (2026-11-26).
- [x] `news.klead.com.br` verificado no SES e DNS no ar. DMARC em `p=reject`, porque o domínio principal já usa `sp=reject`.
- [ ] Escolher o nome e criar logo, selo e favicon (M1–M3); aplicar em Admin → Branding e conferir o que ainda mostra o nome original.
- [ ] Cadastrar o domínio no Google Postmaster Tools.
- [ ] Conferir as regras atuais de AWS, Gmail, Yahoo e Outlook.
- [ ] Criar ambiente de testes separado (Worker e D1 próprios).
- [ ] Confirmar o que será reaproveitado.

**Sai quando:** domínio verificado no SES e e-mail de teste passando em SPF, DKIM e DMARC.

**Cumprido em 2026-11-26:** teste no Gmail com SPF, DKIM (`news.klead.com.br`) e DMARC em PASS. Os demais itens da onda seguem abertos.

### Onda 1 — Modelos (T1–T8)
- [x] Aba Marketing e `MARKETING_DB`.
- [x] Editor de blocos, renderizador HTML e texto, imagens no R2.
- [x] Rodapé obrigatório, quatro modelos, prévia, envio de teste, uso no compositor.

**Sai quando:** os modelos são conferidos no Gmail, no Outlook e no celular.

**Estado em 2026-11-26:** construída e testada localmente, ainda não publicada; falta conferir no Gmail, Outlook e celular.

### Onda 2 — Contatos, consentimento e descadastro (C1–C6, U1–U4, U6, U7)
- [x] Contatos, listas, etiquetas, consentimento, importação.
- [x] Descadastro, preferências, supressão, exportar e apagar.

**Sai quando:** os testes provam que quem saiu não pode receber.

**Estado em 2026-11-26:** publicada e testada localmente (`tests/marketing-contacts.test.mjs`). U2 (cabeçalhos no e-mail recebido) só é conferido com o motor de envio da onda 3, que deve usar `renderMarketingEmail` e `canReceive`.

### Onda 3 — Motor de envio e proteção (U5, R1–R5, R10, K2)
- [x] Lotes, ritmo, cota, aquecimento, eventos SNS, disjuntor (ver [envio.md](envio.md)).
- [x] Testar com o simulador do SES em produção (2026-11-26): `bounce@` e `complaint@` bloquearam o endereço.
- [x] Teste de carga sem envio real (2.000 destinatários em banco em memória; falta medir no D1 real).

**Sai quando:** o disjuntor pausa um envio simulado e uma repetição de fila não duplica.

**Estado em 2026-11-26:** construída e testada localmente (`tests/marketing-sending.test.mjs`), publicada. A tela de campanhas é a onda 4.

### Onda 4 — Campanhas e relatórios (K1, K3, R7–R9)
- [ ] Criar, revisar, agendar, pausar; relatórios.
- [ ] Primeira campanha real, pequena, só para contatos engajados.

**Sai quando:** a primeira campanha fecha dentro dos limites. Aqui já há um produto utilizável.

### Onda 5 — Captura e integrações (R6, I1–I3)
- [ ] Formulários, confirmação dupla, API e webhook.

### Onda 6 — Fluxos (F1–F6)
- [ ] Editor visual com arrastar e soltar (pedido do dono em 2026-11-26; substitui "lista de passos primeiro"). Ver [research.md](research.md).
- [ ] Execução dos passos, sobre o motor de envio da onda 3.

### Onda 7 — WhatsApp (W1, W2)
- [ ] Escolher o provedor; consentimento e saída próprios.

## Aquecimento proposto
Ponto de partida, a ajustar pelos resultados. Só avança se devolução e reclamação estiverem dentro dos limites.

| Dias | Limite por dia |
|------|----------------|
| 1–3 | 50 |
| 4–7 | 150 |
| 8–14 | 500 |
| 15–21 | 1.000 |
| 22–30 | 2.000 |
| depois | crescer até 30% por semana, dentro da cota |

50 mil por mês equivalem a cerca de 1.700 por dia, se distribuídos.
