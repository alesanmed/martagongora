/**
 * reCAPTCHA en Google Cloud (checkbox).
 * @see https://docs.cloud.google.com/recaptcha/docs/instrument-web-pages-with-checkbox
 */
declare global {
	interface Window {
		grecaptcha?: {
			enterprise: {
				ready: (cb: () => void) => void;
				render: (
					container: HTMLElement,
					parameters: { sitekey: string; theme?: 'light' | 'dark' }
				) => number;
				getResponse: (widgetId?: number) => string;
				reset: (widgetId?: number) => void;
			};
		};
	}
}

const ENTERPRISE_SCRIPT = 'https://www.google.com/recaptcha/enterprise.js?render=explicit';

let enterpriseLoadPromise: Promise<void> | null = null;

/** Espera a que el script haya expuesto `grecaptcha.enterprise` y `ready` (no basta con `onload` ni `complete`). */
function loadRecaptchaEnterpriseScript(): Promise<void> {
	if (typeof window === 'undefined') return Promise.resolve();
	if (enterpriseLoadPromise) return enterpriseLoadPromise;

	const p = new Promise<void>((resolve, reject) => {
		let settled = false;
		const ok = () => {
			if (settled) return;
			settled = true;
			resolve();
		};
		const fail = (reason: string) => {
			if (settled) return;
			settled = true;
			if (import.meta.env.DEV) console.error('[reCAPTCHA]', reason);
			reject(new Error(reason));
		};

		const waitForEnterpriseApi = (attempt = 0) => {
			const ent = window.grecaptcha?.enterprise;
			if (ent?.ready) {
				ent.ready(() => {
					// Tras `ready`, `render` debe existir para checkbox + explicit
					if (window.grecaptcha?.enterprise?.render) ok();
					else {
						queueMicrotask(() => {
							if (window.grecaptcha?.enterprise?.render) ok();
							else fail('reCAPTCHA: API lista pero sin render()');
						});
					}
				});
				return;
			}
			if (attempt > 120) {
				fail('reCAPTCHA: timeout esperando grecaptcha.enterprise');
				return;
			}
			setTimeout(() => waitForEnterpriseApi(attempt + 1), 25);
		};

		const startAfterScriptPresent = () => waitForEnterpriseApi(0);

		if (window.grecaptcha?.enterprise?.ready) {
			startAfterScriptPresent();
			return;
		}

		const existing = document.querySelector<HTMLScriptElement>(
			'script[src*="recaptcha/enterprise.js"]'
		);
		if (existing) {
			const scriptEl = existing as HTMLScriptElement & { complete?: boolean };
			if (scriptEl.complete) startAfterScriptPresent();
			else {
				existing.addEventListener('load', startAfterScriptPresent, { once: true });
				existing.addEventListener('error', () => fail('reCAPTCHA: error cargando script'), {
					once: true
				});
			}
			return;
		}

		const script = document.createElement('script');
		script.src = ENTERPRISE_SCRIPT;
		script.async = true;
		script.defer = true;
		script.onload = () => startAfterScriptPresent();
		script.onerror = () => fail('reCAPTCHA: error cargando script');
		document.head.appendChild(script);
	});

	enterpriseLoadPromise = p;
	void p.catch(() => {
		enterpriseLoadPromise = null;
	});
	return p;
}

export async function renderRecaptchaCheckbox(
	siteKey: string,
	container: HTMLElement
): Promise<number> {
	await loadRecaptchaEnterpriseScript();
	const enterprise = window.grecaptcha?.enterprise;
	if (!enterprise?.render) throw new Error('reCAPTCHA: sin render tras carga');

	return new Promise((resolve, reject) => {
		enterprise.ready(() => {
			try {
				const id = enterprise.render(container, { sitekey: siteKey });
				if (import.meta.env.DEV) console.debug('[reCAPTCHA] widget render id', id);
				resolve(id);
			} catch (e) {
				if (import.meta.env.DEV) console.error('[reCAPTCHA] render()', e);
				reject(e instanceof Error ? e : new Error('reCAPTCHA: render falló'));
			}
		});
	});
}

export function getRecaptchaV2Response(widgetId: number): string {
	return window.grecaptcha?.enterprise?.getResponse(widgetId) ?? '';
}

export function resetRecaptchaV2Widget(widgetId: number): void {
	window.grecaptcha?.enterprise?.reset(widgetId);
}
