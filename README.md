# FinanceFlow

Dashboard de finanzas personales migrado de Streamlit a React + Vite para poder desplegarlo en Vercel.

## Funciones

- Registrar gastos manualmente.
- Elegir moneda (ARS, USD o EUR).
- Definir presupuesto mensual.
- Persistencia local con `localStorage`.
- Importar y exportar CSV.
- Filtrar por categoría, fecha y texto.
- Métricas de gasto total, promedio, máximo y cantidad de movimientos.
- Gráficos por categoría, distribución y evolución temporal.
- Insights automáticos y Top 5 de gastos.
- Borrar movimientos individuales o todos los datos.

## Desarrollo local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Vercel

1. Importar este repositorio en Vercel.
2. Framework Preset: `Vite` (normalmente se detecta automáticamente).
3. Build Command: `npm run build`.
4. Output Directory: `dist`.
5. Deploy.

No se necesita backend ni variables de entorno para esta versión.
