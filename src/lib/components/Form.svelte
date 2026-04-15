<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { postContactInfo } from '$lib/api/form';
	import {
		getRecaptchaV2Response,
		renderRecaptchaCheckbox,
		resetRecaptchaV2Widget
	} from '$lib/recaptcha';
	import { onMount, tick } from 'svelte';
	import { marked } from 'marked';
	import Loader from './Loader.svelte';
	import DOMPurify from 'isomorphic-dompurify';

	let isLoading = false;
	let submitError = false;
	let captchaError = false;
	/** Fallo al cargar o renderizar el script / widget. */
	let recaptchaLoadError = false;
	/** Envío antes de que el widget esté listo (p. ej. carrera de hidratación). */
	let recaptchaNotReadyError = false;
	let sent = false;
	let recaptchaContainer: HTMLDivElement | undefined;
	let recaptchaWidgetId: number | null = null;
	export let content: { [key: string]: string | { [key: string]: string } };
	/** Preferido: viene del servidor (contacto) para que el cliente siempre tenga la clave. */
	export let recaptchaSiteKey = '';

	$: siteKey =
		recaptchaSiteKey.trim() || (typeof env.PUBLIC_RECAPTCHA_SITE_KEY === 'string'
			? env.PUBLIC_RECAPTCHA_SITE_KEY.trim()
			: '');

	const formDataParsed = (formData: FormData): { [key: string]: string } => {
		const obj: { [key: string]: any } = {};
		for (const [key, value] of formData.entries()) {
			obj[key] = value;
		}
		return obj;
	};

	/** Texto en `translations.form` (CMS). */
	function formStr(key: string): string {
		const v = content[key];
		return typeof v === 'string' ? v : '';
	}

	onMount(() => {
		void (async () => {
			await tick();
			const k = siteKey;
			if (!k || !recaptchaContainer) return;
			try {
				recaptchaWidgetId = await renderRecaptchaCheckbox(k, recaptchaContainer);
				recaptchaLoadError = false;
			} catch (e) {
				recaptchaLoadError = true;
				if (import.meta.env.DEV) console.error('[Form] reCAPTCHA', e);
			}
		})();
	});

	const onSubmit = async (event: Event) => {
		try {
			isLoading = true;
			submitError = false;
			captchaError = false;
			recaptchaLoadError = false;
			recaptchaNotReadyError = false;
			event.preventDefault();
			const formData = new FormData(event.target as HTMLFormElement);

			const formDataObj = formDataParsed(formData);
			if (siteKey) {
				if (recaptchaWidgetId === null) {
					recaptchaNotReadyError = true;
					return;
				}
				const token = getRecaptchaV2Response(recaptchaWidgetId);
				if (!token) {
					captchaError = true;
					return;
				}
				formDataObj.recaptcha_token = token;
			}
			const res = await postContactInfo(formDataObj);
			if (!res.ok) throw new Error('contact');
			sent = true;
		} catch (err) {
			submitError = true;
			if (recaptchaWidgetId !== null) resetRecaptchaV2Widget(recaptchaWidgetId);
		} finally {
			isLoading = false;
		}
	};

	function parseMarkdown(value: string) {
		return DOMPurify.sanitize(marked.parseInline(value, { async: false }));
	}
</script>

<form on:submit={onSubmit}>
		{#each Object.entries(content.input) as [key, value]}
		<div class={key === 'terms' ? 'row-input' : 'col-input'}>
			<label for={key}>{@html parseMarkdown(value)}</label>
			{#if key === 'tell_more'}
				<textarea id={key} name={key}></textarea>
			{:else if key === 'terms'}
				<input type="checkbox" id={key} name={key} required />
			{:else}
				<input type="input" id={key} name={key} required />
			{/if}
		</div>
	{/each}
	{#if siteKey}
		<div class="recaptcha-wrap" bind:this={recaptchaContainer}></div>
	{/if}
	{#if recaptchaLoadError}
		<p class="error" role="alert">{formStr('error_recaptcha_load')}</p>
	{/if}
	{#if recaptchaNotReadyError}
		<p class="error" role="alert">{formStr('error_recaptcha_not_ready')}</p>
	{/if}
	{#if captchaError}
		<p class="error" role="alert">{formStr('error_captcha')}</p>
	{/if}
	{#if submitError}
		<p class="error" role="alert">{formStr('error_submit')}</p>
	{/if}
	{#if isLoading}
		<Loader />
	{:else}
		<div>
			{#if sent}
				<p class="success">{content.thanks}</p>
			{:else}
				<button name="form submit" type="submit">{content.send}</button>
			{/if}
		</div>
	{/if}
</form>

<style lang="scss">
	@import '../../styles/colors.scss';

	form {
		width: 100%;
		display: flex;
		flex-direction: column;
	}

	div.row-input {
		display: flex;
		flex-direction: row-reverse;
	}

	div.col-input {
		display: flex;
		flex-direction: column;
	}

	div.row-input > input {
		margin: 0 10px 0 0;
	}

	.recaptcha-wrap {
		display: flex;
		justify-content: center;
		margin: 8px 0 16px;
	}

	p {
		font-size: 1.2rem;
		font-weight: 500;
		color: $neutral-80;
		margin-bottom: 40px;
	}
	label {
		font-size: 0.8rem;
		font-weight: 400;
		color: $neutral-80;
	}

	input,
	textarea {
		padding: 1rem;
		border-width: 0px 0px 1px 0px;
		border-color: $neutral-60;
		border-radius: 6px;
		margin-bottom: 20px;
	}

	textarea {
		height: 80px;
	}

	input,
	textarea:focus-visible {
		outline-color: $neutral-20;
		outline-offset: -0.3rem;
	}

	button {
		width: 100%;
		margin-top: 20px;
		padding: 0.5rem 2rem;
		background-color: $white;
		border: 1px solid $black;
		border-radius: 4px;
		color: $black;
		font-style: italic;
	}

	button:hover {
		background-color: $neutral-90;
		color: $white;
	}

	div {
		display: flex;
		justify-content: center;
	}

	.success {
		font-size: 1.2rem;
		font-weight: 600;
		color: $neutral-80;
		text-decoration: underline;
		font-style: italic;
		text-underline-offset: 8px;
	}

	.error {
		color: #b42318;
		margin-bottom: 0;
	}
</style>
