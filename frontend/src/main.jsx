import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Activity, AlertTriangle, Boxes, Building2, ChartNoAxesCombined, ChevronRight, CircleDollarSign, ClipboardList, Database, LayoutDashboard, Package, Plus, RefreshCw, Search, Truck, X } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import './style.css'
import './forms.css'

const nav = [
  ['Dashboard', LayoutDashboard], ['Products', Package], ['Inventory', Boxes], ['Warehouses', Building2],
  ['Suppliers', Truck], ['Transactions', ClipboardList], ['Consumption Analytics', Activity],
  ['Reorder Predictions', ChartNoAxesCombined], ['Smart Alerts', AlertTriangle],
  ['Static vs Predictive', RefreshCw], ['Database Insights', Database],
]
const pageEndpoint = {
  Products: '/products', Inventory: '/inventory', Warehouses: '/warehouses', Suppliers: '/supplier-rankings',
  Transactions: '/transactions', 'Consumption Analytics': '/consumption/daily',
  'Reorder Predictions': '/alerts', 'Smart Alerts': '/alerts', 'Static vs Predictive': '/comparison',
}
const blankProduct = { product_id: '', sku: '', product_name: '', unit_cost: '', unit_price: '', category_id: '' }
const blankFilters = { product_id: '', warehouse_id: '', transaction_type: '', start: '', end: '' }

async function request(path, options) {
  const response = await fetch(`/api${path}`, options)
  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try { detail = (await response.json()).detail || detail } catch { /* response had no JSON body */ }
    throw new Error(detail)
  }
  if (response.status === 204) return null
  return response.json()
}
const fmt = value => Number(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const dateValue = value => value ? String(value).slice(0, 10) : '—'
const label = key => key.replaceAll('_', ' ')

function DataTable({ rows, actions }) {
  if (!rows?.length) return <div className="empty">No records match these filters.</div>
  const columns = Object.keys(rows[0])
  return <div className="table-wrap"><table><thead><tr>{columns.map(key => <th key={key}>{label(key)}</th>)}{actions && <th>Actions</th>}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={row.transaction_id ?? row.prediction_id ?? ([row.product_id, row.warehouse_id, row.supplier_id, row.week_id, row.sale_date].filter(Boolean).join('-') || index)}>
      {columns.map(key => <td key={key}>{key.includes('date') ? dateValue(row[key]) : key.includes('status') || key === 'urgency' || key === 'trend_direction' ? <span className={`pill ${String(row[key] ?? '').toLowerCase().replaceAll(' ', '-')}`}>{row[key] ?? '—'}</span> : row[key] == null ? '—' : typeof row[key] === 'number' ? fmt(row[key]) : String(row[key])}</td>)}
      {actions && <td className="row-actions">{actions(row)}</td>}
    </tr>)}</tbody></table></div>
}

function App() {
  const [page, setPage] = useState('Dashboard')
  const [data, setData] = useState(null)
  const [analytics, setAnalytics] = useState({ weekly: [], trends: [] })
  const [lookups, setLookups] = useState({ products: [], categories: [], warehouses: [], inventory: [], offers: [] })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [connection, setConnection] = useState('Checking database')
  const [productForm, setProductForm] = useState(null)
  const [filters, setFilters] = useState(blankFilters)
  const [alertFilters, setAlertFilters] = useState({ product_id: '', warehouse_id: '', urgency: '', supplier_id: '' })
  const [movement, setMovement] = useState({ product_id: '', warehouse_id: '', transaction_type: 'SALE', quantity: 1 })

  const loadLookups = useCallback(async () => {
    try {
      const [products, categories, warehouses, inventory, offers] = await Promise.all([request('/products'), request('/categories'), request('/warehouses'), request('/inventory'), request('/supplier-rankings')])
      setLookups({ products, categories, warehouses, inventory, offers })
      setConnection('Database connected')
      setMovement(current => {
        const pairExists = inventory.some(p => p.product_id === current.product_id && p.warehouse_id === current.warehouse_id)
        const first = inventory[0]
        return pairExists || !first ? current : { ...current, product_id: first.product_id, warehouse_id: first.warehouse_id }
      })
    } catch (e) { setConnection('Database unavailable'); setError(e.message) }
  }, [])

  const load = useCallback(async (target = page) => {
    setError('')
    setBusy(true)
    try {
      let payload
      if (target === 'Dashboard') payload = await request('/dashboard')
      else if (target === 'Database Insights') payload = await request('/dashboard')
      else if (target === 'Consumption Analytics') {
        const [daily, weekly, trends] = await Promise.all([request('/consumption/daily'), request('/analytics/weekly'), request('/analytics/trends')])
        setData(daily)
        setAnalytics({ weekly, trends })
        return
      }
      else {
        let endpoint = pageEndpoint[target] || '/dashboard'
        if (target === 'Transactions') {
          const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value))
          endpoint += params.size ? `?${params}` : ''
        }
        if (target === 'Smart Alerts' || target === 'Reorder Predictions') {
          const params = new URLSearchParams(Object.entries(alertFilters).filter(([, value]) => value))
          endpoint += params.size ? `?${params}` : ''
        }
        payload = await request(endpoint)
      }
      setData(payload)
    } catch (e) { setError(e.message); setData(null) }
    finally { setBusy(false) }
  }, [page, filters, alertFilters])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadLookups() }, [loadLookups])

  const toast = message => { setNotice(message); window.setTimeout(() => setNotice(''), 4000) }
  const generate = async () => {
    setBusy(true); setError('')
    try {
      await request('/predictions/generate', { method: 'POST' })
      toast('Prediction snapshot generated.')
      setPage('Reorder Predictions')
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  const saveProduct = async event => {
    event.preventDefault(); setBusy(true); setError('')
    const { editing, ...values } = productForm
    const item = { ...values, unit_cost: Number(values.unit_cost), unit_price: Number(values.unit_price) }
    try {
      await request(`/products${editing ? `/${encodeURIComponent(item.product_id)}` : ''}`, {
        method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item),
      })
      setProductForm(null); toast(editing ? 'Product updated.' : 'Product added.')
      await Promise.all([load('Products'), loadLookups()])
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  const deleteProduct = async item => {
    if (!window.confirm(`Delete ${item.product_name}? This is only possible when it has no inventory or transaction history.`)) return
    setBusy(true); setError('')
    try { await request(`/products/${encodeURIComponent(item.product_id)}`, { method: 'DELETE' }); toast('Product deleted.'); await Promise.all([load('Products'), loadLookups()]) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  const recordMovement = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      await request('/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...movement, quantity: Number(movement.quantity) }) })
      toast('Stock movement recorded.'); await Promise.all([load(page), loadLookups()])
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const arrayData = Array.isArray(data) ? data : []
  const filtered = useMemo(() => arrayData.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())), [arrayData, search])
  const dailySummary = useMemo(() => {
    const totals = new Map()
    for (const row of data?.daily_consumption || []) totals.set(row.sale_date, (totals.get(row.sale_date) || 0) + Number(row.units_sold || 0))
    return [...totals].map(([sale_date, units_sold]) => ({ sale_date, units_sold })).sort((a, b) => String(a.sale_date).localeCompare(String(b.sale_date)))
  }, [data])
  const cards = data && page === 'Dashboard' ? [
    ['Total products', data.total_products, Package], ['Suppliers', data.total_suppliers, Truck], ['Warehouses', data.total_warehouses, Building2],
    ['Inventory units', fmt(data.total_units), Boxes], ['Reorders needed', data.products_requiring_reorder, AlertTriangle],
    ['Overdue reorders', data.overdue_reorders, AlertTriangle], ['Estimated purchase cost', `₹${fmt(data.estimated_purchasing_cost)}`, CircleDollarSign],
    ['Average capacity used', `${data.avg_utilisation || 0}%`, ChartNoAxesCombined],
  ] : []
  const title = page === 'Reorder Predictions' ? 'Reorder predictions' : page

  return <div className="shell">
    <aside className="sidebar"><div className="brand"><div className="logo">S</div><span>Stock<span className="brand-accent">Sense</span><small>INVENTORY INTELLIGENCE</small></span></div>
      <div className="nav-label">WORKSPACE</div><nav>{nav.map(([name, Icon]) => <button className={page === name ? 'active' : ''} key={name} onClick={() => { setPage(name); setSearch('') }}><Icon size={17}/>{name}{page === name && <ChevronRight size={14} className="nav-arrow"/>}</button>)}</nav>
      <div className="sidebar-foot"><span className={`live-dot ${connection === 'Database unavailable' ? 'offline' : ''}`}/>{connection}<small>MySQL 8 · SQL analytics</small></div>
    </aside>
    <main><header><div><div className="eyebrow">INVENTORY OVERVIEW</div><h1>{title}</h1></div><div className="header-actions"><span className="today">{new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date())}</span><button className="primary" onClick={generate} disabled={busy}><ChartNoAxesCombined size={16}/>{busy ? 'Working…' : 'Generate predictions'}</button></div></header>
      {error && <div className="error"><AlertTriangle size={16}/>{error}<button onClick={() => setError('')}>Dismiss</button></div>}
      {notice && <div className="success">{notice}<button onClick={() => setNotice('')}>Dismiss</button></div>}
      {busy && <div className="loading">Refreshing live data…</div>}

      {page === 'Dashboard' && data && <>
        <section className="cards">{cards.map(([heading, value, Icon]) => <article className="card" key={heading}><div className="card-top"><span>{heading}</span><Icon size={17}/></div><strong>{value}</strong><small>Live from your inventory database</small></article>)}</section>
        <section className="grid two"><article className="panel"><div className="panel-head"><div><h2>Daily consumption</h2><p>Units sold across all product locations</p></div><span className="tag">Recent sales</span></div><div className="chart"><ResponsiveContainer><AreaChart data={dailySummary}><defs><linearGradient id="sales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#32a98a" stopOpacity={.22}/><stop offset="95%" stopColor="#32a98a" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="sale_date" tickFormatter={x => String(x).slice(5)} minTickGap={25}/><YAxis/><Tooltip/><Area type="monotone" dataKey="units_sold" stroke="#258e72" fill="url(#sales)"/></AreaChart></ResponsiveContainer></div></article>
          <article className="panel"><div className="panel-head"><div><h2>Warehouse utilisation</h2><p>Stored units compared with capacity</p></div></div><div className="chart"><ResponsiveContainer><BarChart data={data.warehouses || []} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number"/><YAxis dataKey="warehouse_name" type="category" width={115}/><Tooltip/><Bar dataKey="percentage_used" fill="#5274d8" radius={[0, 5, 5, 0]}/></BarChart></ResponsiveContainer></div>{(data.warehouses || []).map(w => <div className="util-row" key={w.warehouse_id}><span>{w.warehouse_name}</span><b>{w.percentage_used}%</b><div className="progress"><i style={{ width: `${Math.min(100, w.percentage_used)}%` }}/></div></div>)}</article></section>
        <section className="panel"><div className="panel-head"><div><h2>Priority reorder alerts</h2><p>Recommendations from the latest prediction snapshot</p></div><button className="text-button" onClick={() => setPage('Smart Alerts')}>View all →</button></div><DataTable rows={(data.alerts || []).slice(0, 6)}/></section>
      </>}

      {page === 'Products' && <><section className="panel"><div className="panel-head"><div><h2>Product catalogue</h2><p>Create, update, and review products in the catalogue.</p></div><button className="primary" onClick={() => setProductForm({ ...blankProduct, category_id: lookups.categories[0]?.category_id || '' })}><Plus size={15}/> Add product</button></div></section>
        {productForm && <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setProductForm(null)}><section className="panel modal"><div className="panel-head"><div><h2>{productForm.editing ? 'Edit product' : 'Add product'}</h2><p>Product identifiers must be unique.</p></div><button className="icon-button" onClick={() => setProductForm(null)} aria-label="Close"><X size={17}/></button></div><form className="form-grid" onSubmit={saveProduct}>{[['product_id', 'Product ID'], ['sku', 'SKU'], ['product_name', 'Product name'], ['unit_cost', 'Unit cost'], ['unit_price', 'Unit price']].map(([key, text]) => <label key={key}>{text}<input required disabled={productForm.editing && key === 'product_id'} type={key.startsWith('unit_') ? 'number' : 'text'} min={key.startsWith('unit_') ? '0' : undefined} step={key.startsWith('unit_') ? '0.01' : undefined} value={productForm[key] ?? ''} onChange={e => setProductForm({ ...productForm, [key]: e.target.value })}/></label>)}<label>Category<select required value={productForm.category_id} onChange={e => setProductForm({ ...productForm, category_id: e.target.value })}><option value="">Choose category</option>{lookups.categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}</select></label><div className="form-actions"><button type="button" className="secondary" onClick={() => setProductForm(null)}>Cancel</button><button className="primary" disabled={busy}>{productForm.editing ? 'Save changes' : 'Create product'}</button></div></form></section></div>}
        <section className="panel"><div className="panel-head"><div><h2>Catalogue records</h2><p>{filtered.length} products</p></div><SearchBox value={search} onChange={setSearch}/></div><DataTable rows={filtered} actions={row => <><button className="mini-button" onClick={() => setProductForm({ ...row, category_id: lookups.categories.find(c => c.category_name === row.category_name)?.category_id || '', editing: true })}>Edit</button><button className="mini-button danger-text" onClick={() => deleteProduct(row)}>Delete</button></>}/></section>
      </>}

      {page === 'Inventory' && <><section className="panel"><h2>Record stock movement</h2><p className="panel-copy">Sales reduce on-hand stock; restocks and adjustments add the entered quantity.</p><form className="form-row" onSubmit={recordMovement}><label className="field-label">Product and warehouse<select required value={`${movement.product_id}|${movement.warehouse_id}`} onChange={e => { const [product_id, warehouse_id] = e.target.value.split('|'); setMovement({ ...movement, product_id, warehouse_id }) }}>{lookups.inventory.map(p => <option key={`${p.product_id}-${p.warehouse_id}`} value={`${p.product_id}|${p.warehouse_id}`}>{p.product_name} · {p.warehouse_name} · {fmt(p.quantity_on_hand)} on hand</option>)}</select></label><label className="field-label">Movement type<select value={movement.transaction_type} onChange={e => setMovement({ ...movement, transaction_type: e.target.value })}><option>SALE</option><option>RESTOCK</option><option>ADJUSTMENT</option></select></label><label className="field-label">Quantity<input type="number" min="1" required value={movement.quantity} onChange={e => setMovement({ ...movement, quantity: e.target.value })}/></label><button className="primary" disabled={busy || !lookups.inventory.length}>Record movement</button></form><p className="muted">Each movement is saved with its transaction record in one database transaction. Sales cannot reduce stock below zero.</p></section><section className="panel"><div className="panel-head"><div><h2>Stock by location</h2><p>Current levels and static reorder status.</p></div><SearchBox value={search} onChange={setSearch}/></div><DataTable rows={filtered}/></section></>}

      {page === 'Transactions' && <><section className="panel"><h2>Filter transaction history</h2><form className="filter-row" onSubmit={e => { e.preventDefault(); load('Transactions') }}><select value={filters.product_id} onChange={e => setFilters({ ...filters, product_id: e.target.value })}><option value="">All products</option>{lookups.products.filter((p, i, a) => a.findIndex(q => q.product_id === p.product_id) === i).map(p => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}</select><select value={filters.warehouse_id} onChange={e => setFilters({ ...filters, warehouse_id: e.target.value })}><option value="">All warehouses</option>{lookups.warehouses.map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</option>)}</select><select value={filters.transaction_type} onChange={e => setFilters({ ...filters, transaction_type: e.target.value })}><option value="">All movement types</option><option>SALE</option><option>RESTOCK</option><option>ADJUSTMENT</option></select><label>From<input type="date" value={filters.start} onChange={e => setFilters({ ...filters, start: e.target.value })}/></label><label>To<input type="date" value={filters.end} onChange={e => setFilters({ ...filters, end: e.target.value })}/></label><button className="primary">Apply filters</button><button type="button" className="secondary" onClick={() => setFilters(blankFilters)}>Clear</button></form></section><section className="panel"><div className="panel-head"><div><h2>Transaction history</h2><p>Latest 1,000 matching records.</p></div><SearchBox value={search} onChange={setSearch}/></div><DataTable rows={filtered}/></section></>}

      {(page === 'Suppliers' || page === 'Warehouses') && <section className="panel"><div className="panel-head"><div><h2>{page === 'Suppliers' ? 'Supplier offers ranked by product' : 'Warehouse capacity and utilisation'}</h2><p>{page === 'Suppliers' ? 'Compare the shortest lead time and lowest supply price for each product.' : 'Capacity usage is calculated from current on-hand inventory.'}</p></div><SearchBox value={search} onChange={setSearch}/></div><DataTable rows={filtered}/></section>}

      {page === 'Consumption Analytics' && <><section className="panel"><div className="panel-head"><div><h2>Calendar-complete daily demand</h2><p>Seven-day moving average per product and warehouse.</p></div><SearchBox value={search} onChange={setSearch}/></div>{filtered.length > 0 && <div className="chart analytics-chart"><ResponsiveContainer><AreaChart data={filtered.slice(-120)}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="sale_date" tickFormatter={dateValue} minTickGap={30}/><YAxis/><Tooltip/><Area type="monotone" dataKey="units_sold" stroke="#258e72" fill="#dff3ec"/><Area type="monotone" dataKey="moving_avg" stroke="#5274d8" fill="none"/></AreaChart></ResponsiveContainer></div>}<DataTable rows={filtered}/></section><section className="panel"><div className="panel-head"><div><h2>Weekly demand changes</h2><p>Week-over-week movement for each product and warehouse.</p></div></div><DataTable rows={analytics.weekly}/></section><section className="panel"><div className="panel-head"><div><h2>Demand trend direction</h2><p>Regression slope and average daily usage from observed sales days.</p></div></div><DataTable rows={analytics.trends}/></section></>}

      {(page === 'Smart Alerts' || page === 'Reorder Predictions') && <><section className="panel"><h2>{page === 'Smart Alerts' ? 'Filter purchasing alerts' : 'Latest prediction results'}</h2><p className="panel-copy">Generate a prediction snapshot to refresh trend estimates and supplier-aware order recommendations.</p><form className="filter-row" onSubmit={e => { e.preventDefault(); load(page) }}><select value={alertFilters.product_id} onChange={e => setAlertFilters({ ...alertFilters, product_id: e.target.value })}><option value="">All products</option>{lookups.products.filter((p, i, a) => a.findIndex(q => q.product_id === p.product_id) === i).map(p => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}</select><select value={alertFilters.warehouse_id} onChange={e => setAlertFilters({ ...alertFilters, warehouse_id: e.target.value })}><option value="">All warehouses</option>{lookups.warehouses.map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</option>)}</select><select value={alertFilters.urgency} onChange={e => setAlertFilters({ ...alertFilters, urgency: e.target.value })}><option value="">All priorities</option>{['OVERDUE', 'ORDER NOW', 'ORDER SOON', 'OK'].map(x => <option key={x}>{x}</option>)}</select><select value={alertFilters.supplier_id} onChange={e => setAlertFilters({ ...alertFilters, supplier_id: e.target.value })}><option value="">All suppliers</option>{[...new Map(lookups.offers.map(p => [p.supplier_id, p.supplier_name]))].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><button className="primary">Apply filters</button><button type="button" className="secondary" onClick={() => { setAlertFilters({ product_id: '', warehouse_id: '', urgency: '', supplier_id: '' }); setSearch('') }}>Clear</button></form></section><section className="panel"><div className="panel-head"><div><h2>Purchase recommendations</h2><p>{filtered.length} matching product-location recommendations.</p></div><SearchBox value={search} onChange={setSearch}/></div><DataTable rows={filtered}/></section></>}

      {page === 'Static vs Predictive' && <><div className="grid two compare"><article className="panel"><h2>Traditional restocking</h2><p>Fixed reorder point checks current quantity only.</p><ul><li>Static threshold rule</li><li>No demand history analysis</li><li>No stockout timing</li></ul></article><article className="panel predictive"><h2>Predictive restocking</h2><p>SQL analytics combine consumption, trend, and supplier lead times.</p><ul><li>Seven calendar day moving average</li><li>Week-over-week and regression slope</li><li>Predicted stockout and order timing</li></ul></article></div><section className="panel"><div className="panel-head"><div><h2>Items flagged before the static threshold</h2><p>Stock remains above reorder point but forecast says an order is due within three days.</p></div></div><DataTable rows={arrayData}/></section></>}

      {page === 'Database Insights' && <section className="panel prose"><h2>Relational model</h2><p>StockSense stores catalogue, suppliers, locations, stock movements, and forecast snapshots in normalized relations.</p><div className="schema">CATEGORY → PRODUCT → PRODUCT_SUPPLIER ← SUPPLIER<br/>PRODUCT → INVENTORY ← WAREHOUSE<br/>PRODUCT → TRANSACTION ← WAREHOUSE<br/>PRODUCT + WAREHOUSE → CONSUMPTION_TREND → REORDER_PREDICTION</div><div className="insight-grid"><article><strong>{data?.total_products ?? '—'}</strong><span>products</span></article><article><strong>{data?.total_suppliers ?? '—'}</strong><span>suppliers</span></article><article><strong>{data?.total_warehouses ?? '—'}</strong><span>warehouses</span></article><article><strong>{lookups.categories.length}</strong><span>categories</span></article></div><h3>Normalization and constraints</h3><p>Category and supplier attributes live outside product facts. Product-supplier offers and product-warehouse inventory use composite keys. Foreign keys protect historical movements and prediction references; checks enforce non-negative stock and prices.</p><h3>SQL analytics</h3><p>Window functions rank supplier offers, calculate moving averages, and compare weekly demand. Recursive CTEs create a complete date series, and regression estimates each product-location trend before forecast snapshots are persisted.</p><p><a href="/docs" target="_blank" rel="noreferrer">Open interactive API documentation</a></p></section>}
    </main>
  </div>
}

function SearchBox({ value, onChange }) { return <div className="search"><Search size={15}/><input aria-label="Search records" placeholder="Search records" value={value} onChange={e => onChange(e.target.value)}/></div> }

createRoot(document.getElementById('root')).render(<App/>);
