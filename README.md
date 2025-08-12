# DataMatch - Herramienta de Comparación de Archivos Excel

## 🚀 Descripción

DataMatch es una herramienta profesional para análisis y sincronización de datos entre archivos Excel y bases de datos Oracle. Permite comparar archivos, generar scripts SQL de consulta y actualización, y mantener la integridad de los datos.

## ✨ Características Principales

- **Detección Inteligente de Hojas**: Detecta automáticamente la hoja correcta basándose en el contenido
- **Preservación de Ceros Iniciales**: Mantiene el formato correcto de matrículas (ej: 031517)
- **Generación de Scripts SQL**: Crea automáticamente scripts de consulta y actualización
- **Comparación Robusta**: Analiza diferencias entre archivos con precisión
- **Interfaz Moderna**: UI intuitiva y responsive con Shadcn UI
- **Exportación de Scripts**: Descarga directa de archivos SQL

## 🛠️ Tecnologías

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI Components**: Shadcn UI, Tailwind CSS
- **Excel Processing**: xlsx library
- **Deployment**: Vercel

## 📋 Requisitos

- Node.js 18+
- pnpm (recomendado) o npm

## 🚀 Instalación

```bash
# Clonar el repositorio
git clone <tu-repositorio>
cd DataMatch_PROD

# Instalar dependencias
pnpm install

# Ejecutar en desarrollo
pnpm dev

# Construir para producción
pnpm build

# Iniciar servidor de producción
pnpm start
```

## 🌐 Despliegue en Vercel

1. **Conectar repositorio** a Vercel
2. **Configurar variables de entorno** si es necesario
3. **Deploy automático** en cada push

## 📖 Uso

### 1. Cargar Archivo 1 (Archivo Fuente)
- Selecciona el archivo Excel con los datos a procesar
- La aplicación detecta automáticamente la hoja correcta
- Preserva ceros iniciales en matrículas

### 2. Generar Script de Consulta
- Genera automáticamente script SQL para Oracle
- Incluye todas las matrículas del archivo 1
- Listo para ejecutar en la base de datos

### 3. Cargar Archivo 2 (Datos Actuales)
- Exporta resultado de Oracle a CSV/XLSX
- Carga como archivo 2 para comparación

### 4. Comparar y Generar Scripts
- Ejecuta comparación automática
- Genera script de actualización final
- Descarga script SQL listo para usar

## 🔧 Configuración

### Variables de Entorno
```bash
NEXT_PUBLIC_APP_NAME=DataMatch
NEXT_PUBLIC_APP_VERSION=1.0.0
```

## 📁 Estructura del Proyecto

```
src/
├── app/                    # Páginas y rutas de la aplicación
├── components/            # Componentes reutilizables
│   └── ui/               # Componentes de Shadcn UI
├── hooks/                 # Hooks personalizados
└── lib/                   # Utilidades y configuraciones
```

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 📞 Soporte

Para soporte técnico o preguntas, contacta al equipo de desarrollo.

---

**ExcelSync Pro** - Transformando la gestión de datos, una comparación a la vez. 🚀
