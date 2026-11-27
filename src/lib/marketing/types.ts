export type Block =
	| { type: "heading"; text: string }
	| { type: "text"; text: string }
	| { type: "image"; url: string; alt: string; link?: string }
	| { type: "button"; label: string; url: string }
	/** Video or audio: mail apps rarely play media, so this is a cover image and a button to a link. */
	| { type: "media"; kind: "video" | "audio"; url: string; imageUrl?: string; label: string }
	| { type: "divider" };

/** Who sends. `company` may be empty when a person (`firstName`) signs instead. */
export type Footer = {
	company: string;
	contact: string;
	disclaimer: string;
	firstName?: string;
	lastName?: string;
	address?: string;
	zip?: string;
	city?: string;
	state?: string;
	country?: string;
	/** Adds "© year Name. Todos os direitos reservados." */
	rights?: boolean;
};

export type Design = { accent: string; preheader: string; blocks: Block[]; footer: Footer };

export type Template = { id: string; name: string; subject: string; design: Design; updatedAt: number };

export const MAX_BLOCKS = 60;
export const MAX_TEXT = 10_000;
