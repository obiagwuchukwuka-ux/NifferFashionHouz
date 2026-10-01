import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const naira = n => '₦' + n.toLocaleString()

export default function App() {
  const [page, setPage] = useState('home')            // home | shop | checkout | done
  const [filter, setFilter] = useState('all')
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState({})                // { productId: qty }
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.from('products').select('*').then(({ data }) => setProducts(data || []))
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  const go = (p, f = 'all') => { setPage(p); setFilter(f); window.scrollTo(0, 0) }
  const add = id => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }))
  const count = Object.values(cart).reduce((a, b) => a + b, 0)
  const login = () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })

  return (
    <>
      <div className="topbar"><span>FREE DELIVERY ON ORDERS ABOVE ₦50,000</span><span>TRACK ORDER &nbsp;|&nbsp; HELP</span></div>
      <header className="nav">
        <nav><button onClick={() => go('shop', 'men')}>Men</button><button onClick={() => go('shop', 'women')}>Women</button><button onClick={() => go('shop')}>All</button></nav>
        <button className="logo" onClick={() => go('home')}>NIFFER<small>FASHION HOUZ</small></button>
        <nav className="right">
          {user ? <button onClick={() => supabase.auth.signOut()}>Logout</button> : <button onClick={login}>Login</button>}
          <button onClick={() => go('checkout')}>Cart ({count})</button>
        </nav>
      </header>

      {page === 'home' && <Home products={products} go={go} add={add} />}
      {page === 'shop' && <section className="wrap"><h2>{filter === 'all' ? 'All collections' : filter === 'men' ? 'Men' : 'Women'}</h2>
        <Grid items={products.filter(p => filter === 'all' || p.category === filter)} add={add} /></section>}
      {page === 'checkout' && <Checkout products={products} cart={cart} setCart={setCart} user={user} login={login} done={() => { setCart({}); go('done') }} />}
      {page === 'done' && <section className="wrap center"><h2>Thank you!</h2><p>Your order is confirmed. A confirmation email is on its way.</p><button className="btn" onClick={() => go('home')}>Continue shopping</button></section>}

      <footer><b>NifferFashionHouz</b><span>Luxury ready-to-wear for men and women.</span></footer>
    </>
  )
}

function Home({ products, go, add }) {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">LUXURY<br />THAT MOVES<br />WITH YOU.</p>
        <h1>NIFFER</h1>
        <img className="hero-img" src="/hero.png" alt="NifferFashionHouz new collection" />
        <div className="cta"><button className="btn" onClick={() => go('shop')}>SHOP NOW</button><button className="link" onClick={() => go('shop')}>EXPLORE NEW IN</button></div>
        <p className="eyebrow tag">NEW<br />COLLECTION<br />2026</p>
      </section>
      <section className="cats">
        {[['men', 'MEN', 'Cango pants, shirts and corporate wear.'], ['women', 'WOMEN', 'Ankara, lace, gowns and blouses.'], ['all', 'ALL', 'Everything new at the Houz.']].map(([k, t, d]) =>
          <div key={k} className="cat"><i /><div><h3>{t}</h3><p>{d}</p><button className="link" onClick={() => go('shop', k)}>SHOP {t} →</button></div></div>)}
      </section>
      <section className="season"><div><p className="eyebrow">NEW SEASON</p><h2>NEW<br />VIBES</h2><p>Discover everything new and now.</p><button className="btn" onClick={() => go('shop')}>EXPLORE COLLECTION</button></div></section>
      <section className="features">{[['Fast delivery', 'Quick and safe'], ['Easy returns', 'Within 15 days'], ['Quality assured', 'Best fabrics, best finish'], ['Secure payment', '100% secure checkout']].map(([t, d]) => <div key={t}><b>{t}</b><span>{d}</span></div>)}</section>
      <section className="wrap"><div className="rowhead"><h2>Best of Niffer</h2><button className="link" onClick={() => go('shop')}>VIEW ALL</button></div>
        <Grid items={products.filter(p => p.featured)} add={add} /></section>
    </>
  )
}

function Grid({ items, add }) {
  return (
    <div className="grid">{items.map(p => (
      <article key={p.id} className="card">
        <div className="img" style={p.image_url ? { backgroundImage: `url(${p.image_url})` } : null}>{!p.image_url && p.name[0]}</div>
        <h4>{p.name}</h4><p>{naira(p.price)}</p>
        <button className="btn small" onClick={() => add(p.id)}>Add to cart</button>
      </article>))}
    </div>
  )
}

function Checkout({ products, cart, setCart, user, login, done }) {
  const [f, setF] = useState({ full_name: '', phone: '', address: '', city: '', state: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const lines = products.filter(p => cart[p.id]).map(p => ({ ...p, qty: cart[p.id] }))
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0)
  const set = k => e => setF({ ...f, [k]: e.target.value })
  const qty = (id, d) => setCart(c => { const n = { ...c, [id]: (c[id] || 0) + d }; if (n[id] <= 0) delete n[id]; return n })

  async function pay(e) {
    e.preventDefault(); setErr(''); setBusy(true)
    // 1. Save the order (status "pending") and its items
    const { data: order, error } = await supabase.from('orders').insert({ ...f, email: user.email }).select().single()
    if (error) { setErr(error.message); return setBusy(false) }
    const { error: e2 } = await supabase.from('order_items').insert(lines.map(l => ({ order_id: order.id, product_id: l.id, qty: l.qty })))
    if (e2) { setErr(e2.message); return setBusy(false) }
    // 2. Pay with Paystack; 3. server verifies payment, marks paid, sends the email
    window.PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY, email: user.email, amount: total * 100, currency: 'NGN', ref: order.id.replace(/-/g, ''),
      onClose: () => setBusy(false),
      callback: response => {
        supabase.functions.invoke('confirm-order', { body: { order_id: order.id, reference: response.reference } })
          .then(({ error }) => error ? (setErr('Payment received but confirmation failed. Contact us with ref ' + response.reference), setBusy(false)) : done())
      },
    }).openIframe()
  }

  if (!lines.length) return <section className="wrap center"><h2>Your cart is empty</h2></section>
  return (
    <section className="wrap checkout">
      <div><h2>Your bag</h2>
        {lines.map(l => <div className="line" key={l.id}><span>{l.name}</span>
          <span><button onClick={() => qty(l.id, -1)}>−</button> {l.qty} <button onClick={() => qty(l.id, 1)}>+</button></span><span>{naira(l.qty * l.price)}</span></div>)}
        <div className="line total"><span>Total</span><span /><span>{naira(total)}</span></div></div>
      <div><h2>Delivery details</h2>
        {!user ? <><p>Sign in to place your order.</p><button className="btn" onClick={login}>Continue with Google</button></> :
          <form onSubmit={pay}>
            <input placeholder="Full name" value={f.full_name} onChange={set('full_name')} required />
            <input placeholder="Phone number" value={f.phone} onChange={set('phone')} required />
            <input placeholder="Delivery address" value={f.address} onChange={set('address')} required />
            <input placeholder="City" value={f.city} onChange={set('city')} required />
            <input placeholder="State" value={f.state} onChange={set('state')} required />
            {err && <p className="error">{err}</p>}
            <button className="btn" disabled={busy}>{busy ? 'Processing…' : `Pay ${naira(total)}`}</button>
          </form>}
      </div>
    </section>
  )
}
