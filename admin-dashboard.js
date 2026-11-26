const SUPABASE_URL = 'https://acfrebknwxuybroilgqu.supabase.co';

const SUPABASE_KEY = 'sb_publishable_UjWZN8YsBLoBTKsbQ3GZsw_A1X3lSPK';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const messageBox = document.getElementById('pageMessage');

// แสดงข้อความ
function showMessage(text) {
  messageBox.style.display = 'block';
  messageBox.textContent = text;
}

// ตรวจสอบสิทธิ์ผู้ดูแล
async function checkAdmin() {
  const { data: sessionData, error: sessionError } =
    await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    window.location.href = 'admin-login.html';
    return false;
  }

  const { data: isAdmin, error } =
    await supabaseClient.rpc('is_admin');

  if (error || isAdmin !== true) {
    await supabaseClient.auth.signOut();
    window.location.href = 'admin-login.html';
    return false;
  }

  return true;
}

// โหลดข้อมูลสินค้า
async function loadProducts() {
  const { data, error } = await supabaseClient
    .from('products')
    .select('id, name, price, stock, fulfillment_type, is_active')
    .order('id', { ascending: false });

  if (error) {
    throw error;
  }

  document.getElementById('productCount').textContent = data.length;

  document.getElementById('activeProductCount').textContent =
    data.filter(product => product.is_active === true).length;

  const table = document.getElementById('productTable');

  if (data.length === 0) {
    table.innerHTML = '<tr><td colspan="5">ยังไม่มีสินค้า</td></tr>';
    return;
  }

  table.innerHTML = data.map(product => `
    <tr>
      <td>${escapeHTML(product.name)}</td>
      <td>${Number(product.price || 0).toLocaleString('th-TH')} บาท</td>
      <td>${product.stock ?? 0}</td>
      <td>${product.fulfillment_type === 'preorder' ? 'พรีออเดอร์' : 'พร้อมส่ง'}</td>
      <td class="status">${product.is_active ? 'เปิดขาย' : 'ปิดขาย'}</td>
    </tr>
  `).join('');
}

// โหลดข้อมูลคำสั่งซื้อ
async function loadOrders() {
  const { data, error } = await supabaseClient
    .from('orders')
    .select('id, order_number, customer_name, phone, total_amount, order_status')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  document.getElementById('orderCount').textContent = data.length;

  document.getElementById('pendingOrderCount').textContent =
    data.filter(order => order.order_status === 'pending_confirmation').length;

  const table = document.getElementById('orderTable');

  if (data.length === 0) {
    table.innerHTML = '<tr><td colspan="5">ยังไม่มีคำสั่งซื้อ</td></tr>';
    return;
  }

  table.innerHTML = data.map(order => `
    <tr>
      <td>${escapeHTML(order.order_number)}</td>
      <td>${escapeHTML(order.customer_name)}</td>
      <td>${escapeHTML(order.phone)}</td>
      <td>${Number(order.total_amount || 0).toLocaleString('th-TH')} บาท</td>
      <td class="status">${escapeHTML(order.order_status)}</td>
    </tr>
  `).join('');
}

// ป้องกันข้อความจากฐานข้อมูลแทรก HTML
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character]);
}

// ออกจากระบบ
document.getElementById('logoutButton').addEventListener('click', async () => {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    showMessage('ออกจากระบบไม่สำเร็จ: ' + error.message);
    return;
  }

  window.location.href = 'admin-login.html';
});

// เริ่มต้นระบบ
async function startDashboard() {
  try {
    const allowed = await checkAdmin();

    if (!allowed) return;

    await loadProducts();
    await loadOrders();

  } catch (error) {
    showMessage('ไม่สามารถโหลดข้อมูลได้: ' + error.message);
  }
}

startDashboard();
