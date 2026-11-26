export type FormField = { key: string; label: string; required: boolean };

export type CaptureForm = { id: string; name: string; listId: string; tags: string[]; consentText: string; doubleOptIn: boolean; fields: FormField[]; button: string };

export type CaptureHook = { id: string; name: string; listId: string; tags: string[]; consentText: string; secret: string };

export type CaptureKey = { id: string; name: string; createdAt: number; lastUsedAt: number | null };

export type SubmitResult = { ok: true; confirm: boolean } | { ok: false; error: string };
