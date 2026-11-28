// ======================================================
// BAAN KRONG NOK - ADMIN DASHBOARD
// ======================================================

const SUPABASE_URL =
  'https://acfrebknwxuybroilgqu.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_UjWZN8YsBLoBTKsbQ3GZsw_A1X3lSPK';

const PRODUCT_BUCKET = 'product-images 1';
const CUSTOM_IMAGE_BUCKET = 'custom-order-images 1';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let categories = [];
let products = [];
let orders = [];
let customRequests = [];
let currentOrder = null;
let currentCategoryFilter = 'all';

const $ = id => document.getElementById(id);

// ======================================================
// ฟังก์ชันพื้นฐาน
// ======================================================

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[c]);
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') {
    return 'ยังไม่กำหนดราคา';
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString('th-TH', {
        maximumFractionDigits: 2
      }) + ' บาท'
    : 'ยังไม่กำหนดราคา';
}

function formatDate(value) {
  if (!value) return '-';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleString('th-TH', {
        dateStyle: 'short',
        timeStyle: 'short'
      });
}

function showMessage(message, type = 'success') {
  const box = $('pageMessage');

  if (!box) {
    alert(message);
    return;
  }

  box.textContent = message;
  box.className = type === 'error'
    ? 'message error'
    : 'message';

  box.style.display = 'block';

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });

  window.setTimeout(() => {
    box.style.display = 'none';
  }, 5000);
}

const STATUS_TEXT = {
  pending: 'รอตรวจสอบ',
  awaiting_payment: 'รอชำระเงิน',
  payment_review: 'รอตรวจสอบการชำระเงิน',
  paid: 'ชำระเงินแล้ว',
  processing: 'กำลังดำเนินการ',
  shipped: 'จัดส่งแล้ว',
  completed: 'สำเร็จ',
  cancelled: 'ยกเลิก',
  reviewing: 'กำลังพิจารณา',
  quoted: 'เสนอราคาแล้ว',
  accepted: 'ลูกค้ายืนยันแล้ว',
  rejected: 'ปฏิเสธ'
};

function getStatusText(status) {
  return STATUS_TEXT[status] || status || '-';
}

function getFulfillmentText(type) {
  return ({
    preorder: 'พรีออเดอร์',
    ready_stock: 'สินค้าพร้อมส่ง',
    custom: 'สั่งทำพิเศษ'
  })[type] || '-';
}

// ======================================================
// ตรวจสอบสิทธิ์ผู้ดูแลระบบ
// ======================================================

async function checkAdmin() {
  try {
    const {
      data: { session },
      error
    } = await supabaseClient.auth.getSession();

    if (error) throw error;

    if (!session) {
      window.location.replace('admin-login.html');
      return false;
    }

    const {
      data,
      error: adminError
    } = await supabaseClient.rpc('is_admin');

    if (adminError) throw adminError;

    if (data !== true) {
      alert('บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบผู้ดูแล');
      await supabaseClient.auth.signOut();
      window.location.replace('admin-login.html');
      return false;
    }

    return true;

  } catch (error) {
    console.error('Admin check:', error);

    alert(
      'ตรวจสอบสิทธิ์ผู้ดูแลไม่สำเร็จ: ' +
      error.message
    );

    return false;
  }
}

// ======================================================
// ออกจากระบบ
// ======================================================

async function logoutAdmin() {
  if (!confirm('ต้องการออกจากระบบหรือไม่?')) {
    return;
  }

  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    showMessage(
      'ออกจากระบบไม่สำเร็จ: ' + error.message,
      'error'
    );
    return;
  }

  window.location.replace('admin-login.html');
}

// ======================================================
// โหลดหมวดหมู่สินค้า
// ======================================================

async function loadCategories() {
  const { data, error } = await supabaseClient
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', {
      ascending: true
    });

  if (error) throw error;

  categories = data || [];

  $('productCategory').innerHTML =
    '<option value="">เลือกหมวดหมู่สินค้า</option>' +
    categories.map(category => `
      <option value="${category.id}">
        ${escapeHTML(category.name)}
      </option>
    `).join('');

  renderCategoryFilters();
}

function renderCategoryFilters() {
  const box = $('categoryFilter');

  box.innerHTML = `
    <button
      type="button"
      data-category="all"
      class="${currentCategoryFilter === 'all' ? 'active' : ''}"
    >
      ทั้งหมด
    </button>

    ${categories.map(category => `
      <button
        type="button"
        data-category="${category.id}"
        class="${
          String(currentCategoryFilter) === String(category.id)
            ? 'active'
            : ''
        }"
      >
        ${escapeHTML(category.name)}
      </button>
    `).join('')}
  `;
}

function filterProducts(categoryId) {
  currentCategoryFilter = categoryId;
  renderCategoryFilters();
  renderProducts();
}

// ======================================================
// โหลดสินค้า
// ======================================================

async function loadProducts() {
  const { data, error } = await supabaseClient
    .from('products')
    .select('*, categories(name)')
    .order('created_at', {
      ascending: false
    });

  if (error) throw error;

  products = data || [];

  renderProducts();
  updateDashboardStats();
}

// ======================================================
// แสดงสินค้าในตาราง
// ======================================================

function renderProducts() {
  const table = $('productTable');

  let list = products;

  if (currentCategoryFilter !== 'all') {
    list = products.filter(product =>
      String(product.category_id) ===
      String(currentCategoryFilter)
    );
  }

  if (!list.length) {
    table.innerHTML = `
      <tr>
        <td colspan="6" class="empty-message">
          ไม่พบข้อมูลสินค้า
        </td>
      </tr>
    `;
    return;
  }

  table.innerHTML = list.map(product => `
    <tr>
      <td>
        ${
          product.image_url
            ? `
              <img
                src="${escapeHTML(product.image_url)}"
                alt="${escapeHTML(product.name)}"
                style="
                  width:65px;
                  height:65px;
                  object-fit:cover;
                  border-radius:8px;
                "
              >
            `
            : 'ไม่มีรูปภาพ'
        }
      </td>

      <td>
        <strong>${escapeHTML(product.name)}</strong>
        <br>
        <small>
          ${escapeHTML(
            getFulfillmentText(product.fulfillment_type)
          )}
          · จำนวน ${Number(product.stock || 0)}
        </small>
      </td>

      <td>
        ${escapeHTML(product.categories?.name || '-')}
      </td>

      <td>
        ${formatPrice(product.price)}
      </td>

      <td>
        ${
          product.is_active
            ? '<span style="color:green">เปิดขาย</span>'
            : '<span style="color:#b84b4b">ปิดขาย</span>'
        }
      </td>

      <td>
        <button
          type="button"
          class="btn-small"
          data-action="edit-product"
          data-id="${product.id}"
        >
          แก้ไข
        </button>

        <button
          type="button"
          class="btn-small btn-secondary"
          data-action="toggle-product"
          data-id="${product.id}"
        >
          ${product.is_active ? 'ปิดขาย' : 'เปิดขาย'}
        </button>

        <button
          type="button"
          class="btn-small btn-danger"
          data-action="delete-product"
          data-id="${product.id}"
        >
          ลบ
        </button>
      </td>
    </tr>
  `).join('');
}

// ======================================================
// เปิดหน้าต่างเพิ่มหรือแก้ไขสินค้า
// ======================================================

function openProductModal(product = null) {
  $('productForm').reset();

  $('productId').value = product?.id || '';
  $('productName').value = product?.name || '';
  $('productNameEn').value = product?.name_en || '';
  $('productCategory').value = product?.category_id || '';
  $('productDescription').value = product?.description || '';
  $('productPrice').value = product?.price ?? '';
  $('productStock').value = product?.stock ?? 0;

  $('fulfillmentType').value =
    product?.fulfillment_type || 'preorder';

  $('productionDays').value =
    product?.production_days ?? '';

  $('productActive').checked =
    product ? Boolean(product.is_active) : true;

  $('productImage').value = '';

  const preview = $('imagePreview');

  if (product?.image_url) {
    preview.src = product.image_url;
    preview.style.display = 'block';
  } else {
    preview.removeAttribute('src');
    preview.style.display = 'none';
  }

  $('productModal').style.display = 'flex';
}

function closeProductModal() {
  $('productModal').style.display = 'none';
}

// ======================================================
// อัปโหลดรูปภาพสินค้า
// ======================================================

async function uploadProductImage(file) {
  if (!file) return null;

  if (!file.type.startsWith('image/')) {
    throw new Error('กรุณาเลือกไฟล์รูปภาพ');
  }

  const extension = file.name
    .split('.')
    .pop()
    .toLowerCase();

  const path =
    `product-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;

  const { error } = await supabaseClient.storage
    .from(PRODUCT_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  const { data } = supabaseClient.storage
    .from(PRODUCT_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

// ======================================================
// บันทึกสินค้า
// ======================================================

async function saveProduct(event) {
  event.preventDefault();

  const button = $('saveProductButton');

  button.disabled = true;
  button.textContent = 'กำลังบันทึก...';

  try {
    const id = $('productId').value;

    const oldProduct = products.find(product =>
      String(product.id) === String(id)
    );

    const file = $('productImage').files?.[0];

    const imageUrl = file
      ? await uploadProductImage(file)
      : (oldProduct?.image_url || null);

    const name = $('productName').value.trim();
    const categoryId = $('productCategory').value;
    const priceText = $('productPrice').value.trim();
    const stock = Number($('productStock').value || 0);
    const daysText = $('productionDays').value.trim();

    const price = priceText === ''
      ? null
      : Number(priceText);

    const productionDays = daysText === ''
      ? null
      : Number(daysText);

    if (!name || !categoryId) {
      throw new Error(
        'กรุณากรอกชื่อสินค้าและเลือกหมวดหมู่'
      );
    }

    if (
      price !== null &&
      (!Number.isFinite(price) || price < 0)
    ) {
      throw new Error('ราคาสินค้าไม่ถูกต้อง');
    }

    if (!Number.isFinite(stock) || stock < 0) {
      throw new Error('จำนวนสินค้าไม่ถูกต้อง');
    }

    if (
      productionDays !== null &&
      (
        !Number.isInteger(productionDays) ||
        productionDays < 1
      )
    ) {
      throw new Error(
        'ระยะเวลาผลิตต้องเป็นจำนวนวันตั้งแต่ 1 วันขึ้นไป'
      );
    }

    const payload = {
      name,
      name_en: $('productNameEn').value.trim() || null,
      category_id: Number(categoryId),
      description: $('productDescription').value.trim(),
      price,
      stock,
      fulfillment_type: $('fulfillmentType').value,
      production_days: productionDays,
      image_url: imageUrl,
      is_active: $('productActive').checked,
      updated_at: new Date().toISOString()
    };

    const result = id
      ? await supabaseClient
          .from('products')
          .update(payload)
          .eq('id', id)
      : await supabaseClient
          .from('products')
          .insert(payload);

    if (result.error) {
      throw result.error;
    }

    closeProductModal();

    await loadProducts();

    showMessage('บันทึกข้อมูลสินค้าเรียบร้อยแล้ว');

  } catch (error) {
    console.error('Save product:', error);

    showMessage(
      'บันทึกสินค้าไม่สำเร็จ: ' + error.message,
      'error'
    );

  } finally {
    button.disabled = false;
    button.textContent = 'บันทึกสินค้า';
  }
}

// ======================================================
// เปิดหรือปิดการขายสินค้า
// ======================================================

async function toggleProduct(id) {
  const product = products.find(item =>
    String(item.id) === String(id)
  );

  if (!product) return;

  const { error } = await supabaseClient
    .from('products')
    .update({
      is_active: !product.is_active,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) {
    showMessage(
      'เปลี่ยนสถานะสินค้าไม่สำเร็จ: ' + error.message,
      'error'
    );
    return;
  }

  await loadProducts();

  showMessage(
    product.is_active
      ? 'ปิดการขายสินค้าแล้ว'
      : 'เปิดขายสินค้าแล้ว'
  );
}

// ======================================================
// ลบสินค้า
// ======================================================

async function deleteProduct(id) {
  if (!confirm('ต้องการลบสินค้านี้หรือไม่?')) {
    return;
  }

  const { error } = await supabaseClient
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    showMessage(
      'ลบสินค้าไม่สำเร็จ: ' + error.message,
      'error'
    );
    return;
  }

  await loadProducts();

  showMessage('ลบสินค้าเรียบร้อยแล้ว');
}
// ======================================================
// โหลดคำสั่งซื้อ
// ======================================================

async function loadOrders() {
  const { data, error } = await supabaseClient
    .from('orders')
    .select('*')
    .order('created_at', {
      ascending: false
    });

  if (error) throw error;

  orders = data || [];

  renderOrders();
  updateDashboardStats();
}

// ======================================================
// แสดงรายการคำสั่งซื้อ
// ======================================================

function renderOrders() {
  const table = $('orderTable');

  if (!table) return;

  if (!orders.length) {
    table.innerHTML = `
      <tr>
        <td colspan="7" class="empty-message">
          ยังไม่มีคำสั่งซื้อ
        </td>
      </tr>
    `;
    return;
  }

  table.innerHTML = orders.map(order => `
    <tr>
      <td>${escapeHTML(order.order_number)}</td>

      <td>${escapeHTML(order.customer_name)}</td>

      <td>${escapeHTML(order.phone)}</td>

      <td>${formatPrice(order.total_amount)}</td>

      <td>${escapeHTML(getStatusText(order.order_status))}</td>

      <td>${formatDate(order.created_at)}</td>

      <td>
        <button
          type="button"
          class="btn-small"
          data-action="view-order"
          data-id="${order.id}"
        >
          ดูรายละเอียด
        </button>
      </td>
    </tr>
  `).join('');
}

// ======================================================
// สร้างหน้าต่างรายละเอียดคำสั่งซื้อ
// ======================================================

function createOrderModal() {
  if ($('orderDetailModal')) return;

  const modal = document.createElement('div');

  modal.id = 'orderDetailModal';
  modal.style.cssText = `
    display:none;
    position:fixed;
    inset:0;
    background:rgba(0,0,0,.55);
    z-index:9999;
    overflow:auto;
    padding:20px;
  `;

  modal.innerHTML = `
    <div style="
      background:white;
      max-width:750px;
      margin:30px auto;
      padding:24px;
      border-radius:12px;
    ">

      <h2>รายละเอียดคำสั่งซื้อ</h2>

      <div id="orderDetailContent">
        กำลังโหลดข้อมูล...
      </div>

      <hr style="margin:20px 0">

      <h3>กำหนดค่าจัดส่งและยอดชำระ</h3>

      <label for="orderShippingFee">
        ค่าจัดส่ง (บาท)
      </label>

      <input
        id="orderShippingFee"
        type="number"
        min="0"
        step="0.01"
        value="0"
        style="width:100%;padding:10px;margin:8px 0 15px"
      >

      <div style="
        background:#f5f8f3;
        padding:15px;
        border-radius:8px;
        line-height:2;
      ">
        <div>
          ยอดรวมสินค้า:
          <strong id="orderSubtotalPreview">0 บาท</strong>
        </div>

        <div>
          ค่าจัดส่ง:
          <strong id="orderShippingPreview">0 บาท</strong>
        </div>

        <div style="font-size:20px">
          ยอดสุทธิ:
          <strong id="orderTotalPreview">0 บาท</strong>
        </div>
      </div>

      <p style="margin-top:12px;color:#8a5b20">
        ตรวจสอบสินค้าและค่าจัดส่งก่อนยืนยันยอดให้ลูกค้า
      </p>

      <label for="orderStatusSelect">
        สถานะคำสั่งซื้อ
      </label>

      <select
        id="orderStatusSelect"
        style="width:100%;padding:10px;margin:8px 0 15px"
      >
        <option value="pending">รอตรวจสอบ</option>
        <option value="awaiting_payment">รอชำระเงิน</option>
        <option value="payment_review">รอตรวจสอบการชำระเงิน</option>
        <option value="paid">ชำระเงินแล้ว</option>
        <option value="processing">กำลังดำเนินการ</option>
        <option value="shipped">จัดส่งแล้ว</option>
        <option value="completed">สำเร็จ</option>
        <option value="cancelled">ยกเลิก</option>
      </select>

      <label for="orderAdminNote">
        หมายเหตุจากร้าน
      </label>

      <textarea
        id="orderAdminNote"
        rows="3"
        style="width:100%;padding:10px;margin:8px 0 15px"
      ></textarea>

      <button
        type="button"
        id="confirmOrderButton"
        class="btn-primary"
      >
        ยืนยันยอดและแจ้งชำระเงิน
      </button>

      <button
        type="button"
        id="saveOrderButton"
        class="btn-secondary"
      >
        บันทึกสถานะ
      </button>

      <button
        type="button"
        id="closeOrderModal"
        class="btn-danger"
      >
        ปิดหน้าต่าง
      </button>

    </div>
  `;

  document.body.appendChild(modal);

  $('closeOrderModal').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  $('orderShippingFee').addEventListener(
    'input',
    updateOrderTotalPreview
  );

  $('confirmOrderButton').addEventListener(
    'click',
    confirmOrderForPayment
  );

  $('saveOrderButton').addEventListener(
    'click',
    saveOrderStatus
  );
}

// ======================================================
// เปิดดูรายละเอียดคำสั่งซื้อ
// ======================================================

async function viewOrder(id) {
  try {
    createOrderModal();

    currentOrder = orders.find(order =>
      String(order.id) === String(id)
    );

    if (!currentOrder) {
      throw new Error('ไม่พบคำสั่งซื้อ');
    }

    $('orderDetailModal').style.display = 'block';

    $('orderDetailContent').innerHTML =
      'กำลังโหลดรายละเอียดสินค้า...';

    const { data: items, error } = await supabaseClient
      .from('order_items')
      .select('*')
      .eq('order_id', id);

    if (error) throw error;

    const address = currentOrder.shipping_address || {};

    const addressText = typeof address === 'string'
      ? address
      : Object.values(address).filter(Boolean).join(' ');

    $('orderDetailContent').innerHTML = `
      <p><strong>เลขคำสั่งซื้อ:</strong>
        ${escapeHTML(currentOrder.order_number)}
      </p>

      <p><strong>ชื่อลูกค้า:</strong>
        ${escapeHTML(currentOrder.customer_name)}
      </p>

      <p><strong>เบอร์โทรศัพท์:</strong>
        ${escapeHTML(currentOrder.phone)}
      </p>

      <p><strong>อีเมล:</strong>
        ${escapeHTML(currentOrder.email || '-')}
      </p>

      <p><strong>ที่อยู่จัดส่ง:</strong>
        ${escapeHTML(addressText || '-')}
      </p>

      <p><strong>วันที่สั่งซื้อ:</strong>
        ${formatDate(currentOrder.created_at)}
      </p>

      <h3>รายการสินค้า</h3>

      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th>สินค้า</th>
              <th>จำนวน</th>
              <th>ราคา</th>
              <th>รวม</th>
            </tr>
          </thead>

          <tbody>
            ${(items || []).map(item => `
              <tr>
                <td>${escapeHTML(item.product_name || item.name || '-')}</td>
                <td>${Number(item.quantity || 0)}</td>
                <td>${formatPrice(item.unit_price)}</td>
                <td>${formatPrice(item.total_price)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <p>
        <strong>หมายเหตุจากลูกค้า:</strong>
        ${escapeHTML(currentOrder.customer_note || '-')}
      </p>
    `;

    $('orderShippingFee').value =
      Number(currentOrder.shipping_fee || 0);

    $('orderStatusSelect').value =
      currentOrder.order_status;

    $('orderAdminNote').value =
      currentOrder.admin_note || '';

    updateOrderTotalPreview();

  } catch (error) {
    console.error(error);

    showMessage(
      'เปิดรายละเอียดไม่สำเร็จ: ' + error.message,
      'error'
    );
  }
}

// ======================================================
// คำนวณยอดสุทธิ
// ======================================================

function updateOrderTotalPreview() {
  if (!currentOrder) return;

  const subtotal = Number(currentOrder.subtotal || 0);

  const shippingFee = Number(
    $('orderShippingFee').value || 0
  );

  const total = subtotal + shippingFee;

  $('orderSubtotalPreview').textContent =
    formatPrice(subtotal);

  $('orderShippingPreview').textContent =
    formatPrice(shippingFee);

  $('orderTotalPreview').textContent =
    formatPrice(total);
}

// ======================================================
// ยืนยันยอดคำสั่งซื้อและแจ้งให้ลูกค้าชำระเงิน
// ======================================================

async function confirmOrderForPayment() {
  if (!currentOrder) return;

  const button = $('confirmOrderButton');

  const shippingFee = Number(
    $('orderShippingFee').value
  );

  const subtotal = Number(currentOrder.subtotal || 0);

  if (
    !Number.isFinite(shippingFee) ||
    shippingFee < 0
  ) {
    showMessage('กรุณากรอกค่าจัดส่งให้ถูกต้อง', 'error');
    return;
  }

  const totalAmount = subtotal + shippingFee;

  if (!confirm(
    `ยืนยันยอดคำสั่งซื้อ ${currentOrder.order_number}\n\n` +
    `ยอดสินค้า: ${formatPrice(subtotal)}\n` +
    `ค่าจัดส่ง: ${formatPrice(shippingFee)}\n` +
    `ยอดสุทธิ: ${formatPrice(totalAmount)}\n\n` +
    `ต้องการยืนยันยอดและเปลี่ยนสถานะเป็นรอชำระเงินหรือไม่?`
  )) {
    return;
  }

  button.disabled = true;
  button.textContent = 'กำลังบันทึก...';

  try {
    const { data, error } = await supabaseClient
      .from('orders')
      .update({
        shipping_fee: shippingFee,
        total_amount: totalAmount,
        order_status: 'awaiting_payment',
        admin_note: $('orderAdminNote').value.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentOrder.id)
      .select()
      .single();

    if (error) throw error;

    currentOrder = data;

    await loadOrders();

    $('orderDetailModal').style.display = 'none';

    showMessage(
      'ยืนยันยอดคำสั่งซื้อเรียบร้อยแล้ว สถานะเป็นรอชำระเงิน'
    );

  } catch (error) {
    console.error(error);

    showMessage(
      'ยืนยันยอดไม่สำเร็จ: ' + error.message,
      'error'
    );

  } finally {
    button.disabled = false;
    button.textContent = 'ยืนยันยอดและแจ้งชำระเงิน';
  }
}

// ======================================================
// บันทึกสถานะคำสั่งซื้อ
// ======================================================

async function saveOrderStatus() {
  if (!currentOrder) return;

  const status = $('orderStatusSelect').value;

  const { error } = await supabaseClient
    .from('orders')
    .update({
      order_status: status,
      admin_note: $('orderAdminNote').value.trim() || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', currentOrder.id);

  if (error) {
    showMessage(
      'บันทึกสถานะไม่สำเร็จ: ' + error.message,
      'error'
    );
    return;
  }

  $('orderDetailModal').style.display = 'none';

  await loadOrders();

  showMessage('บันทึกสถานะคำสั่งซื้อเรียบร้อยแล้ว');
}

// ======================================================
// สถิติหน้า Dashboard
// ======================================================

async function updateDashboardStats() {
  try {
    const { count: productCount, error: productError } =
      await supabaseClient
        .from('products')
        .select('*', {
          count: 'exact',
          head: true
        });

    if (productError) throw productError;

    const { count: activeCount, error: activeError } =
      await supabaseClient
        .from('products')
        .select('*', {
          count: 'exact',
          head: true
        })
        .eq('is_active', true);

    if (activeError) throw activeError;

    const { count: orderCount, error: orderError } =
      await supabaseClient
        .from('orders')
        .select('*', {
          count: 'exact',
          head: true
        });

    if (orderError) throw orderError;

    const pendingCount = orders.filter(order =>
      ['pending', 'awaiting_payment', 'payment_review']
        .includes(order.order_status)
    ).length;

    if ($('totalProducts')) {
      $('totalProducts').textContent = productCount || 0;
    }

    if ($('activeProducts')) {
      $('activeProducts').textContent = activeCount || 0;
    }

    if ($('totalOrders')) {
      $('totalOrders').textContent = orderCount || 0;
    }

    if ($('pendingOrders')) {
      $('pendingOrders').textContent = pendingCount;
    }

  } catch (error) {
    console.error('Dashboard stats:', error);
  }
}

// ======================================================
// เริ่มต้นระบบ
// ======================================================

async function initAdminDashboard() {
  const allowed = await checkAdmin();

  if (!allowed) return;

  try {
    await loadCategories();
    await loadProducts();
    await loadOrders();

    createOrderModal();

    if ($('productForm')) {
      $('productForm').addEventListener(
        'submit',
        saveProduct
      );
    }

    if ($('addProductButton')) {
      $('addProductButton').addEventListener(
        'click',
        () => openProductModal()
      );
    }

    if ($('closeProductModal')) {
      $('closeProductModal').addEventListener(
        'click',
        closeProductModal
      );
    }

    if ($('categoryFilter')) {
      $('categoryFilter').addEventListener(
        'click',
        event => {
          const button = event.target.closest(
            '[data-category]'
          );

          if (button) {
            filterProducts(button.dataset.category);
          }
        }
      );
    }

    document.addEventListener('click', event => {
      const button = event.target.closest('[data-action]');

      if (!button) return;

      const id = button.dataset.id;
      const action = button.dataset.action;

      if (action === 'edit-product') {
        const product = products.find(item =>
          String(item.id) === String(id)
        );

        if (product) openProductModal(product);
      }

      if (action === 'toggle-product') {
        toggleProduct(id);
      }

      if (action === 'delete-product') {
        deleteProduct(id);
      }

      if (action === 'view-order') {
        viewOrder(id);
      }
    });

    if ($('logoutButton')) {
      $('logoutButton').addEventListener(
        'click',
        logoutAdmin
      );
    }

  } catch (error) {
    console.error('Dashboard initialization:', error);

    showMessage(
      'โหลดข้อมูลหน้าแอดมินไม่สำเร็จ: ' + error.message,
      'error'
    );
  }
}

document.addEventListener(
  'DOMContentLoaded',
  initAdminDashboard
);
