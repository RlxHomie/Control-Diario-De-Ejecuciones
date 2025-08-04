/* ===================================
   CONFIGURACIÓN Y CONSTANTES
   =================================== */

// Configuración de Microsoft Authentication Library (MSAL)
const msalConfig = {
    auth: {
        clientId: "7ef87bab-74a8-4060-83ed-870ec4bccfef", // ID de la aplicación Azure AD
        authority: "https://login.microsoftonline.com/a70783e2-cf58-4e38-bfd7-b403c7c833af", // Tenant ID
        redirectUri: "https://rlxhomie.github.io/Control-Diario-De-Ejecuciones/" // URL de redirección
    },
    cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false
    }
};

// Configuración de permisos para Microsoft Graph
const loginRequest = {
    scopes: ["User.Read", "Files.ReadWrite", "Files.ReadWrite.All", "Sites.ReadWrite.All"]
};

// Tipos de escritos legales con sus puntuaciones correspondientes
const tiposEscritos = {
    "Solicitud tasación de costas / Incidente / Aclarar minuta": 2,
    "Solicitud de cumplimiento": 0.25,
    "Impugnación de costas": 1.5,
    "Oposición impugnación de costas": 2,
    "Recurso de revisión": 2,
    "Oposición recurso de revisión": 2,
    "Recurso de reposición": 1.25,
    "Cesión de costas": 0.5,
    "Liquidación de intereses": 1,
    "Solicitud mandamiento pago": 0.25,
    "Impulsos procesales": 0.25,
    "Aclarar/presentar cuenta bancaria": 0.5,
    "Demanda JV reclamación de cantidad": 2,
    "Demanda Cesión Crédito": 2,
    "Demanda ETJ": 1.25,
    "Oposición ETJ": 1.25,
    "Escrito de conformidad": 0.5,
    "Alegaciones envío Colegio": 0.5,
    "Solicitud TC ETJ": 1.5,
    "Análisis cuadro amortización": 0.5,
    "Desgloses": 0.5,
    "Control procesal": 0.25
};

// Configuración de Excel para almacenamiento en la nube
const EXCEL_CONFIG = {
    fileId: "01WYAE7MQH7SY7HM2BD5GJO5HUP3PRFJDN", // ID del archivo Excel en OneDrive
    driveId: null, // ID del drive (se obtiene automáticamente)
    fileName: "Bonificaciones.xlsx", // Nombre del archivo Excel
    folderPath: "/" // Ruta de la carpeta (raíz)
};

/* ===================================
   VARIABLES GLOBALES
   =================================== */
let msalInstance; // Instancia de MSAL para autenticación
let currentUser = null; // Usuario actualmente autenticado
let entries = []; // Array de entradas de bonificaciones
let users = []; // Array de usuarios del sistema
let pointsChart = null; // Instancia del gráfico de puntos
let accessToken = null; // Token de acceso para Microsoft Graph API

/* ===================================
   FUNCIONES DE AUTENTICACIÓN
   =================================== */

// Inicializar Microsoft Authentication Library
function initializeMSAL() {
    msalInstance = new msal.PublicClientApplication(msalConfig);
    
    msalInstance.handleRedirectPromise()
        .then(handleResponse)
        .catch(err => {
            console.error(err);
            showNotification('Error al iniciar sesión', 'error');
        });
}

// Manejar respuesta de autenticación
function handleResponse(response) {
    if (response !== null) {
        currentUser = response.account;
        accessToken = response.accessToken;
        showMainApp();
    } else {
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
            currentUser = accounts[0];
            getTokenSilently();
        }
    }
}

// Obtener token de acceso silenciosamente
async function getTokenSilently() {
    const tokenRequest = {
        scopes: loginRequest.scopes,
        account: currentUser
    };

    try {
        const response = await msalInstance.acquireTokenSilent(tokenRequest);
        accessToken = response.accessToken;
        showMainApp();
    } catch (error) {
        if (error instanceof msal.InteractionRequiredAuthError) {
            msalInstance.acquireTokenRedirect(tokenRequest);
        }
    }
}

// Función de inicio de sesión
async function login() {
    try {
        showLoading(true);
        await msalInstance.loginRedirect(loginRequest);
    } catch (error) {
        console.error(error);
        showNotification('Error al iniciar sesión', 'error');
        showLoading(false);
    }
}

// Función de cierre de sesión
function logout() {
    const logoutRequest = {
        account: currentUser,
        postLogoutRedirectUri: window.location.origin
    };
    msalInstance.logoutRedirect(logoutRequest);
}

/* ===================================
   FUNCIONES DE INICIALIZACIÓN
   =================================== */

// Mostrar aplicación principal después de autenticación
async function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    // Cargar datos del usuario e inicializar aplicación
    await loadUserData();
    initializeApp();
}

// Cargar datos del usuario desde Excel
async function loadUserData() {
    try {
        showLoading(true);
        // Cargar usuarios primero
        await loadUsersFromExcel();
        // Luego cargar entradas
        await loadEntriesFromExcel();
        
        showLoading(false);
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Usando modo offline', 'warning');
        loadFromLocalStorage();
        showLoading(false);
    }
}

// Inicializar la aplicación
function initializeApp() {
    // Establecer fecha actual
    document.getElementById('fecha').value = new Date().toISOString().split('T')[0];
    
    // Poblar elementos select
    populateSelects();
    
    // Configurar event listeners
    setupEventListeners();
    
    // Verificar si el usuario es administrador
    checkAdminRole();
    
    // Cargar dashboard
    loadDashboard();
    
    // Inicializar gráfico
    initializeChart();
}

/* ===================================
   FUNCIONES DE INTERFAZ DE USUARIO
   =================================== */

// Poblar elementos select con opciones
function populateSelects() {
    const tipoEscritoSelect = document.getElementById('tipoEscrito');
    const editTipoEscritoSelect = document.getElementById('editTipoEscrito');
    const filterTypeSelect = document.getElementById('filterType');
    
    // Limpiar opciones existentes
    tipoEscritoSelect.innerHTML = '<option value="">Seleccione un tipo...</option>';
    editTipoEscritoSelect.innerHTML = '<option value="">Seleccione un tipo...</option>';
    filterTypeSelect.innerHTML = '<option value="">Todos</option>';
    
    // Agregar opciones
    Object.keys(tiposEscritos).forEach(tipo => {
        const option = new Option(tipo, tipo);
        tipoEscritoSelect.add(option.cloneNode(true));
        editTipoEscritoSelect.add(option.cloneNode(true));
        filterTypeSelect.add(option.cloneNode(true));
    });
}

// Configurar event listeners
function setupEventListeners() {
    // Navegación
    document.querySelectorAll('.nav-link[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showSection(e.target.closest('.nav-link').dataset.section);
        });
    });
    
    // Formularios
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('tipoEscrito').addEventListener('change', updatePointsPreview);
    document.getElementById('expediente').addEventListener('input', validateExpediente);
    
    // Filtros
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    
    // Acciones de administrador
    document.getElementById('exportCSV').addEventListener('click', exportToCSV);
    document.getElementById('exportPDF').addEventListener('click', exportToPDF);
    document.getElementById('saveEdit').addEventListener('click', saveEdit);
    
    // Cerrar sesión
    document.getElementById('logoutButton').addEventListener('click', logout);
}

// Mostrar sección específica
function showSection(section) {
    // Ocultar todas las secciones
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.style.display = 'none';
    });
    
    // Mostrar sección seleccionada
    document.getElementById(section + 'Section').style.display = 'block';
    
    // Actualizar navegación activa
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    
    // Cargar datos de la sección
    switch(section) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'history':
            loadHistory();
            break;
        case 'admin':
            loadAdminPanel();
            break;
    }
}

/* ===================================
   FUNCIONES DE GESTIÓN DE ENTRADAS
   =================================== */

// Manejar registro de nueva entrada
async function handleRegister(e) {
    e.preventDefault();
    
    const fecha = document.getElementById('fecha').value;
    const expediente = document.getElementById('expediente').value.trim();
    const tipoEscrito = document.getElementById('tipoEscrito').value;
    
    // Validar que el expediente sea único
    if (entries.some(entry => entry.expediente === expediente)) {
        document.getElementById('expedienteError').textContent = 'Este expediente ya existe';
        return;
    }
    
    const entry = {
        id: Date.now().toString(),
        usuario: currentUser.name || currentUser.username.split('@')[0],
        usuarioId: currentUser.username,
        fecha: fecha,
        expediente: expediente,
        tipoEscrito: tipoEscrito,
        puntos: tiposEscritos[tipoEscrito]
    };
    
    try {
        showLoading(true);
        
        // Agregar localmente primero
        entries.push(entry);
        saveToLocalStorage();
        
        // Intentar guardar en Excel
        if (EXCEL_CONFIG.fileId && EXCEL_CONFIG.fileId !== "TU_FILE_ID_AQUI") {
            await addEntryToExcel(entry);
        }
        
        // Resetear formulario
        document.getElementById('registerForm').reset();
        document.getElementById('fecha').value = new Date().toISOString().split('T')[0];
        document.getElementById('puntosPreview').textContent = '-';
        
        showNotification('Entrada registrada exitosamente', 'success');
        showLoading(false);
        
        // Actualizar dashboard
        loadDashboard();
    } catch (error) {
        console.error('Error registering entry:', error);
        showNotification('Error al registrar entrada', 'error');
        showLoading(false);
    }
}

// Actualizar vista previa de puntos
function updatePointsPreview() {
    const tipoEscrito = document.getElementById('tipoEscrito').value;
    const preview = document.getElementById('puntosPreview');
    
    if (tipoEscrito && tiposEscritos[tipoEscrito]) {
        preview.textContent = tiposEscritos[tipoEscrito] + ' puntos';
    } else {
        preview.textContent = '-';
    }
}

// Validar expediente único
function validateExpediente() {
    const expediente = document.getElementById('expediente').value.trim();
    const errorDiv = document.getElementById('expedienteError');
    
    if (entries.some(entry => entry.expediente === expediente)) {
        errorDiv.textContent = 'Este expediente ya existe';
    } else {
        errorDiv.textContent = '';
    }
}

// Editar entrada existente
function editEntry(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    
    document.getElementById('editId').value = entry.id;
    document.getElementById('editFecha').value = entry.fecha;
    document.getElementById('editExpediente').value = entry.expediente;
    document.getElementById('editTipoEscrito').value = entry.tipoEscrito;
    
    const modal = new bootstrap.Modal(document.getElementById('editModal'));
    modal.show();
}

// Guardar cambios de edición
async function saveEdit() {
    const id = document.getElementById('editId').value;
    const fecha = document.getElementById('editFecha').value;
    const expediente = document.getElementById('editExpediente').value.trim();
    const tipoEscrito = document.getElementById('editTipoEscrito').value;
    
    const entryIndex = entries.findIndex(e => e.id === id);
    if (entryIndex === -1) return;
    
    // Verificar que el expediente sea único (excluyendo la entrada actual)
    if (entries.some((e, i) => e.expediente === expediente && i !== entryIndex)) {
        showNotification('Este expediente ya existe', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        entries[entryIndex] = {
            ...entries[entryIndex],
            fecha: fecha,
            expediente: expediente,
            tipoEscrito: tipoEscrito,
            puntos: tiposEscritos[tipoEscrito]
        };
        
        saveToLocalStorage();
        
        bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
        showNotification('Entrada actualizada exitosamente', 'success');
        
        // Actualizar vista actual
        if (document.getElementById('historySection').style.display !== 'none') {
            loadHistory();
        } else if (document.getElementById('adminSection').style.display !== 'none') {
            loadAdminPanel();
        }
        
        showLoading(false);
    } catch (error) {
        console.error('Error updating entry:', error);
        showNotification('Error al actualizar entrada', 'error');
        showLoading(false);
    }
}

// Eliminar entrada
async function deleteEntry(id) {
    if (!confirm('¿Está seguro de eliminar esta entrada?')) return;
    
    try {
        showLoading(true);
        
        entries = entries.filter(e => e.id !== id);
        saveToLocalStorage();
        
        showNotification('Entrada eliminada exitosamente', 'success');
        
        // Actualizar vista actual
        if (document.getElementById('historySection').style.display !== 'none') {
            loadHistory();
        } else if (document.getElementById('adminSection').style.display !== 'none') {
            loadAdminPanel();
        } else {
            loadDashboard();
        }
        
        showLoading(false);
    } catch (error) {
        console.error('Error deleting entry:', error);
        showNotification('Error al eliminar entrada', 'error');
        showLoading(false);
    }
}

/* ===================================
   FUNCIONES DE DASHBOARD Y GRÁFICOS
   =================================== */

// Cargar dashboard principal
function loadDashboard() {
    const userEntries = entries.filter(e => e.usuarioId === currentUser.username);
    const totalPoints = userEntries.reduce((sum, entry) => sum + entry.puntos, 0);
    
    document.getElementById('totalPoints').textContent = totalPoints.toFixed(2);
    
    // Entradas recientes
    const recentEntries = userEntries.slice(-5).reverse();
    const recentEntriesHtml = recentEntries.length > 0 ? 
        recentEntries.map(entry => `
            <div class="d-flex justify-content-between align-items-center p-2 border-bottom">
                <div>
                    <strong>${entry.tipoEscrito}</strong><br>
                    <small class="text-muted">${formatDate(entry.fecha)} - ${entry.expediente}</small>
                </div>
                <span class="badge bg-success">${entry.puntos} pts</span>
            </div>
        `).join('') : 
        '<p class="text-muted text-center">No hay entradas registradas</p>';
    
    document.getElementById('recentEntries').innerHTML = recentEntriesHtml;
    
    // Actualizar gráfico
    updateChart();
}

// Inicializar gráfico de puntos
function initializeChart() {
    const ctx = document.getElementById('pointsChart').getContext('2d');
    pointsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Puntos por Mes',
                data: [],
                borderColor: 'rgb(52, 152, 219)',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Actualizar gráfico con datos del usuario
function updateChart() {
    const userEntries = entries.filter(e => e.usuarioId === currentUser.username);
    const monthlyData = {};
    
    userEntries.forEach(entry => {
        const month = entry.fecha.substring(0, 7); // YYYY-MM
        monthlyData[month] = (monthlyData[month] || 0) + entry.puntos;
    });
    
    const sortedMonths = Object.keys(monthlyData).sort();
    const labels = sortedMonths.map(month => {
        const [year, monthNum] = month.split('-');
        return new Date(year, monthNum - 1).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    });
    
    pointsChart.data.labels = labels;
    pointsChart.data.datasets[0].data = sortedMonths.map(month => monthlyData[month]);
    pointsChart.update();
}

/* ===================================
   FUNCIONES DE HISTORIAL Y FILTROS
   =================================== */

// Cargar historial de entradas
function loadHistory() {
    const userEntries = entries.filter(e => e.usuarioId === currentUser.username);
    displayHistoryTable(userEntries);
}

// Mostrar tabla de historial
function displayHistoryTable(entriesToDisplay) {
    const tbody = document.getElementById('historyTableBody');
    
    if (entriesToDisplay.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay entradas para mostrar</td></tr>';
        return;
    }
    
    tbody.innerHTML = entriesToDisplay.map(entry => `
        <tr>
            <td>${formatDate(entry.fecha)}</td>
            <td>${entry.expediente}</td>
            <td>${entry.tipoEscrito}</td>
            <td><span class="badge bg-success">${entry.puntos}</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editEntry('${entry.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteEntry('${entry.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Aplicar filtros de búsqueda
function applyFilters() {
    const dateFrom = document.getElementById('filterDateFrom').value;
    const dateTo = document.getElementById('filterDateTo').value;
    const type = document.getElementById('filterType').value;
    
    let filtered = entries.filter(e => e.usuarioId === currentUser.username);
    
    if (dateFrom) {
        filtered = filtered.filter(e => e.fecha >= dateFrom);
    }
    
    if (dateTo) {
        filtered = filtered.filter(e => e.fecha <= dateTo);
    }
    
    if (type) {
        filtered = filtered.filter(e => e.tipoEscrito === type);
    }
    
    displayHistoryTable(filtered);
}

/* ===================================
   FUNCIONES DE ADMINISTRACIÓN
   =================================== */

// Verificar rol de administrador
function checkAdminRole() {
    // Para propósitos de demostración, verificar si el email contiene 'admin'
    const isAdmin = currentUser.username.toLowerCase().includes('admin');
    
    if (isAdmin) {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'block';
        });
    }
}

// Cargar panel de administración
function loadAdminPanel() {
    // Cargar resumen de usuarios
    const usersSummary = {};
    entries.forEach(entry => {
        if (!usersSummary[entry.usuario]) {
            usersSummary[entry.usuario] = {
                nombre: entry.usuario,
                puntos: 0,
                entradas: 0
            };
        }
        usersSummary[entry.usuario].puntos += entry.puntos;
        usersSummary[entry.usuario].entradas += 1;
    });
    
    const summaryHtml = Object.values(usersSummary).map(user => `
        <div class="col-md-4 mb-3">
            <div class="card text-center">
                <div class="card-body">
                    <h5 class="card-title">${user.nombre}</h5>
                    <p class="card-text">
                        <span class="display-6 text-primary">${user.puntos.toFixed(2)}</span><br>
                        <small class="text-muted">puntos totales</small>
                    </p>
                    <p class="card-text">
                        <small>${user.entradas} entradas</small>
                    </p>
                </div>
            </div>
        </div>
    `).join('');
    
    document.getElementById('usersSummary').innerHTML = `<div class="row">${summaryHtml}</div>`;
    
    // Cargar tabla de todas las entradas
    displayAdminTable(entries);
}

// Mostrar tabla de administración
function displayAdminTable(entriesToDisplay) {
    const tbody = document.getElementById('adminTableBody');
    
    if (entriesToDisplay.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay entradas para mostrar</td></tr>';
        return;
    }
    
    tbody.innerHTML = entriesToDisplay.map(entry => `
        <tr>
            <td>${entry.usuario}</td>
            <td>${formatDate(entry.fecha)}</td>
            <td>${entry.expediente}</td>
            <td>${entry.tipoEscrito}</td>
            <td><span class="badge bg-success">${entry.puntos}</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editEntry('${entry.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteEntry('${entry.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

/* ===================================
   FUNCIONES DE EXPORTACIÓN
   =================================== */

// Exportar datos a CSV
function exportToCSV() {
    let csv = 'Usuario,Fecha,Expediente,Tipo de Escrito,Puntos\n';
    
    entries.forEach(entry => {
        csv += `"${entry.usuario}","${formatDate(entry.fecha)}","${entry.expediente}","${entry.tipoEscrito}",${entry.puntos}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bonificaciones_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showNotification('Archivo CSV exportado exitosamente', 'success');
}

// Exportar datos a PDF
function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(20);
    doc.text('Informe de Bonificaciones', 14, 22);
    
    // Fecha
    doc.setFontSize(10);
    doc.text(`Fecha de generación: ${formatDate(new Date().toISOString().split('T')[0])}`, 14, 30);
    
    // Tabla
    const tableData = entries.map(entry => [
        entry.usuario,
        formatDate(entry.fecha),
        entry.expediente,
        entry.tipoEscrito,
        entry.puntos.toString()
    ]);
    
    doc.autoTable({
        head: [['Usuario', 'Fecha', 'Expediente', 'Tipo de Escrito', 'Puntos']],
        body: tableData,
        startY: 40,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [44, 62, 80] }
    });
    
    // Resumen
    const usersSummary = {};
    entries.forEach(entry => {
        if (!usersSummary[entry.usuario]) {
            usersSummary[entry.usuario] = 0;
        }
        usersSummary[entry.usuario] += entry.puntos;
    });
    
    const summaryY = doc.autoTable.previous.finalY + 10;
    doc.setFontSize(12);
    doc.text('Resumen de Puntos por Usuario', 14, summaryY);
    
    let currentY = summaryY + 10;
    Object.entries(usersSummary).forEach(([usuario, puntos]) => {
        doc.setFontSize(10);
        doc.text(`${usuario}: ${puntos.toFixed(2)} puntos`, 14, currentY);
        currentY += 6;
    });
    
    // Guardar
    doc.save(`bonificaciones_${new Date().toISOString().split('T')[0]}.pdf`);
    
    showNotification('Archivo PDF exportado exitosamente', 'success');
}

/* ===================================
   FUNCIONES DE EXCEL (MICROSOFT GRAPH API)
   =================================== */

// Obtener ID del archivo Excel automáticamente
async function getExcelFileId() {
    try {
        const response = await fetch(
            `https://graph.microsoft.com/v1.0/me/drive/root:${EXCEL_CONFIG.folderPath}${EXCEL_CONFIG.fileName}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            console.log('Archivo Excel encontrado:', data.name);
            console.log('File ID:', data.id);
            EXCEL_CONFIG.fileId = data.id;
            EXCEL_CONFIG.driveId = data.parentReference.driveId;
            return data.id;
        } else {
            throw new Error('Archivo no encontrado');
        }
    } catch (error) {
        console.error('Error buscando archivo:', error);
        showNotification('Error: No se encontró el archivo Excel', 'error');
        return null;
    }
}

// Cargar entradas desde Excel
async function loadEntriesFromExcel() {
    try {
        showLoading(true);
        
        // Leer la hoja de Entradas
        const response = await fetch(
            `https://graph.microsoft.com/v1.0/me/drive/items/${EXCEL_CONFIG.fileId}/workbook/worksheets('Entradas')/usedRange`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );
        
        if (!response.ok) {
            throw new Error('Error al leer Excel');
        }
        
        const data = await response.json();
        
        if (data.values && data.values.length > 1) {
            // La primera fila son los headers
            const rows = data.values.slice(1);
            
            entries = rows.map(row => ({
                id: row[0]?.toString() || '',
                usuario: row[1] || '',
                usuarioId: row[1] || '', // Usar el valor tal cual del Excel
                fecha: formatExcelDate(row[2]),
                expediente: row[3] || '',
                tipoEscrito: row[4] || '',
                puntos: parseFloat(row[5]) || 0
            })).filter(entry => entry.id && entry.expediente);
        }
        
        showLoading(false);
        showNotification('Datos cargados desde Excel', 'success');
        console.log(`Se cargaron ${entries.length} entradas`);
        
    } catch (error) {
        console.error('Error al cargar desde Excel:', error);
        showNotification('Usando datos locales', 'warning');
        loadFromLocalStorage();
        showLoading(false);
    }
}

// Cargar usuarios desde Excel
async function loadUsersFromExcel() {
    try {
        const response = await fetch(
            `https://graph.microsoft.com/v1.0/me/drive/items/${EXCEL_CONFIG.fileId}/workbook/worksheets('Usuarios')/usedRange`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );
        
        if (!response.ok) {
            console.log('No se pudo cargar la hoja de usuarios');
            return;
        }
        
        const data = await response.json();
        
        if (data.values && data.values.length > 1) {
            const rows = data.values.slice(1);
            
            users = rows.map(row => ({
                id: row[0] || '',
                nombre: row[1] || '',
                rol: row[2] || 'Estándar'
            })).filter(user => user.id);
            
            console.log(`Se cargaron ${users.length} usuarios`);
        }
        
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
    }
}

// Agregar entrada al Excel
async function addEntryToExcel(entry) {
    try {
        // Primero obtener el número de filas actuales
        const rangeResponse = await fetch(
            `https://graph.microsoft.com/v1.0/me/drive/items/${EXCEL_CONFIG.fileId}/workbook/worksheets('Entradas')/usedRange`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );
        
        const rangeData = await rangeResponse.json();
        const nextRow = rangeData.values ? rangeData.values.length + 1 : 2;
        
        // Preparar los datos
        const values = [[
            entry.id,
            entry.usuario,
            entry.fecha,
            entry.expediente,
            entry.tipoEscrito,
            entry.puntos
        ]];
        
        // Agregar la nueva fila
        const response = await fetch(
            `https://graph.microsoft.com/v1.0/me/drive/items/${EXCEL_CONFIG.fileId}/workbook/worksheets('Entradas')/range(address='A${nextRow}:F${nextRow}')`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values: values })
            }
        );
        
        if (response.ok) {
            console.log('Entrada guardada en Excel');
        } else {
            throw new Error('Error al guardar en Excel');
        }
        
    } catch (error) {
        console.error('Error al guardar en Excel:', error);
        showNotification('Guardado solo localmente', 'warning');
    }
}

// Formatear fecha de Excel
function formatExcelDate(value) {
    if (!value) return '';
    
    // Si ya es string en formato DD/MM/YYYY
    if (typeof value === 'string' && value.includes('/')) {
        const [day, month, year] = value.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Si es número serial de Excel
    if (typeof value === 'number') {
        const date = new Date((value - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0];
    }
    
    return value;
}

/* ===================================
   FUNCIONES DE ALMACENAMIENTO LOCAL
   =================================== */

// Guardar en localStorage (modo offline)
function saveToLocalStorage() {
    localStorage.setItem('bonificaciones_entries', JSON.stringify(entries));
    localStorage.setItem('bonificaciones_users', JSON.stringify(users));
}

// Cargar desde localStorage
function loadFromLocalStorage() {
    const savedEntries = localStorage.getItem('bonificaciones_entries');
    const savedUsers = localStorage.getItem('bonificaciones_users');
    
    if (savedEntries) {
        entries = JSON.parse(savedEntries);
    }
    
    if (savedUsers) {
        users = JSON.parse(savedUsers);
    } else {
        // Usuarios por defecto para demostración
        users = [
            { id: '1', nombre: 'Usuario Demo', rol: 'Estándar' },
            { id: '2', nombre: 'Admin Demo', rol: 'Admin' }
        ];
    }
}

/* ===================================
   FUNCIONES UTILITARIAS
   =================================== */

// Formatear fecha para mostrar
function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });
}

// Mostrar notificación
function showNotification(message, type = 'info') {
    const bgColor = {
        success: '#27ae60',
        error: '#e74c3c',
        warning: '#f39c12',
        info: '#3498db'
    }[type] || '#3498db';
    
    Toastify({
        text: message,
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: bgColor,
        stopOnFocus: true
    }).showToast();
}

// Mostrar/ocultar spinner de carga
function showLoading(show) {
    const spinner = document.querySelector('.loading-spinner');
    if (show) {
        spinner.classList.add('show');
    } else {
        spinner.classList.remove('show');
    }
}

/* ===================================
   INICIALIZACIÓN DE LA APLICACIÓN
   =================================== */

// Inicializar aplicación
initializeMSAL();

// Configurar el botón de login inmediatamente
document.addEventListener('DOMContentLoaded', function() {
    const loginButton = document.getElementById('loginButton');
    if (loginButton) {
        console.log('Botón de login encontrado y configurado');
        loginButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Intentando login...');
            login();
        });
    } else {
        console.error('ERROR: No se encontró el botón de login');
    }
});

// Para propósitos de demostración, permitir pruebas sin autenticación
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    currentUser = {
        name: 'Usuario Demo',
        username: 'demo@example.com'
    };
    showMainApp();
}

