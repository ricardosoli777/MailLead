import type { Block, Design } from "./types";

const footer = {
	company: "Nome da sua empresa",
	contact: "contato@suaempresa.com.br",
	disclaimer: "Você recebeu esta mensagem porque se cadastrou ou é cliente. O conteúdo é destinado apenas ao destinatário.",
};

const make = (preheader: string, blocks: Block[]): Design => ({ accent: "#0b57d0", preheader, blocks, footer });

export const STARTERS: { key: string; name: string; subject: string; design: Design }[] = [
	{
		key: "comercial",
		name: "Comercial",
		subject: "Uma oferta para você, {{nome|cliente}}",
		design: make("Condição especial por tempo limitado", [
			{ type: "heading", text: "Olá, {{nome|tudo bem}}!" },
			{ type: "text", text: "Apresente aqui o produto e o benefício principal em poucas linhas." },
			{ type: "button", label: "Quero conhecer", url: "https://exemplo.com" },
		]),
	},
	{
		key: "proposta",
		name: "Proposta",
		subject: "Sua proposta está pronta",
		design: make("Valores, prazos e próximos passos", [
			{ type: "heading", text: "Proposta para {{nome|você}}" },
			{ type: "text", text: "Resumo do que será entregue:\n• Item 1\n• Item 2\n\nInvestimento:\nPrazo:" },
			{ type: "divider" },
			{ type: "text", text: "Qualquer dúvida, é só responder este e-mail." },
			{ type: "button", label: "Aceitar proposta", url: "https://exemplo.com" },
		]),
	},
	{
		key: "comunicado",
		name: "Comunicado",
		subject: "Comunicado importante",
		design: make("Leia antes da data indicada", [
			{ type: "heading", text: "Comunicado" },
			{ type: "text", text: "Olá, {{nome|cliente}}.\n\nEscreva aqui o que muda, a partir de quando e o que a pessoa precisa fazer." },
		]),
	},
	{
		key: "newsletter",
		name: "Newsletter",
		subject: "Novidades desta edição",
		design: make("O que separamos para você", [
			{ type: "heading", text: "Novidades" },
			{ type: "text", text: "Abertura curta da edição." },
			{ type: "divider" },
			{ type: "heading", text: "Primeiro assunto" },
			{ type: "text", text: "Resumo do primeiro assunto." },
			{ type: "button", label: "Ler mais", url: "https://exemplo.com" },
		]),
	},
];
