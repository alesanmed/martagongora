import type { ImageMap } from "$lib/images";

export type OutputData = {
	images: ImageMap;
	translations: any;
	/** Solo contacto: clave pública reCAPTCHA (evita depender solo del env en el cliente). */
	recaptchaSiteKey?: string;
};

export interface OutputDataMenu {
	translationsMenu: any;
	translationsFooter: any;
	lang: string;
	defaultLocale: string;
	locales: string[];
}