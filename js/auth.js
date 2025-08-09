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
  if (ENV === 'dev') {
    // Modo demo para desarrollo local
    return { name: 'Usuario Demo', username: 'demo@example.com' };
  }

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
  if (ENV === 'dev') {
    // En modo demo, simular login exitoso
    currentAccount = { name: 'Usuario Demo', username: 'demo@example.com' };
    // Recargar la página para simular el redirect
    window.location.reload();
    return;
  }

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
  if (ENV === 'dev') {
    // En modo demo, simplemente recargar
    currentAccount = null;
    window.location.reload();
    return;
  }

  const account = currentAccount || msalInstance.getAllAccounts()[0] || null;
  msalInstance.logoutRedirect({
    account,
    postLogoutRedirectUri: msalConfig.auth.redirectUri
  });
}

/** Devuelve (o renueva) access token para Graph. */
export async function getAccessToken() {
  if (ENV === 'dev') {
    // Modo demo: retornar token falso
    return 'demo-token-12345';
  }

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

/** Obtiene todas las cuentas disponibles */
export function getAccounts() {
  if (ENV === 'dev') {
    // En modo demo, retornar cuenta simulada si hay currentAccount
    return currentAccount ? [currentAccount] : [];
  }

  if (!msalInstance) {
    return [];
  }
  
  return msalInstance.getAllAccounts();
}

/** Obtiene información de la cuenta actual (email, nombre). */
export function getCurrentAccount() {
  if (ENV === 'dev') {
    // Modo demo local
    return currentAccount || { name: 'Usuario Demo', username: 'demo@example.com' };
  }
  return currentAccount;
}
