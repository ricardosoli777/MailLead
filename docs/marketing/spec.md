# E-mail marketing — Especificação

Status: **proposta, aguardando aprovação** (2026-11-26). Nada implementado.

## Objetivo
Criar, dentro do MailFlare, uma aba **Marketing** para modelos, contatos, campanhas e fluxos, enviando pelo Amazon SES (volume informado: 50 mil e-mails por mês), com proteção de reputação desde o primeiro envio.

Nenhuma ferramenta garante caixa de entrada. A meta é cumprir as exigências dos provedores e parar o envio antes que a reputação seja prejudicada.

## Decisões do dono (2026-11-26)
- **Público:** somente quem se cadastrou, comprou ou pediu newsletter ou informação. Sem lista fria.
- **Subdomínio de envio:** `news.klead.com.br`, a ser criado pelo dono na Cloudflare.
- **Logo:** opção C, o funil com dobra de envelope (`brand/c-funil.svg`).
- **Marca:** nome **MailLead**, com logo, selo e favicon próprios no design system atual do mail.klead.com.br. O repositório no GitHub continua como fork do original.

## Marca (M)
| ID | Requisito | Critério de aceite |
|----|-----------|--------------------|
| M1 | Nome próprio na interface, nos e-mails e nos registros do projeto | Nenhuma tela mostra o nome original, salvo créditos e licença |
| M2 | Logo, selo e favicon alinhados ao design do mail.klead.com.br | Aparecem no login, no menu, na aba e no app instalado |
| M3 | Manter avisos de autoria, licença AGPL e referência ao fork | Conferido no repositório |

## Fora do escopo por enquanto
Cobrança de clientes e várias empresas isoladas, teste A/B, pontuação de leads, páginas de captura completas.

## Requisitos
Cada requisito é verificável pelo critério ao lado.

### Modelos (T)
| ID | Requisito | Critério de aceite |
|----|-----------|--------------------|
| T1 | Editor por blocos: logo/banner, título, texto, imagem, botão, divisor, rodapé | Salvar, reabrir e editar sem perder conteúdo |
| T2 | Vídeo e áudio como capa/botão com link | O e-mail não anexa a mídia |
| T3 | Imagens no R2, servidas por link | Nenhuma imagem em base64 no HTML |
| T4 | Rodapé com disclaimer, identificação do remetente e endereço de contato | Modelos de campanha não salvam sem rodapé |
| T5 | Modelos prontos: comercial, proposta, comunicado, newsletter | Os quatro aparecem na lista |
| T6 | Prévia computador/celular, versão em texto e envio de teste | Teste chega com HTML e texto |
| T7 | Usar modelo também no envio normal de e-mail | Inserir pelo compositor |
| T8 | Variáveis (`{{nome}}`) com valor padrão | Contato sem nome não vê a variável crua |

### Contatos e consentimento (C)
| ID | Requisito | Critério de aceite |
|----|-----------|--------------------|
| C1 | Listas, etiquetas, campos e histórico | Filtrar por lista e etiqueta |
| C2 | Registrar origem, data e texto do consentimento | Todo contato tem os três ou fica como "sem consentimento" |
| C3 | Contato sem consentimento não recebe campanha | Teste automatizado |
| C4 | Importação CSV exige declarar a origem; valida sintaxe e domínio e remove duplicados | Relatório do que foi rejeitado |
| C5 | Contatos da caixa de e-mail **não** entram sozinhos no marketing | Teste automatizado |
| C6 | Exportar e apagar dados de um contato (LGPD) | Apagado, mantendo só o bloqueio por hash |

### Descadastro e supressão (U)
| ID | Requisito | Critério de aceite |
|----|-----------|--------------------|
| U1 | Link "Descadastre-se aqui" visível em todo e-mail de marketing | Envio sem o link é recusado |
| U2 | Cabeçalhos `List-Unsubscribe` e `List-Unsubscribe-Post` (RFC 8058), cobertos pelo DKIM | Conferido no e-mail recebido |
| U3 | Um clique descadastra, sem login | Efeito imediato, inclusive em envios na fila |
| U4 | Página para escolher listas ou sair de tudo | Preferência respeitada |
| U5 | Devolução permanente e reclamação bloqueiam o endereço | Verificado com o simulador do SES |
| U6 | Importar de novo não reativa quem saiu ou foi bloqueado | Teste automatizado |
| U7 | GET no link não descadastra sozinho (antivírus abrem links) | Só o botão ou o POST de um clique |

### Proteção de reputação (R)
| ID | Requisito | Critério de aceite |
|----|-----------|--------------------|
| R1 | Subdomínio próprio de marketing, separado do e-mail do dia a dia | Envio pelo domínio principal é recusado |
| R2 | Só enviar com SPF, DKIM e DMARC válidos e alinhados | Botão de envio bloqueado com o motivo |
| R3 | Respeitar a cota diária e a taxa por segundo da conta SES | Lidas da AWS, não fixas no código |
| R4 | Aquecimento: limite diário crescente | Excedente fica para o dia seguinte |
| R5 | Disjuntor: pausar se devolução ≥ 2% ou reclamação ≥ 0,08% (janela móvel, com amostra mínima) | Pausa automática e aviso |
| R6 | Formulários com confirmação dupla por padrão | Sem confirmar, não recebe campanha |
| R7 | Parar de enviar a inativos (padrão: sem clique ou abertura em 180 dias) | Segmento automático |
| R8 | Limite de frequência por contato | Configurável |
| R9 | Aviso antes de enviar: assunto, links quebrados, proporção imagem/texto, peso | Lista de verificação na revisão |
| R10 | Ritmo por provedor de destino ajustável | Gmail, Outlook e Yahoo separados |

Os limites de R5 são propostos abaixo das faixas de alerta da AWS (cerca de 5% de devolução e 0,1% de reclamação). Gmail pede reclamação abaixo de 0,1% e nunca chegando a 0,3%. Conferir os valores vigentes na onda 0.

### Campanhas e relatórios (K)
- K1 Campanha para listas ou segmentos, na hora ou agendada, com pausa e cancelamento.
- K2 Nunca enviar duas vezes ao mesmo contato na mesma campanha, mesmo com falha e nova tentativa.
- K3 Relatório: enviados, entregues, devoluções, reclamações, descadastros, cliques, aberturas (indicadas como aproximadas).

### Captura e integrações (I)
- I1 Formulário para incorporar em páginas, com proteção contra robôs (Turnstile) e limite de requisições.
- I2 API com chave e escopo próprio.
- I3 Webhook de entrada assinado, que cadastra o contato e inicia um fluxo.

### Fluxos (F) e WhatsApp (W)
- F1 Gatilhos: entrou na lista, recebeu etiqueta, webhook.
- F2 Passos: enviar, esperar, condição (clicou/abriu), etiquetar, sair.
- F3 Sair do fluxo imediatamente ao se descadastrar.
- F4 Montar o funil arrastando blocos para o quadro, com alternativa por clique no celular e no teclado (pedido do dono, 2026-11-26).
- F5 Reordenar e remover passos; condição mostra os caminhos "Sim" e "Não".
- F6 Rascunho pode estar incompleto; ativar só sem erros. Ver [research.md](research.md).
- W1 Passo de WhatsApp com consentimento próprio, separado do e-mail.
- W2 Resposta "sair" bloqueia novos envios.

## Perguntas em aberto
1. Respondida em 2026-11-26: SES em `us-east-1`, produção, 50.000 envios por 24 h, 14 por segundo.
2. Uso só seu ou venda a clientes?
3. WhatsApp: API oficial, Evolution ou ambos?
