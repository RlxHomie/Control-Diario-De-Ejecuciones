/**
 * Autenticación con MSAL + helpers de token.
 * @module auth
 */

import { msalConfig, loginRequest, ENV } from './config.js';
import { showLoading, toast } from './utils.js';

let msalInstance = null;
let currentAccount = null;

/** Inicializa MSAL y resuelve cuenta actual. */
export async function initMSAL() {
  msalInstance = new msal.PublicClientApplication(msalConfig);

  try {
    const resp = await msalInstance.handleRedirectPromise();
    if (resp?.account) currentAccount = resp.account;

    if (!currentAccount) {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length) currentAccount = accounts[0];
    }
    return currentAccount;
  } catch (e) {
    console.error(e);
    toast("Error de autenticación", "error");
    return null;
  }
}

/** Inicia login por redirect. */
export async function login() {
  showLoading(true);
  try {
    await msalInstance.loginRedirect(loginRequest);
  } catch (err) {
    console.error("login()", err);
    toast("Error de inicio de sesión", "error");
  } finally {
    showLoading(false);
  }
}

/** Cierra sesión actual. */
export function logout() {
  const account = currentAccount || msalInstance.getAllAccounts()[0] || null;
  msalInstance.logoutRedirect({
    account,
    postLogoutRedirectUri: msalConfig.auth.redirectUri
  });
}

/** Devuelve (o renueva) access token para Graph. */
export async function getAccessToken() {
  if (!currentAccount) {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length) currentAccount = accounts[0];
  }
  if (!currentAccount) {
    await login();
    throw new Error("Login requerido");
  }

  const req = { scopes: loginRequest.scopes, account: currentAccount };
  try {
    const res = await msalInstance.acquireTokenSilent(req);
    return res.accessToken;
  } catch (e) {
    if (e instanceof msal.InteractionRequiredAuthError) {
      await msalInstance.acquireTokenRedirect(req);
      throw new Error("Redirigiendo para consentimiento/interacción");
    }
    throw e;
  }
}

/** Obtiene información de la cuenta actual (email, nombre). */
export function getCurrentAccount() {
  if (ENV === 'dev') {
    // Modo demo local
    return { name: 'Usuario Demo', username: 'demo@example.com' };
  }
  return currentAccount;
}
