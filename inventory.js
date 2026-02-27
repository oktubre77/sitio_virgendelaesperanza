// =============================================
// CONFIGURACIÓN - SIN API KEY
// =============================================
const SHEET_ID = '18p1PD7pWc8dpu3HBIpK5cvym8OIFloRP-61RYH8SHd8';
const SHEET_GID = '0';

// URL para leer datos como CSV (NO requiere API Key)
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/e/2PACX-1vQiMLu3X3IYy1ioW07zWfkVINkL417flSltqucnme3iCfwYB1-ihYGE-wEpM-5pVW9o-1kFQitwM7UH/pub?gid=1473277691&single=true&output=csv`;

// URL para editar
const EDIT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
const LOW_STOCK_THRESHOLD = 5;

let inventoryData = [];

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    const inventoryTable = document.getElementById('inventory-table');
    if (inventoryTable) {
        loadInventory();
    }
});

// =============================================
// FUNCIONES DE INVENTARIO
// =============================================
async function loadInventory() {
    const tableBody = document.getElementById('inventory-table');
    if (!tableBody) return;
    
    tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="p-8 text-center text-gray-500">
                <div class="flex items-center justify-center gap-2">
                    <svg class="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Cargando inventario...
                </div>
            </td>
        </tr>
    `;

    try {
        const response = await fetch(SHEET_CSV_URL);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const csvText = await response.text();
        inventoryData = parseCSV(csvText);
        
        renderInventory();
        updateLastUpdate('Google Sheets');
        showNotification('✅ Inventario actualizado', 'success');
        
    } catch (error) {
        console.error('Error cargando inventario:', error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="p-8 text-center">
                    <div class="text-red-500 mb-4">
                        ❌ Error al cargar: ${error.message}
                    </div>
                    <button onclick="loadInventory()" 
                            class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 mr-2">
                        🔄 Reintentar
                    </button>
                    <button onclick="loadSampleData()" 
                            class="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600">
                        📋 Datos de ejemplo
                    </button>
                </td>
            </tr>
        `;
    }
}

// Parsear CSV a array de objetos
function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const result = [];
    
    // Saltar la primera línea (encabezados)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Manejar comas dentro de comillas
        const values = parseCSVLine(line);
        
        if (values.length >= 5 && values[0]) {
            result.push({
                producto: values[0] || '',
                inventarioTotal: parseInt(values[1]) || 0,
                descripcion: values[2] || '',
                cantidadRetirar: parseInt(values[3]) || 0,
                stockFinal: parseInt(values[4]) || 0
            });
        }
    }
    
    return result;
}

// Parsear línea CSV manejando comillas
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

function loadSampleData() {
    inventoryData = [
        { producto: 'Aceite', inventarioTotal: 11, descripcion: '1 u. (02/02) + 10 u. de 900ml (08/02) +1', cantidadRetirar: 0, stockFinal: 11 },
        { producto: 'Arroz', inventarioTotal: 6, descripcion: '2 paq. de kilo (02/02) + 4 paq. de kilo (08/02) +1', cantidadRetirar: 0, stockFinal: 6 },
        { producto: 'Arvejas', inventarioTotal: 2, descripcion: 'Latas Donación particular (08/02) +2', cantidadRetirar: 2, stockFinal: 0 },
        { producto: 'Atún', inventarioTotal: 2, descripcion: 'Latas Donación particular (08/02) +2', cantidadRetirar: 0, stockFinal: 2 },
        { producto: 'Bolsas', inventarioTotal: 1, descripcion: 'Bolsas transparentes medianas (03/02)', cantidadRetirar: 0, stockFinal: 1 },
        { producto: 'Choclo', inventarioTotal: 1, descripcion: 'Latas Donación particular (08/02) +1', cantidadRetirar: 0, stockFinal: 1 },
        { producto: 'Fideos Guiseros', inventarioTotal: 12, descripcion: 'Paquetes 2 (02/02) + 6 (05/02) + 4 (08/02) +2', cantidadRetirar: 3, stockFinal: 9 },
        { producto: 'Fideos Largos', inventarioTotal: 4, descripcion: 'Donación parroquia (08/02)', cantidadRetirar: 0, stockFinal: 4 },
        { producto: 'Lentejas', inventarioTotal: 13, descripcion: '9 paq. (02/02) + 4 paq. (08/02)', cantidadRetirar: 0, stockFinal: 13 },
        { producto: 'Milanesas', inventarioTotal: 15, descripcion: 'Milanesas de carne congeladas (05/02)', cantidadRetirar: 15, stockFinal: 0 },
        { producto: 'Pan Rallado', inventarioTotal: 2, descripcion: 'Paquetes por la mitad (02/02)', cantidadRetirar: 0, stockFinal: 2 },
        { producto: 'Pollo', inventarioTotal: 5, descripcion: 'Cajón 5 pollos Donación particular (07/02)', cantidadRetirar: 2, stockFinal: 3 },
        { producto: 'Puré de Tomate', inventarioTotal: 6, descripcion: '2 u. (02/02) + 4 u. (08/02) +1', cantidadRetirar: 2, stockFinal: 4 },
        { producto: 'Rollo Cocina', inventarioTotal: 1, descripcion: 'Bolsón Donación particular (03/02)', cantidadRetirar: 0, stockFinal: 1 },
        { producto: 'Vasos', inventarioTotal: 5, descripcion: 'Pack Vasos descartables pequeños (08/02)', cantidadRetirar: 0, stockFinal: 5 },
        { producto: 'Vegetales', inventarioTotal: 1, descripcion: 'Paquete Vegetales deshidratados (02/02)', cantidadRetirar: 0, stockFinal: 1 },
        { producto: 'Milanesas', inventarioTotal: 10, descripcion: 'Milanesas de carne congeladas (18/02)', cantidadRetirar: 0, stockFinal: 10 }
    ];
    renderInventory();
    updateLastUpdate('Datos de ejemplo');
    showNotification('📋 Datos de ejemplo cargados', 'info');
}

function renderInventory() {
    const tableBody = document.getElementById('inventory-table');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    let totalItems = 0;
    let totalStock = 0;
    let lowStock = 0;
    let outOfStock = 0;
    
    const searchInput = document.getElementById('search-product');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    const filteredData = inventoryData.filter(item => 
        item.producto.toLowerCase().includes(searchTerm) ||
        item.descripcion.toLowerCase().includes(searchTerm)
    );
    
    if (filteredData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="p-8 text-center text-gray-500">
                    🔍 No se encontraron productos
                </td>
            </tr>
        `;
        updateSummary(0, 0, 0, 0);
        return;
    }
    
    filteredData.forEach((item) => {
        totalItems++;
        totalStock += item.stockFinal;
        
        let rowClass = '';
        let statusBadge = '';
        let stockClass = '';
        
        if (item.stockFinal === 0) {
            outOfStock++;
            rowClass = 'bg-red-50';
            stockClass = 'text-red-600';
            statusBadge = '<span class="px-2 py-1 bg-red-200 text-red-800 rounded-full text-xs font-semibold">⚠️ Sin Stock</span>';
        } else if (item.stockFinal <= LOW_STOCK_THRESHOLD) {
            lowStock++;
            rowClass = 'bg-yellow-50';
            stockClass = 'text-yellow-600';
            statusBadge = '<span class="px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full text-xs font-semibold">📉 Bajo</span>';
        } else {
            stockClass = 'text-green-600';
            statusBadge = '<span class="px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs font-semibold">✅ OK</span>';
        }
        
        const row = document.createElement('tr');
        row.className = `${rowClass} border-b hover:bg-gray-100 transition-colors`;
        row.innerHTML = `
            <td class="p-4 font-semibold">${item.producto}</td>
            <td class="p-4 text-center font-medium">${item.inventarioTotal}</td>
            <td class="p-4 text-sm text-gray-600 hidden md:table-cell">${item.descripcion}</td>
            <td class="p-4 text-center ${item.cantidadRetirar > 0 ? 'text-red-500 font-medium' : 'text-gray-400'}">
                ${item.cantidadRetirar > 0 ? '-' + item.cantidadRetirar : '—'}
            </td>
            <td class="p-4 text-center">
                <span class="text-xl font-bold ${stockClass}">${item.stockFinal}</span>
            </td>
            <td class="p-4 text-center">${statusBadge}</td>
        `;
        tableBody.appendChild(row);
    });
    
    updateSummary(totalItems, totalStock, lowStock, outOfStock);
}

function updateSummary(totalItems, totalStock, lowStock, outOfStock) {
    const elements = {
        'total-items': totalItems,
        'total-stock': totalStock,
        'low-stock': lowStock,
        'out-of-stock': outOfStock
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
}

function filterProducts() {
    renderInventory();
}

function openGoogleSheet() {
    window.open(EDIT_URL, '_blank');
}

function updateLastUpdate(source) {
    const lastUpdateEl = document.getElementById('inventory-last-update');
    if (!lastUpdateEl) return;

    const now = new Date();
    const formatted = now.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    lastUpdateEl.textContent = `${formatted} (${source})`;
}

function showNotification(message, type = 'info') {
    const existingNotification = document.getElementById('notification');
    if (existingNotification) existingNotification.remove();
    
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500'
    };
    
    const notification = document.createElement('div');
    notification.id = 'notification';
    notification.className = `fixed top-20 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// =============================================
// EXPORTAR FUNCIONES GLOBALES
// =============================================
window.loadInventory = loadInventory;
window.loadSampleData = loadSampleData;
window.filterProducts = filterProducts;
window.openGoogleSheet = openGoogleSheet;