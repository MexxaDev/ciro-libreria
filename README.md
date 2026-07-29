# POS Premium - Sistema de Punto de Venta

Un sistema de punto de venta (POS) premium, moderno y completo, construido con tecnologías web puras (HTML5, CSS3, JavaScript Vanilla) sin frameworks ni librerías innecesarias.

## 🚀 Características Principales

- **Punto de Venta (POS)**: Interfaz rápida para procesar ventas, con soporte para múltiples métodos de pago (efectivo, débito, transferencia, cuenta corriente)
- **Gestión de Productos**: CRUD completo con búsqueda, categorías y control de stock
- **Gestión de Clientes**: Administración de clientes con gestión de saldo y cuenta corriente
- **Historial de Ventas**: Visualización de todas las ventas con filtros por fecha y detalles completos
- **Caja**: Apertura y cierre de caja con control de movimientos de efectivo
- **Reportes**: Gráficos interactivos de ventas, métodos de pago y productos más vendidos
- **Configuración**: Personalización del negocio, moneda, impuestos, logo y respaldo de datos
- **Diseño Premium**: Interfaz inspirada en Apple/Stripe/Linear con tema violeta, tipografía Inter, sombras suaves y transiciones fluidas
- **Responsive**: Adaptable a tablets y móviles
- **Offline**: Funciona completamente offline usando IndexedDB para almacenamiento local

## 🛠️ Tecnologías Utilizadas

- **Frontend**: HTML5, CSS3 (Variables CSS, Grid, Flexbox), JavaScript ES6+ (Módulos)
- **Almacenamiento**: IndexedDB (Wrapper personalizado con promesas)
- **Despliegue**: Vercel (Configurado con vercel.json)
- **Fuente**: Inter (Google Fonts)
- **Iconos**: Font Awesome 6.4.0

## 📁 Estructura del Proyecto

```
POS/
├── css/
│   ├── variables.css       # Design tokens (colores, espaciados, sombras)
│   ├── base.css            # Resets y estilos base
│   ├── layout.css          # Grid principal y sidebar
│   ├── components.css      # Botones, tablas, formularios, cards
│   ├── pages.css           # Estilos específicos de páginas
│   └── responsive.css      # Media queries
├── js/
│   ├── app.js              # Inicialización de la app
│   ├── router.js           # Enrutador SPA basado en hash
│   ├── state.js            # Gestión de estado centralizada
│   └── components/
│       ├── sidebar.js      # Barra lateral
│       ├── header.js       # Encabezado
│       ├── toast.js        # Notificaciones modernas
│       ├── modal.js        # Modales reutilizables
│       └── table.js        # Tabla reusable
├── db/
│   ├── indexeddb.js        # Wrapper de IndexedDB
│   └── repositories.js     # Repositorios por entidad
├── modules/
│   ├── pos/              # Punto de venta
│   ├── products/         # Gestión de productos
│   ├── categories/       # Gestión de categorías
│   ├── customers/        # Gestión de clientes
│   ├── sales/            # Historial de ventas
│   ├── cash/             # Caja
│   ├── reports/          # Reportes y gráficos
│   ├── dashboard/        # Dashboard principal
│   └── settings/        # Configuración
├── utils/
│   ├── currency.js       # Formateo de moneda
│   ├── validators.js     # Validaciones
│   ├── export.js         # Exportar base de datos
│   └── import.js         # Importar base de datos
├── data/
│   └── seed.json         # Datos iniciales
├── index.html
├── vercel.json
└── README.md
```

## 🚀 Instalación y Uso

### Requisitos Previos

- Un navegador moderno (Chrome, Firefox, Edge, Safari)
- Un servidor web local (opcional, pero recomendado para evitar problemas con módulos ES6)

### Pasos para Ejecutar Localmente

1. **Clonar o descargar el proyecto**

   ```bash
   git clone <repo-url>
   cd POS
   ```

2. **Iniciar un servidor local** (Debido al uso de módulos ES6):

   Con Python:

   ```bash
   python -m http.server 8000
   ```

   Con Node.js (npx):

   ```bash
   npx serve
   ```

   Con PHP:

   ```bash
   php -S localhost:8000
   ```

3. **Abrir en el navegador**
   ```
   http://localhost:8000
   ```

### Credenciales de Acceso

El sistema viene con dos usuarios predefinidos:

- **Administrador**
  - Usuario: `admin`
  - Contraseña: `admin123`
  - Acceso: Completo

- **Cajero**
  - Usuario: `cajero`
  - Contraseña: `cajero123`
  - Acceso: POS, Productos, Clientes

### Despliegue en Vercel

1. Conecta tu repositorio a Vercel
2. Vercel detectará automáticamente la configuración desde `vercel.json`
3. ¡Listo! El sitio se desplegará automáticamente

## 🎨 Personalización

### Cambiar Moneda y Configuración

1. Inicia sesión como administrador
2. Ve a Configuración
3. Modifica la información del negocio, moneda, tasa de impuestos, etc.

### Cambiar Colores (Tema)

Edita las variables CSS en `css/variables.css`:

```css
:root {
  --color-primary: #7c3aed; /* Color principal (violeta) */
  --color-primary-dark: #6d28d9;
  /* ... más variables */
}
```

## 💾 Respaldo y Restauración

### Exportar Datos

1. Ve a Configuración
2. Haz clic en "Exportar Base de Datos"
3. Se descargará un archivo JSON con todos los datos

### Importar Datos

1. Ve a Configuración
2. Haz clic en "Importar Base de Datos"
3. Selecciona un archivo JSON previamente exportado

## ⚠️ Notas Importantes

- **Sin Framework**: Este proyecto está construido sin React, Vue, Angular u otros frameworks. Usa JavaScript vanilla con módulos ES6.
- **Almacenamiento Local**: Todos los datos se guardan en el navegador usando IndexedDB. No hay base de datos externa.
- **Offline First**: La aplicación funciona completamente offline una vez cargada.
- **Límites**: IndexedDB tiene límites de almacenamiento (generalmente 50MB-100MB según el navegador).

## 📝 Licencia

MIT License - Libre para uso comercial y personal.

## 🐛 Problemas Conocidos

- En dispositivos móviles, algunas funciones pueden requerir orientación horizontal para mejor experiencia
- El impresión de tickets requiere un navegador que soporte `window.print()`

## 📧 Soporte

Para reportar problemas o sugerencias, por favor abre un issue en el repositorio del proyecto.
