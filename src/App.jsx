import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import {
  BarChart3,
  PlusCircle,
  Database,
  WalletCards,
  Trash2,
  Download,
  Upload,
  TrendingUp,
  ReceiptText,
  CircleDollarSign,
  Sparkles,
  CalendarDays,
  Search,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const CATEGORIES = [
  'Comida',
  'Transporte',
  'Entretenimiento',
  'Tecnología',
  'Educación',
  'Salud',
  'Compras',
  'Servicios',
  'Viajes',
  'Otros',
]

const CURRENCY_OPTIONS = {
  'ARS ($)': '$',
  'USD (US$)': 'US$',
  'EUR (€)': '€',
}

const STORAGE_KEYS = {
  expenses: 'financeflow_expenses_v2',
  budget: 'financeflow_budget_v2',
  currency: 'financeflow_currency_v2',
}

const PALETTE = ['#7c3aed', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b']

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function todayISO() {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function formatMoney(value, symbol) {
  const number = Number(value || 0)
  return `${symbol}${new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0,
  }).format(number)}`
}

function formatDate(value) {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

function normalizeExpense(row, index = 0) {
  const normalized = {}
  Object.entries(row || {}).forEach(([key, value]) => {
    normalized[String(key).trim().toLowerCase()] = value
  })

  const amount = Number(String(normalized.monto ?? '').replace(',', '.'))
  const date = String(normalized.fecha ?? '').trim().slice(0, 10)
  const category = String(normalized.categoria ?? '').trim()
  const description = String(normalized.descripcion ?? '').trim()

  if (!date || Number.isNaN(Date.parse(`${date}T00:00:00`))) return null
  if (!Number.isFinite(amount) || amount < 0) return null
  if (!category || !description) return null

  return {
    id: normalized.id || `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    fecha: date,
    categoria: category,
    descripcion: description,
    monto: amount,
  }
}

function downloadText(filename, content, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function MetricCard({ icon: Icon, label, value, helper }) {
  return (
    <article className="metric-card">
      <div className="metric-icon"><Icon size={20} /></div>
      <div>
        <p className="metric-label">{label}</p>
        <p className="metric-value">{value}</p>
        {helper && <p className="metric-helper">{helper}</p>}
      </div>
    </article>
  )
}

function EmptyState({ onAdd }) {
  return (
    <section className="empty-state card">
      <div className="empty-icon"><ReceiptText size={28} /></div>
      <h2>Todavía no hay gastos</h2>
      <p>Agregá un movimiento o importá un CSV para empezar a analizar tus finanzas.</p>
      <button className="button primary" onClick={onAdd}>
        <PlusCircle size={18} /> Agregar primer gasto
      </button>
    </section>
  )
}

function Dashboard({ expenses, budget, symbol, onAdd }) {
  const allCategories = useMemo(
    () => [...new Set(expenses.map((item) => item.categoria))].sort((a, b) => a.localeCompare(b)),
    [expenses],
  )

  const minDate = useMemo(
    () => expenses.length ? expenses.reduce((min, item) => item.fecha < min ? item.fecha : min, expenses[0].fecha) : '',
    [expenses],
  )
  const maxDate = useMemo(
    () => expenses.length ? expenses.reduce((max, item) => item.fecha > max ? item.fecha : max, expenses[0].fecha) : '',
    [expenses],
  )

  const [selectedCategories, setSelectedCategories] = useState([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    setSelectedCategories(allCategories)
  }, [allCategories.join('|')])

  useEffect(() => {
    if (minDate) setFromDate(minDate)
    if (maxDate) setToDate(maxDate)
  }, [minDate, maxDate])

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase()
    return expenses.filter((item) => {
      if (selectedCategories.length && !selectedCategories.includes(item.categoria)) return false
      if (fromDate && item.fecha < fromDate) return false
      if (toDate && item.fecha > toDate) return false
      if (text && !`${item.descripcion} ${item.categoria}`.toLowerCase().includes(text)) return false
      return true
    })
  }, [expenses, selectedCategories, fromDate, toDate, query])

  const metrics = useMemo(() => {
    const total = filtered.reduce((acc, item) => acc + item.monto, 0)
    const average = filtered.length ? total / filtered.length : 0
    const max = filtered.length ? Math.max(...filtered.map((item) => item.monto)) : 0
    return { total, average, max, count: filtered.length }
  }, [filtered])

  const categoryData = useMemo(() => {
    const grouped = new Map()
    filtered.forEach((item) => grouped.set(item.categoria, (grouped.get(item.categoria) || 0) + item.monto))
    return [...grouped.entries()]
      .map(([categoria, monto]) => ({ categoria, monto }))
      .sort((a, b) => b.monto - a.monto)
  }, [filtered])

  const dateData = useMemo(() => {
    const grouped = new Map()
    filtered.forEach((item) => grouped.set(item.fecha, (grouped.get(item.fecha) || 0) + item.monto))
    return [...grouped.entries()]
      .map(([fecha, monto]) => ({ fecha, monto }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [filtered])

  const topFive = useMemo(
    () => [...filtered].sort((a, b) => b.monto - a.monto).slice(0, 5),
    [filtered],
  )

  const mainCategory = categoryData[0]
  const biggest = topFive[0]
  const mainCategoryPercentage = mainCategory && metrics.total > 0 ? (mainCategory.monto / metrics.total) * 100 : 0
  const budgetRatio = budget > 0 ? Math.min((metrics.total / budget) * 100, 100) : 0
  const remaining = budget - metrics.total

  function toggleCategory(category) {
    setSelectedCategories((current) => current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category])
  }

  function exportFiltered() {
    const csv = Papa.unparse(filtered.map(({ fecha, categoria, descripcion, monto }) => ({ fecha, categoria, descripcion, monto })))
    downloadText('financeflow_analisis.csv', csv)
  }

  if (!expenses.length) return <EmptyState onAdd={onAdd} />

  return (
    <div className="stack-xl">
      <section className="card filters-card">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">ANÁLISIS</span>
            <h2>Filtros</h2>
          </div>
          <button className="button ghost" onClick={() => {
            setSelectedCategories(allCategories)
            setFromDate(minDate)
            setToDate(maxDate)
            setQuery('')
          }}>Restablecer</button>
        </div>

        <div className="filters-grid">
          <label className="field">
            <span>Buscar</span>
            <div className="input-with-icon">
              <Search size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Descripción o categoría" />
            </div>
          </label>
          <label className="field">
            <span>Desde</span>
            <input type="date" value={fromDate} min={minDate} max={toDate || maxDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Hasta</span>
            <input type="date" value={toDate} min={fromDate || minDate} max={maxDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
        </div>

        <div className="category-filters">
          {allCategories.map((category) => (
            <button
              key={category}
              className={`chip ${selectedCategories.includes(category) ? 'active' : ''}`}
              onClick={() => toggleCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {!filtered.length ? (
        <section className="card notice warning">No hay movimientos para esos filtros.</section>
      ) : (
        <>
          <section className="metrics-grid">
            <MetricCard icon={CircleDollarSign} label="Gasto total" value={formatMoney(metrics.total, symbol)} />
            <MetricCard icon={TrendingUp} label="Gasto promedio" value={formatMoney(metrics.average, symbol)} />
            <MetricCard icon={ReceiptText} label="Mayor gasto" value={formatMoney(metrics.max, symbol)} />
            <MetricCard icon={CalendarDays} label="Movimientos" value={metrics.count} />
          </section>

          {budget > 0 && (
            <section className="card budget-card">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">PRESUPUESTO</span>
                  <h2>Estado del período</h2>
                </div>
                <strong className={remaining >= 0 ? 'positive' : 'negative'}>
                  {remaining >= 0
                    ? `${formatMoney(remaining, symbol)} disponibles`
                    : `${formatMoney(Math.abs(remaining), symbol)} excedidos`}
                </strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${budgetRatio}%` }} />
              </div>
              <div className="progress-meta">
                <span>{formatMoney(metrics.total, symbol)} gastados</span>
                <span>{formatMoney(budget, symbol)} de presupuesto</span>
              </div>
            </section>
          )}

          <section className="charts-grid">
            <article className="card chart-card">
              <div className="section-heading compact"><h2>Gastos por categoría</h2></div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#24304a" vertical={false} />
                    <XAxis dataKey="categoria" stroke="#8190ad" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#8190ad" tick={{ fontSize: 12 }} width={48} />
                    <Tooltip formatter={(value) => formatMoney(value, symbol)} contentStyle={{ background: '#11182a', border: '1px solid #26324a', borderRadius: 12 }} />
                    <Bar dataKey="monto" radius={[8, 8, 0, 0]} fill="#7c3aed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="card chart-card">
              <div className="section-heading compact"><h2>Distribución</h2></div>
              <div className="chart-wrap pie-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} dataKey="monto" nameKey="categoria" innerRadius={68} outerRadius={105} paddingAngle={2}>
                      {categoryData.map((entry, index) => <Cell key={entry.categoria} fill={PALETTE[index % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => formatMoney(value, symbol)} contentStyle={{ background: '#11182a', border: '1px solid #26324a', borderRadius: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pie-center"><strong>{categoryData.length}</strong><span>categorías</span></div>
              </div>
              <div className="legend-grid">
                {categoryData.slice(0, 6).map((item, index) => (
                  <div key={item.categoria} className="legend-item">
                    <span className="legend-dot" style={{ background: PALETTE[index % PALETTE.length] }} />
                    <span>{item.categoria}</span>
                    <strong>{formatMoney(item.monto, symbol)}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="card chart-card wide-chart">
            <div className="section-heading compact"><h2>Evolución de gastos</h2></div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dateData} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#24304a" vertical={false} />
                  <XAxis dataKey="fecha" stroke="#8190ad" tick={{ fontSize: 12 }} tickFormatter={formatDate} />
                  <YAxis stroke="#8190ad" tick={{ fontSize: 12 }} width={48} />
                  <Tooltip labelFormatter={formatDate} formatter={(value) => formatMoney(value, symbol)} contentStyle={{ background: '#11182a', border: '1px solid #26324a', borderRadius: 12 }} />
                  <Line type="monotone" dataKey="monto" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4, fill: '#06b6d4' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card insights-card">
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">INSIGHTS</span>
                <h2><Sparkles size={20} /> Análisis automático</h2>
              </div>
            </div>
            <div className="insights-grid">
              <div className="insight">
                <p>Mayor categoría</p>
                <strong>{mainCategory?.categoria}</strong>
                <span>Representa el {mainCategoryPercentage.toFixed(1)}% del gasto filtrado.</span>
              </div>
              <div className="insight">
                <p>Mayor gasto individual</p>
                <strong>{biggest?.descripcion}</strong>
                <span>{formatMoney(biggest?.monto, symbol)} · {biggest?.categoria}</span>
              </div>
              <div className={`insight ${mainCategoryPercentage >= 50 ? 'attention' : ''}`}>
                <p>Lectura rápida</p>
                <strong>{mainCategoryPercentage >= 50 ? 'Alta concentración' : mainCategoryPercentage >= 30 ? 'Categoría dominante' : 'Gastos diversificados'}</strong>
                <span>{mainCategoryPercentage >= 50
                  ? `Más de la mitad se concentra en ${mainCategory?.categoria}.`
                  : mainCategoryPercentage >= 30
                    ? `${mainCategory?.categoria} tiene un peso importante en tus gastos.`
                    : 'Tus gastos están relativamente distribuidos entre distintas categorías.'}</span>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">RANKING</span>
                <h2>Top 5 gastos</h2>
              </div>
              <button className="button ghost" onClick={exportFiltered}><Download size={17} /> Descargar filtrados</button>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th className="align-right">Monto</th></tr></thead>
                <tbody>
                  {topFive.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.fecha)}</td>
                      <td><span className="table-category">{item.categoria}</span></td>
                      <td>{item.descripcion}</td>
                      <td className="align-right"><strong>{formatMoney(item.monto, symbol)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function AddExpense({ onAdd, symbol }) {
  const [form, setForm] = useState({
    fecha: todayISO(),
    categoria: CATEGORIES[0],
    descripcion: '',
    monto: '',
  })
  const [message, setMessage] = useState(null)

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function submit(event) {
    event.preventDefault()
    const amount = Number(form.monto)
    if (!form.descripcion.trim()) {
      setMessage({ type: 'warning', text: 'Ingresá una descripción.' })
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage({ type: 'warning', text: 'El monto debe ser mayor a 0.' })
      return
    }

    onAdd({
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      fecha: form.fecha,
      categoria: form.categoria,
      descripcion: form.descripcion.trim(),
      monto: amount,
    })
    setForm((current) => ({ ...current, fecha: todayISO(), descripcion: '', monto: '' }))
    setMessage({ type: 'success', text: 'Gasto agregado correctamente.' })
  }

  return (
    <section className="card form-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">NUEVO MOVIMIENTO</span>
          <h2>Agregar gasto</h2>
          <p>Registrá un movimiento para incorporarlo automáticamente al dashboard.</p>
        </div>
      </div>

      {message && <div className={`notice ${message.type}`}>{message.text}</div>}

      <form className="expense-form" onSubmit={submit}>
        <label className="field"><span>Fecha</span><input type="date" value={form.fecha} onChange={(e) => update('fecha', e.target.value)} required /></label>
        <label className="field"><span>Categoría</span><select value={form.categoria} onChange={(e) => update('categoria', e.target.value)}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label className="field"><span>Descripción</span><input value={form.descripcion} onChange={(e) => update('descripcion', e.target.value)} placeholder="Ej: Almuerzo" /></label>
        <label className="field"><span>Monto ({symbol})</span><input type="number" min="0" step="0.01" value={form.monto} onChange={(e) => update('monto', e.target.value)} placeholder="0" /></label>
        <button className="button primary form-submit" type="submit"><PlusCircle size={18} /> Guardar gasto</button>
      </form>
    </section>
  )
}

function DataManager({ expenses, onReplace, onClear, onDelete, symbol }) {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState([])
  const [message, setMessage] = useState(null)

  function handleFile(file) {
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, errors }) => {
        if (errors.length) {
          setMessage({ type: 'warning', text: 'No se pudo leer correctamente el archivo CSV.' })
          return
        }
        const rows = data.map(normalizeExpense).filter(Boolean)
        if (!rows.length) {
          setMessage({ type: 'warning', text: 'No se encontraron filas válidas. Revisá las columnas y los datos.' })
          setPreview([])
          return
        }
        setPreview(rows)
        setMessage({ type: 'success', text: `Archivo válido: ${rows.length} movimientos encontrados.` })
      },
    })
  }

  function importPreview() {
    onReplace(preview)
    setPreview([])
    if (inputRef.current) inputRef.current.value = ''
    setMessage({ type: 'success', text: 'Datos importados correctamente.' })
  }

  function exportAll() {
    const csv = Papa.unparse(expenses.map(({ fecha, categoria, descripcion, monto }) => ({ fecha, categoria, descripcion, monto })))
    downloadText('mis_gastos.csv', csv)
  }

  return (
    <div className="stack-xl">
      <section className="card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">IMPORTACIÓN</span>
            <h2>Importar datos</h2>
            <p>Cargá un CSV con las columnas <code>fecha, categoria, descripcion, monto</code>.</p>
          </div>
        </div>

        {message && <div className={`notice ${message.type}`}>{message.text}</div>}

        <div className="upload-zone" onClick={() => inputRef.current?.click()}>
          <Upload size={28} />
          <strong>Seleccionar archivo CSV</strong>
          <span>Hacé clic para elegir un archivo desde tu computadora</span>
          <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={(e) => handleFile(e.target.files?.[0])} hidden />
        </div>

        {preview.length > 0 && (
          <div className="preview-area">
            <h3>Vista previa</h3>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th className="align-right">Monto</th></tr></thead>
                <tbody>{preview.slice(0, 10).map((item) => <tr key={item.id}><td>{formatDate(item.fecha)}</td><td>{item.categoria}</td><td>{item.descripcion}</td><td className="align-right">{formatMoney(item.monto, symbol)}</td></tr>)}</tbody>
              </table>
            </div>
            <button className="button primary" onClick={importPreview}><Database size={17} /> Importar movimientos</button>
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">DATOS</span>
            <h2>Movimientos guardados</h2>
          </div>
          {expenses.length > 0 && (
            <div className="button-row">
              <button className="button ghost" onClick={exportAll}><Download size={17} /> Descargar CSV</button>
              <button className="button danger" onClick={() => {
                if (window.confirm('¿Seguro que querés borrar todos los movimientos?')) onClear()
              }}><Trash2 size={17} /> Borrar todo</button>
            </div>
          )}
        </div>

        {!expenses.length ? (
          <div className="notice">Todavía no hay movimientos cargados.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th className="align-right">Monto</th><th></th></tr></thead>
              <tbody>
                {[...expenses].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.fecha)}</td>
                    <td><span className="table-category">{item.categoria}</span></td>
                    <td>{item.descripcion}</td>
                    <td className="align-right"><strong>{formatMoney(item.monto, symbol)}</strong></td>
                    <td className="align-right"><button className="icon-button" aria-label="Eliminar" onClick={() => onDelete(item.id)}><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [expenses, setExpenses] = useState(() => safeJsonParse(localStorage.getItem(STORAGE_KEYS.expenses), []))
  const [budget, setBudget] = useState(() => Number(localStorage.getItem(STORAGE_KEYS.budget) || 0))
  const [currency, setCurrency] = useState(() => localStorage.getItem(STORAGE_KEYS.currency) || 'ARS ($)')
  const symbol = CURRENCY_OPTIONS[currency] || '$'

  useEffect(() => localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(expenses)), [expenses])
  useEffect(() => localStorage.setItem(STORAGE_KEYS.budget, String(budget)), [budget])
  useEffect(() => localStorage.setItem(STORAGE_KEYS.currency, currency), [currency])

  function addExpense(expense) {
    setExpenses((current) => [...current, expense])
  }

  function replaceExpenses(next) {
    setExpenses(next)
  }

  function deleteExpense(id) {
    setExpenses((current) => current.filter((item) => item.id !== id))
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'add', label: 'Agregar gasto', icon: PlusCircle },
    { id: 'data', label: 'Datos', icon: Database },
  ]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><WalletCards size={24} /></div>
          <div><strong>FinanceFlow</strong><span>Personal Finance Dashboard</span></div>
        </div>

        <nav className="sidebar-nav">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-settings">
          <label className="field"><span>Moneda</span><select value={currency} onChange={(e) => setCurrency(e.target.value)}>{Object.keys(CURRENCY_OPTIONS).map((option) => <option key={option}>{option}</option>)}</select></label>
          <label className="field"><span>Presupuesto mensual</span><input type="number" min="0" step="1000" value={budget || ''} onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))} placeholder="0" /></label>
        </div>

        <div className="sidebar-footer">React · Vite · Recharts<br />Listo para Vercel</div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <span className="eyebrow">PERSONAL FINANCE</span>
            <h1>FinanceFlow</h1>
            <p>Dashboard para registrar, visualizar y entender tus gastos personales.</p>
          </div>
          <div className="header-summary">
            <span>{expenses.length} movimientos</span>
            <strong>{formatMoney(expenses.reduce((sum, item) => sum + Number(item.monto || 0), 0), symbol)}</strong>
          </div>
        </header>

        <div className="mobile-tabs">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}><Icon size={17} /><span>{label}</span></button>
          ))}
        </div>

        {activeTab === 'dashboard' && <Dashboard expenses={expenses} budget={budget} symbol={symbol} onAdd={() => setActiveTab('add')} />}
        {activeTab === 'add' && <AddExpense onAdd={addExpense} symbol={symbol} />}
        {activeTab === 'data' && <DataManager expenses={expenses} onReplace={replaceExpenses} onClear={() => setExpenses([])} onDelete={deleteExpense} symbol={symbol} />}

        <footer>FinanceFlow · React · Vite · Recharts · Vercel</footer>
      </main>
    </div>
  )
}
