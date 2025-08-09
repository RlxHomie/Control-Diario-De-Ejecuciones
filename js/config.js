/**
 * Configuración global de la app.
 * @module config
 */

export const ENV = location.hostname.includes('localhost') ? 'dev' : 'prod';

/** @type {import('@azure/msal-browser').Configuration} */
export const msalConfig = {
  auth: {
    clientId: "7ef87bab-74a8-4060-83ed-870ec4bccfef",
    authority: "https://login.microsoftonline.com/a70783e2-cf58-4e38-bfd7-b403c7c833af",
    redirectUri: ENV === 'dev'
      ? "http://localhost:5173"
      : "https://rlxhomie.github.io/Control-Diario-De-Ejecuciones/"
  },
  cache: { cacheLocation: "sessionStorage", storeAuthStateInCookie: false }
};

export const loginRequest = {
  scopes: ["User.Read","Files.ReadWrite","Files.ReadWrite.All","Sites.ReadWrite.All"]
};

export const EXCEL = {
  fileId: "01WYAE7MQH7SY7HM2BD5GJO5HUP3PRFJDN",
  tables: {
    Usuarios: "Usuarios",
    Tipos: "TiposEscritos",
    Config: "Configuracion",
    Entradas: "Entradas",
    Historial: "HistorialCambios",
    Calendario: "Calendario"
  }
};
