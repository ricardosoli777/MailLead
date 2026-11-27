/**
 * Ready-made e-mails by use, written for MailLead. What the owner must fill in is in [CAPITALS];
 * nothing here invents prices, deadlines, numbers or testimonials.
 */
import type { Block, Design } from "./types";

const footer = {
	company: "Nome da sua empresa",
	contact: "contato@suaempresa.com.br",
	disclaimer: "Você recebeu esta mensagem porque se cadastrou ou é cliente. O conteúdo é destinado apenas ao destinatário.",
};

export const CATEGORIES = [
	{ id: "welcome", label: "Boas-vindas", accent: "#0b57d0" },
	{ id: "content", label: "Conteúdo", accent: "#00695c" },
	{ id: "event", label: "Eventos", accent: "#6a1b9a" },
	{ id: "sales", label: "Vendas", accent: "#c2410c" },
	{ id: "customer", label: "Clientes", accent: "#1b7f3b" },
	{ id: "winback", label: "Reativação", accent: "#8a5300" },
	{ id: "notice", label: "Avisos", accent: "#37474f" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export type Starter = { key: string; category: CategoryId; name: string; use: string; subject: string; design: Design };

const LINK = "https://exemplo.com";
const h = (text: string): Block => ({ type: "heading", text });
const p = (text: string): Block => ({ type: "text", text });
const b = (label: string): Block => ({ type: "button", label, url: LINK });
const line: Block = { type: "divider" };

const make = (key: string, category: CategoryId, name: string, use: string, subject: string, preheader: string, blocks: Block[]): Starter =>
	({ key, category, name, use, subject, design: { accent: CATEGORIES.find((item) => item.id === category)!.accent, preheader, blocks, footer } });

export const STARTERS: Starter[] = [
	make("material", "welcome", "Entrega de material", "Logo após o cadastro de quem pediu um e-book, aula, planilha ou cupom.", "Aqui está o seu material", "O link para baixar está dentro", [
		h("Olá, {{nome|tudo bem}}!"),
		p("Obrigado por se cadastrar. Como combinado, aqui está o [NOME DO MATERIAL]."),
		b("Baixar agora"),
		p("Comece por [A PARTE MAIS ÚTIL]: é o que dá resultado mais rápido.\n\nSe tiver dúvida, responda este e-mail."),
	]),
	make("boas-vindas", "welcome", "Boas-vindas", "Primeiro contato com quem entrou na lista: apresenta quem você é e o que vem pela frente.", "Que bom ter você aqui, {{nome|tudo bem}}", "O que você vai receber de agora em diante", [
		h("Seja bem-vindo"),
		p("Olá, {{nome|tudo bem}}!\n\nEu sou [SEU NOME] e ajudo [PARA QUEM] a [RESULTADO QUE VOCÊ ENTREGA]."),
		p("Por aqui você vai receber:\n• [ASSUNTO 1]\n• [ASSUNTO 2]\n• [ASSUNTO 3]"),
		p("Para eu mandar o que serve para você: qual é hoje a sua maior dificuldade com [TEMA]? É só responder."),
	]),
	make("historia", "welcome", "Sua história", "Segundo ou terceiro e-mail de boas-vindas, para criar confiança.", "Por que eu comecei com [TEMA]", "Uma história curta", [
		p("{{nome|Olá}}, deixa eu contar uma coisa."),
		p("Há [QUANTO TEMPO], eu [SITUAÇÃO DIFÍCIL QUE VOCÊ VIVEU]."),
		p("O que mudou foi [DESCOBERTA]. Desde então, [O QUE VOCÊ FAZ HOJE]."),
		p("Se você está passando por algo parecido, responda este e-mail e me conte."),
	]),
	make("dica", "content", "Dica prática", "Nutrição: ensina uma coisa pequena e aplicável, sem vender.", "Uma dica de [TEMA] para usar hoje", "Leva poucos minutos", [
		h("[TÍTULO DA DICA]"),
		p("{{nome|Olá}}, um erro comum em [TEMA] é [ERRO]."),
		p("Faça assim:\n1. [PASSO 1]\n2. [PASSO 2]\n3. [PASSO 3]"),
		p("Teste e me responda contando o que aconteceu."),
	]),
	make("objecao", "content", "Tirar uma dúvida comum", "Antes de ofertar: responde à objeção que mais impede a compra.", "\"[A DÚVIDA]\": o que eu respondo", "A pergunta que mais recebo", [
		p("Olá, {{nome|tudo bem}}!\n\nMuita gente me pergunta: \"[A DÚVIDA]\"."),
		p("A resposta honesta: [RESPOSTA]."),
		p("Vale para você se [QUANDO SERVE]. Não vale se [QUANDO NÃO SERVE]."),
		b("Ver os detalhes"),
	]),
	make("newsletter", "content", "Newsletter", "Resumo periódico com dois ou três assuntos.", "Novidades desta edição", "O que separamos para você", [
		h("Novidades"),
		p("[ABERTURA CURTA DA EDIÇÃO]"),
		line,
		h("[PRIMEIRO ASSUNTO]"),
		p("[RESUMO]"),
		b("Ler mais"),
		line,
		h("[SEGUNDO ASSUNTO]"),
		p("[RESUMO]"),
	]),
	make("convite", "event", "Convite para aula ou webinar", "Convida para um evento ao vivo, com data marcada.", "Convite: [NOME DO EVENTO]", "[DATA E HORÁRIO]", [
		h("[NOME DO EVENTO]"),
		p("{{nome|Olá}}, você está convidado para uma aula ao vivo sobre [TEMA]."),
		p("Quando: [DATA E HORÁRIO]\nOnde: [PLATAFORMA]\n\nVocê vai aprender:\n• [PONTO 1]\n• [PONTO 2]"),
		b("Quero participar"),
	]),
	make("lembrete-evento", "event", "Lembrete do evento", "Véspera ou dia do evento, para quem se inscreveu.", "É amanhã: [NOME DO EVENTO]", "Guarde o horário", [
		p("{{nome|Olá}}, passando para lembrar: [NOME DO EVENTO] é [DATA E HORÁRIO]."),
		p("Separe papel e caneta. Entre alguns minutos antes."),
		b("Acessar a sala"),
	]),
	make("ao-vivo", "event", "Começa agora", "Na hora em que a aula começa.", "Estamos ao vivo", "Entre agora", [
		h("Começou!"),
		p("{{nome|Olá}}, a aula [NOME DO EVENTO] está começando agora."),
		b("Entrar na aula"),
	]),
	make("replay", "event", "Gravação do evento", "Depois do evento, para inscritos que não viram ou querem rever.", "A gravação está disponível", "Assista quando puder", [
		p("Olá, {{nome|tudo bem}}!\n\nA gravação de [NOME DO EVENTO] está no ar até [DATA LIMITE]."),
		b("Assistir à gravação"),
		p("O ponto que mais gerou perguntas foi [PONTO], a partir de [MINUTO]."),
	]),
	make("comercial", "sales", "Apresentar a oferta", "Primeira vez que você apresenta o produto a quem já conhece seu conteúdo.", "Uma proposta para você, {{nome|cliente}}", "O que é e para quem serve", [
		h("[NOME DO PRODUTO]"),
		p("{{nome|Olá}}, se você quer [RESULTADO] sem [O QUE ATRAPALHA], isto é para você."),
		p("O que está incluído:\n• [ITEM 1]\n• [ITEM 2]\n• [ITEM 3]\n\nInvestimento: [PREÇO E CONDIÇÕES]\nGarantia: [PRAZO DA GARANTIA]"),
		b("Quero conhecer"),
	]),
	make("beneficios", "sales", "O que muda para você", "Segundo e-mail da venda: antes e depois, sem promessa exagerada.", "O que muda com [NOME DO PRODUTO]", "Na prática", [
		p("Olá, {{nome|tudo bem}}!"),
		p("Hoje: [COMO É SEM O PRODUTO].\nCom [NOME DO PRODUTO]: [COMO FICA]."),
		p("Isso não acontece sozinho: você precisa [O QUE A PESSOA TEM QUE FAZER]."),
		b("Ver a oferta"),
	]),
	make("ultimas-horas", "sales", "Última chamada", "Só quando existe um prazo de verdade para encerrar.", "Encerra em [DATA E HORA]", "Depois disso, [O QUE MUDA]", [
		h("Último aviso"),
		p("{{nome|Olá}}, a condição de [NOME DO PRODUTO] termina em [DATA E HORA]. Depois, [O QUE MUDA]."),
		b("Garantir agora"),
		p("Se não for para agora, tudo bem: você continua recebendo o conteúdo."),
	]),
	make("carrinho", "sales", "Faltou finalizar a compra", "Quem começou a compra e não concluiu (use com etiqueta vinda do checkout).", "Ficou alguma dúvida, {{nome|tudo bem}}?", "Seu pedido não foi concluído", [
		p("Olá, {{nome|tudo bem}}!\n\nVi que você começou o pedido de [NOME DO PRODUTO] e não concluiu."),
		p("Foi o pagamento, uma dúvida ou o momento? Responda que eu ajudo."),
		b("Concluir o pedido"),
	]),
	make("proposta", "sales", "Proposta", "Orçamento para quem pediu, com valores e próximos passos.", "Sua proposta está pronta", "Valores, prazos e próximos passos", [
		h("Proposta para {{nome|você}}"),
		p("Resumo do que será entregue:\n• [ITEM 1]\n• [ITEM 2]\n\nInvestimento: [VALOR]\nPrazo: [PRAZO]"),
		line,
		p("Qualquer dúvida, é só responder este e-mail."),
		b("Aceitar proposta"),
	]),
	make("obrigado", "customer", "Obrigado pela compra", "Logo depois da compra, com o acesso.", "Pedido confirmado: seu acesso", "Como entrar e por onde começar", [
		h("Obrigado, {{nome|tudo bem}}!"),
		p("Sua compra de [NOME DO PRODUTO] está confirmada."),
		b("Acessar agora"),
		p("Precisa de ajuda? Responda este e-mail ou fale em [CANAL DE SUPORTE]."),
	]),
	make("primeiros-passos", "customer", "Primeiros passos", "Alguns dias depois da compra, para a pessoa começar a usar.", "Já começou, {{nome|tudo bem}}?", "Três passos para o primeiro resultado", [
		p("{{nome|Olá}}, para ter o primeiro resultado com [NOME DO PRODUTO]:"),
		p("1. [PASSO 1]\n2. [PASSO 2]\n3. [PASSO 3]"),
		b("Continuar de onde parei"),
		p("Travou em algum ponto? Me diga qual."),
	]),
	make("avaliacao", "customer", "Pedir opinião", "Depois que a pessoa teve tempo de usar.", "Posso saber sua opinião?", "Leva um minuto", [
		p("Olá, {{nome|tudo bem}}!\n\nVocê já usou [NOME DO PRODUTO] por um tempo. O que funcionou e o que faltou?"),
		p("Responda com as suas palavras. Se eu quiser publicar, peço sua autorização antes."),
	]),
	make("sentimos-falta", "winback", "Sentimos sua falta", "Quem parou de abrir há algum tempo.", "Faz tempo, {{nome|tudo bem}}?", "Veja o que mudou", [
		p("Olá, {{nome|tudo bem}}!\n\nDesde a última vez, [NOVIDADE QUE VALE A PENA]."),
		b("Ver a novidade"),
		p("Se o assunto mudou para você, responda contando o que procura agora."),
	]),
	make("continuar", "winback", "Ainda quer receber?", "Última tentativa antes de tirar da lista quem não interage.", "Quer continuar recebendo?", "Você decide", [
		p("{{nome|Olá}}, quero mandar e-mail só para quem quer receber."),
		p("Se quer continuar, clique abaixo. Se não, não precisa fazer nada além de usar o link de descadastro no fim."),
		b("Quero continuar"),
	]),
	make("comunicado", "notice", "Comunicado", "Aviso de mudança, prazo ou manutenção.", "Comunicado importante", "Leia antes da data indicada", [
		h("Comunicado"),
		p("Olá, {{nome|cliente}}.\n\nA partir de [DATA], [O QUE MUDA].\n\nO que você precisa fazer: [AÇÃO]."),
	]),
	make("agradecimento", "notice", "Data comemorativa", "Mensagem de fim de ano, aniversário da empresa ou data especial.", "Um recado de [SUA EMPRESA]", "Só para agradecer", [
		h("Obrigado por estar com a gente"),
		p("{{nome|Olá}}, neste [DATA ESPECIAL], quero agradecer por [MOTIVO]."),
		p("Um abraço,\n[SEU NOME]"),
	]),
];

/** What is still to be filled in: the example address or a [PLACEHOLDER]. Links "[word](url)" do not count. */
export const unfilled = (value: string): string | null => /https?:\/\/exemplo\.com|\[[A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 ]{2,}\](?!\()/.exec(value)?.[0] ?? null;
