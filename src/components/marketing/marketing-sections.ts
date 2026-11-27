/** Each section of the marketing app has its own address: /marketing/<id>. */
export const MARKETING_SECTIONS = [
	{ id: "funis", label: "Funis" },
	{ id: "campanhas", label: "Campanhas" },
	{ id: "modelos", label: "Modelos" },
	{ id: "contatos", label: "Contatos" },
	{ id: "listas", label: "Nova lista" },
	{ id: "captura", label: "Captura" },
	{ id: "envio", label: "Envio" },
	{ id: "whatsapp", label: "WhatsApp" },
	{ id: "ia", label: "IA" },
	{ id: "backup", label: "Backup" },
	{ id: "ajuda", label: "Ajuda" },
] as const;

export type MarketingSection = (typeof MARKETING_SECTIONS)[number]["id"];
