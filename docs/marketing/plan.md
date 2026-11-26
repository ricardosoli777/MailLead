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
- [ ] `news.klead.com.br` cadastrado no SES; DNS importado e conferido em 2026-11-26; falta confirmar a verificação no SES e o e-mail de teste. DMARC em `p=reject`, porque o domínio principal já usa `sp=reject`.
- [ ] Escolher o nome e criar logo, selo e favicon (M1–M3); aplicar em Admin → Branding e conferir o que ainda mostra o nome original.
- [ ] Cadastrar o domínio no Google Postmaster Tools.
- [ ] Conferir as regras atuais de AWS, Gmail, Yahoo e Outlook.
- [ ] Criar ambiente de testes separado (Worker e D1 próprios).
- [ ] Confirmar o que será reaproveitado.

**Sai quando:** domínio verificado no SES e e-mail de teste passando em SPF, DKIM e DMARC.

### Onda 1 — Modelos (T1–T8)
- [x] Aba Marketing e `MARKETING_DB`.
- [x] Editor de blocos, renderizador HTML e texto, imagens no R2.
- [x] Rodapé obrigatório, quatro modelos, prévia, envio de teste, uso no compositor.

**Sai quando:** os modelos são conferidos no Gmail, no Outlook e no celular.

**Estado em 2026-11-26:** construída e testada localmente, ainda não publicada; falta conferir no Gmail, Outlook e celular.

### Onda 2 — Contatos, consentimento e descadastro (C1–C6, U1–U4, U6, U7)
- [ ] Contatos, listas, etiquetas, consentimento, importação.
- [ ] Descadastro, preferências, supressão, exportar e apagar.

**Sai quando:** os testes provam que quem saiu não pode receber.

### Onda 3 — Motor de envio e proteção (U5, R1–R5, R10, K2)
- [ ] Fila, ritmo, cota, aquecimento, eventos SNS, disjuntor.
- [ ] Testar com o simulador do SES (`success@`, `bounce@`, `complaint@simulator.amazonses.com`).
- [ ] Teste de carga sem envio real.

**Sai quando:** o disjuntor pausa um envio simulado e uma repetição de fila não duplica.

### Onda 4 — Campanhas e relatórios (K1, K3, R7–R9)
- [ ] Criar, revisar, agendar, pausar; relatórios.
- [ ] Primeira campanha real, pequena, só para contatos engajados.

**Sai quando:** a primeira campanha fecha dentro dos limites. Aqui já há um produto utilizável.

### Onda 5 — Captura e integrações (R6, I1–I3)
- [ ] Formulários, confirmação dupla, API e webhook.

### Onda 6 — Fluxos (F1–F3)
- [ ] Primeiro em lista de passos; editor visual depois.

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
