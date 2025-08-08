# Sistema de Gestión de Bonificaciones - Departamento Legal

Sistema web para el seguimiento y cálculo de bonificaciones del departamento legal, con integración a Microsoft 365.

## 🚀 Demo en vivo

[Ver aplicación](https://TU-USUARIO.github.io/bonificaciones-app)

## 📋 Características

- ✅ Registro de actividades legales con puntuación automática
- ✅ Cálculo automático de bonificaciones
- ✅ Dashboard con gráficos de evolución mensual
- ✅ Sistema de roles (usuarios y administradores)
- ✅ Exportación a CSV y PDF
- ✅ Integración con Microsoft Graph API
- ✅ Sincronización con Excel en OneDrive
- ✅ Autenticación con Azure AD

## 🛠️ Tecnologías

- HTML5, CSS3, JavaScript
- Bootstrap 5
- Chart.js
- Microsoft Graph API
- MSAL.js (autenticación)
- jsPDF (exportación)

## 📦 Instalación

### Requisitos previos

1. Cuenta de Microsoft 365
2. Aplicación registrada en Azure AD
3. Archivo Excel en OneDrive con la estructura requerida

### Configuración

1. Clona este repositorio:
   ```bash
   git clone https://github.com/TU-USUARIO/bonificaciones-app.git
   ```

2. Actualiza las credenciales en `index.html`:
   ```javascript
   const msalConfig = {
       auth: {
           clientId: "TU_CLIENT_ID",
           authority: "https://login.microsoftonline.com/TU_TENANT_ID",
           redirectUri: "https://TU-USUARIO.github.io/bonificaciones-app"
       }
   };
   ```

3. Configura los IDs del archivo Excel:
   ```javascript
   const EXCEL_FILE_ID = 'TU_EXCEL_FILE_ID';
   const DRIVE_ID = 'TU_DRIVE_ID';
   ```

## 🔐 Permisos requeridos en Azure AD

- User.Read
- Files.ReadWrite
- Sites.Read.All

## 📊 Tipos de escritos y puntuación

| Tipo de Escrito | Puntos |
|----------------|--------|
| Demanda JV reclamación de cantidad | 2 |
| Recurso de reposición | 1.25 |
| Solicitud de cumplimiento | 0.25 |
| [Ver lista completa...](https://github.com/TU-USUARIO/bonificaciones-app#tipos-de-escritos)

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea tu rama de características (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request
