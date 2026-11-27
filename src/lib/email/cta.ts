/** The look of a call-to-action button, shared by marketing templates and the composer. */
export const CTA_COLOR = "#0b57d0";

export const isColor = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

/** Dark letters on a light button, white ones on the rest, so the label is always readable. */
export function textOn(color: string): string {
	const [r, g, b] = [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16));
	return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#202124" : "#ffffff";
}

export const ctaStyle = (color: string) => `display:inline-block;background-color:${color};color:${textOn(color)};text-decoration:none;font-weight:bold;padding:12px 28px;border-radius:8px`;
