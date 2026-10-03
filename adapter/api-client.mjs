import { createHmac, randomUUID } from 'node:crypto';

// Tashqi foydalanuvchi (baholovchi) uchun yengil HTTP klient.
// Dependentlik yo'q — faqat global fetch (Node >= 18).
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(`[${status}] ${code}: ${message}`);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class OmborClient {
  constructor(baseUrl = 'http://localhost:3000/api', { token } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  with(token) {
    return new OmborClient(this.baseUrl, { token });
  }

  async #req(method, p, body) {
    const res = await fetch(this.baseUrl + p, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const e = json?.error ?? {};
      throw new ApiError(res.status, e.code ?? 'UNKNOWN', e.message ?? 'Noma’lum xato', e.details);
    }
    return json;
  }

  // ---- Auth ----
  register(name, email, password) {
    return this.#req('POST', '/auth/register', { name, email, password }).then((r) => r.data);
  }
  // Mijozlar uchun oddiy kirish. Admin hisobi bilan kirilsa server
  // 403 ADMIN_LOGIN_SEPARATE qaytaradi — adminLogin() ishlatish kerak.
  login(email, password) {
    return this.#req('POST', '/auth/login', { email, password }).then((r) => r.data);
  }
  // Admin — alohida ikki bosqichli kirish. Ikkinchi parol .env dagi
  // ADMIN_SECOND_PASSWORD qiymati (lokal standart: 'devament').
  async adminLogin(email, password, secondPassword = 'devament') {
    const { challenge } = await this.#req('POST', '/auth/admin/login', { email, password }).then((r) => r.data);
    return this.#req('POST', '/auth/admin/verify', { challenge, second_password: secondPassword }).then((r) => r.data);
  }
  me() {
    return this.#req('GET', '/auth/me').then((r) => r.data);
  }

  // ---- Katalog ----
  products({ category, q, page, limit, sort } = {}) {
    const qs = new URLSearchParams();
    if (category) qs.set('category', category);
    if (q) qs.set('q', q);
    if (page) qs.set('page', page);
    if (limit) qs.set('limit', limit);
    if (sort) qs.set('sort', sort);
    const s = qs.toString();
    return this.#req('GET', `/products${s ? `?${s}` : ''}`);
  }
  product(idOrSlug) {
    return this.#req('GET', `/products/${idOrSlug}`).then((r) => r.data);
  }
  categories() {
    return this.#req('GET', '/categories').then((r) => r.data);
  }

  // ---- Savat ----
  cart() {
    return this.#req('GET', '/cart').then((r) => r.data);
  }
  addToCart(variantId, qty) {
    return this.#req('POST', '/cart/items', { variant_id: variantId, qty }).then((r) => r.data);
  }
  updateCartItem(itemId, qty) {
    return this.#req('PATCH', `/cart/items/${itemId}`, { qty }).then((r) => r.data);
  }
  removeCartItem(itemId) {
    return this.#req('DELETE', `/cart/items/${itemId}`).then((r) => r.data);
  }
  clearCart() {
    return this.#req('DELETE', '/cart').then((r) => r.data);
  }

  // ---- Buyurtma ----
  orderFromCart(address = '') {
    return this.#req('POST', '/orders', { address }).then((r) => r.data);
  }
  buyNow(items, address = '') {
    // items: [{ variant_id, qty }]
    return this.#req('POST', '/orders', { items, address }).then((r) => r.data);
  }
  orders({ page, limit, status } = {}) {
    const q = new URLSearchParams();
    if (page) q.set('page', page);
    if (limit) q.set('limit', limit);
    if (status) q.set('status', status);
    const s = q.toString();
    return this.#req('GET', `/orders${s ? `?${s}` : ''}`);
  }
  order(id) {
    return this.#req('GET', `/orders/${id}`).then((r) => r.data);
  }
  cancelOrder(id) {
    return this.#req('POST', `/orders/${id}/cancel`, {}).then((r) => r.data);
  }

  // ---- Soxta provayder callback (imzolash uchun PAYMENT_SECRET kerak) ----
  paymentCallback({ order, status = 'succeeded', amount, providerPaymentId }, paymentSecret) {
    const payload = {
      provider_payment_id: providerPaymentId ?? `pp_${randomUUID().replace(/-/g, '')}`,
      order_id: order.id,
      amount: amount ?? order.total,
      status,
    };
    const signature = createHmac('sha256', paymentSecret)
      .update(`${payload.provider_payment_id}|${payload.order_id}|${payload.amount}|${payload.status}`)
      .digest('hex');
    return this.#req('POST', '/payments/callback', { ...payload, signature }).then((r) => r.data ?? r.error);
  }

  // ---- Admin: kirim va narx ----
  // Mijoz tokeni bilan 403, 2-bosqichdan o'tmagan admin bilan ADMIN_2FA_REQUIRED.
  adminVariants() {
    return this.#req('GET', '/admin/variants').then((r) => r.data);
  }
  // 1-rejim: yangi partiya keladi va narx yangilanadi.
  adminReceipt({ variant_id, warehouse_id, qty, unit_price, note = '' }) {
    return this.#req('POST', '/admin/receipts', { variant_id, warehouse_id, qty, unit_price, note }).then((r) => r.data);
  }
  // 2-rejim: partiya kelmaydi — faqat mavjud qoldiq narxi o'zgaradi.
  adminReprice({ variant_id, unit_price, note = '' }) {
    return this.#req('POST', '/admin/reprice', { variant_id, unit_price, note }).then((r) => r.data);
  }
  adminReceipts(limit = 50) {
    return this.#req('GET', `/admin/receipts?limit=${limit}`).then((r) => r.data);
  }
}
