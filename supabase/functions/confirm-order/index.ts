// Verifies the Paystack payment, marks the order paid, and sends the Mailgun email.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: { user } } = await db.auth.getUser((req.headers.get('Authorization') ?? '').replace('Bearer ', ''))
  if (!user) return json({ error: 'Not signed in' }, 401)

  const { order_id, reference } = await req.json()
  const { data: order } = await db.from('orders')
    .select('*, order_items(qty, products(name, price))').eq('id', order_id).eq('user_id', user.id).single()
  if (!order) return json({ error: 'Order not found' }, 404)
  if (order.status === 'paid') return json({ ok: true })

  // Real total comes from the products table, never from the browser
  const total = order.order_items.reduce((s: number, i: any) => s + i.qty * i.products.price, 0)

  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}` },
  })
  const pay = (await res.json()).data
  if (!pay || pay.status !== 'success' || pay.amount !== total * 100) {
    await db.from('orders').update({ status: 'failed', reference }).eq('id', order_id)
    return json({ error: 'Payment could not be verified' }, 400)
  }
  await db.from('orders').update({ status: 'paid', reference }).eq('id', order_id)

  const lines = order.order_items.map((i: any) => `${i.qty} x ${i.products.name} - ₦${(i.qty * i.products.price).toLocaleString()}`).join('\n')
  const body = new URLSearchParams({
    from: `NifferFashionHouz <orders@${Deno.env.get('MAILGUN_DOMAIN')}>`,
    to: order.email,
    subject: `Order confirmed - #${order.id.slice(0, 8).toUpperCase()}`,
    text: `Hi ${order.full_name},\n\nThank you for your order. We have received your payment.\n\n${lines}\n\nTotal: ₦${total.toLocaleString()}\n\nDelivery to: ${order.address}, ${order.city}, ${order.state}\n\nNifferFashionHouz`,
  })
  await fetch(`https://api.mailgun.net/v3/${Deno.env.get('MAILGUN_DOMAIN')}/messages`, {   // EU region: api.eu.mailgun.net
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa('api:' + Deno.env.get('MAILGUN_API_KEY')) },
    body,
  })
  return json({ ok: true })
})
