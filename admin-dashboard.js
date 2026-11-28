// =====================================
// BAAN KRONG NOK - ADMIN DASHBOARD
// FULL VERSION
// =====================================

const SUPABASE_URL = 'https://acfrebknwxuybroilgqu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_UjWZN8YsBLoBTKsbQ3GZsw_A1X3lSPK';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let productList = [];
let categoryList = [];
let customRequestList = [];
let orderList = [];
let selectedCategory = 'all';

// =====================================
// ELEMENTS
// =====================================

const getElement = id => document.getElementById(id);

// =====================================
// MESSAGE
// =====================================

function showMessage(message) {
  const box = getElement('pageMessage');

  if (!box) {
    alert(message);
    return;
  }

  box.style.display = 'block';
  box.textContent = message;

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

// =====================================
// SECURITY / HTML
// =====================================

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function formatPrice(price) {
  if (price === null || price === undefined || price === '') {
    return 'ยังไม่กำหนด';
  }

  return Number(price).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(date) {
  if (!date) return '-';

  return new Date(date).toLocaleString('th-TH', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok'
  });
}

// =====================================
// STATUS LABELS
// =====================================

function getCustomStatusLabel(status) {
  const labels = {
    pending: 'รอตรวจสอบ',
    reviewing: 'กำลังตรวจสอบ',
    quoted: 'เสนอราคาแล้ว',
    accepted: 'ลูกค้ายืนยันราคา',
    rejected: 'ไม่รับคำขอ',
    completed: 'เสร็จสิ้น',
    cancelled: 'ยกเลิก'
  };

  return labels[status] || status || '-';
}

function getOrderStatusLabel(status) {
  const labels = {
    pending: 'รอดำเนินการ',
    awaiting_payment: 'รอชำระเงิน',
    payment_review: 'รอตรวจสอบการชำระเงิน',
    paid: 'ชำระเงินแล้ว',
    processing: 'กำลังดำเนินการ',
    shipped: 'จัดส่งแล้ว',
    completed: 'สำเร็จ',
    cancelled: 'ยกเลิก'
  };

  return labels[status] || status || '-';
}

function getFulfillmentLabel(type) {
  const labels = {
    preorder: 'พรีออเดอร์',
    ready_stock: 'พร้อมส่ง',
    custom: 'สั่งทำ'
  };

  return labels[type] || type || '-';
}

// =====================================
// CHECK ADMIN
// =====================================

async function checkAdmin() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data.session) {
    window.location.href = 'admin-login.html';
    return false;
  }

  const { data: isAdmin, error: adminError } =
    await supabaseClient.rpc('is_admin');

  if (adminError || isAdmin !== true) {
    console.error('Admin verification failed:', adminError);

    await supabaseClient.auth.signOut();

    window.location.href = 'admin-login.html';
    return false;
  }

  return true;
}

// =====================================
// LOAD CATEGORIES
// =====================================

async function loadCategories() {
  const { data, error } = await supabaseClient
    .from('categories')
    .select('id,name,slug,is_active,sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;

  categoryList = data || [];

  const select = getElement('productCategory');

  if (!select) return;

  select.innerHTML = '<option value="">เลือกหมวดหมู่สินค้า</option>';

  categoryList.forEach(category => {
    const option = document.createElement('option');

    option.value = category.id;
    option.textContent = category.name;

    select.appendChild(option);
  });
}

// =====================================
// CATEGORY FILTER
// =====================================

function filterProducts(categoryId) {
  selectedCategory = String(categoryId);
  renderProducts();
}

// =====================================
// RENDER PRODUCTS
// =====================================

function renderProducts() {
  const table = getElement('productTable');

  if (!table) return;

  const filteredProducts = selectedCategory === 'all'
    ? productList
    : productList.filter(product =>
        String(product.category_id) === String(selectedCategory)
      );

  document.querySelectorAll(
    '#categoryFilter [data-category]'
  ).forEach(button => {
    const isActive =
      String(button.dataset.category) === String(selectedCategory);

    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  const description = getElement('categoryDescription');

  if (description) {
    if (selectedCategory === 'all') {
      description.textContent = 'แสดงสินค้าทั้งหมด';
    } else {
      const category = categoryList.find(
        item => String(item.id) === String(selectedCategory)
      );

      description.textContent = category
        ? `หมวดหมู่: ${category.name}`
        : 'ไม่พบหมวดหมู่สินค้า';
    }
  }

  if (filteredProducts.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="6" class="empty">ไม่มีสินค้าในหมวดหมู่นี้</td>
      </tr>
    `;

    return;
  }

  table.innerHTML = filteredProducts.map(product => {
    const image = product.image_url
      ? `
        <img
          src="${escapeHTML(product.image_url)}"
          alt="รูปสินค้า"
          loading="lazy"
        >
      `
      : 'ยังไม่มีรูปภาพ';

    const category = categoryList.find(
      item => String(item.id) === String(product.category_id)
    );

    const status = product.is_active ? 'เปิดขาย' : 'ปิดขาย';
    const actionText = product.is_active ? 'ปิดขาย' : 'เปิดขาย';

    return `
      <tr>
        <td>${image}</td>

        <td>
          ${escapeHTML(product.name)}
          ${
            product.name_en
              ? `<br><small>${escapeHTML(product.name_en)}</small>`
              : ''
          }
        </td>

        <td>${escapeHTML(category?.name || '-')}</td>

        <td>${formatPrice(product.price)} บาท</td>

        <td>${status}</td>

        <td>
          <button
            type="button"
            class="small-button"
            data-action="edit"
            data-id="${escapeHTML(product.id)}"
          >
            แก้ไข
          </button>

          <button
            type="button"
            class="danger-button"
            data-action="toggle"
            data-id="${escapeHTML(product.id)}"
          >
            ${actionText}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// =====================================
// LOAD PRODUCTS
// =====================================

async function loadProducts() {
  const { data, error } = await supabaseClient
    .from('products')
    .select(`
      id,
      name,
      name_en,
      category_id,
      description,
      price,
      image_url,
      stock,
      is_active,
      fulfillment_type,
      production_days,
      created_at
    `)
    .order('id', { ascending: true });

  if (error) throw error;

  productList = data || [];

  getElement('productCount').textContent = productList.length;

  getElement('activeProductCount').textContent =
    productList.filter(product => product.is_active).length;

  renderProducts();
}

// =====================================
// ORDER STATUS OPTIONS
// =====================================

const ORDER_STATUSES = [
  ['pending', 'รอดำเนินการ'],
  ['awaiting_payment', 'รอชำระเงิน'],
  ['payment_review', 'รอตรวจสอบการชำระเงิน'],
  ['paid', 'ชำระเงินแล้ว'],
  ['processing', 'กำลังดำเนินการ'],
  ['shipped', 'จัดส่งแล้ว'],
  ['completed', 'สำเร็จ'],
  ['cancelled', 'ยกเลิก']
];

// =====================================
// CREATE ORDER DETAIL MODAL
// =====================================

function createOrderModal() {
  if (getElement('orderDetailModal')) return;

  const modal = document.createElement('div');

  modal.id = 'orderDetailModal';
  modal.className = 'modal';

  modal.innerHTML = `
    <div class="modal-content">

      <div class="modal-header">
        <h3>รายละเอียดคำสั่งซื้อ</h3>

        <button
          type="button"
          class="secondary-button"
          id="closeOrderModal"
        >
          ปิด
        </button>
      </div>

      <div id="orderDetailContent">
        กำลังโหลดข้อมูล...
      </div>

      <form id="orderStatusForm">

        <input type="hidden" id="editingOrderId">

        <div class="form-group">
          <label for="orderStatusSelect">
            สถานะคำสั่งซื้อ
          </label>

          <select id="orderStatusSelect" required>
            ${ORDER_STATUSES.map(item => `
              <option value="${item[0]}">${item[1]}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="orderAdminNote">
            หมายเหตุจากร้าน
          </label>

          <textarea
            id="orderAdminNote"
            placeholder="บันทึกข้อความสำหรับการจัดการคำสั่งซื้อ"
          ></textarea>
        </div>

        <div class="modal-actions">
          <button
            type="submit"
            class="primary-button"
            id="saveOrderButton"
          >
            บันทึกการเปลี่ยนแปลง
          </button>
        </div>

      </form>
    </div>
  `;

  document.body.appendChild(modal);

  getElement('closeOrderModal')
    .addEventListener('click', closeOrderModal);

  modal.addEventListener('click', event => {
    if (event.target === modal) {
      closeOrderModal();
    }
  });

  getElement('orderStatusForm')
    .addEventListener('submit', saveOrderStatus);
}

// =====================================
// LOAD ORDERS
// =====================================

async function loadOrders() {
  const table = getElement('orderTable');

  if (table) {
    table.innerHTML = `
      <tr>
        <td colspan="5" class="empty">กำลังโหลดคำสั่งซื้อ...</td>
      </tr>
    `;
  }

  const { data, error } = await supabaseClient
    .from('orders')
    .select(`
      id,
      order_number,
      customer_name,
      phone,
      email,
      shipping_address,
      subtotal,
      shipping_fee,
      total_amount,
      order_status,
      customer_note,
      admin_note,
      created_at
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  orderList = data || [];

  getElement('orderCount').textContent = orderList.length;

  getElement('pendingOrderCount').textContent =
    orderList.filter(order =>
      ['pending', 'awaiting_payment', 'payment_review'].includes(
        order.order_status
      )
    ).length;

  if (!table) return;

  if (orderList.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="5" class="empty">ยังไม่มีคำสั่งซื้อ</td>
      </tr>
    `;

    return;
  }

  table.innerHTML = orderList.map(order => `
    <tr>
      <td>
        <strong>${escapeHTML(order.order_number)}</strong>
        <br>
        <button
          type="button"
          class="small-button"
          data-order-action="view"
          data-id="${escapeHTML(order.id)}"
        >
          ดูรายละเอียด
        </button>
      </td>

      <td>
        ${escapeHTML(order.customer_name)}
        <br>
        <small>${escapeHTML(order.phone)}</small>
      </td>

      <td>${formatDate(order.created_at)}</td>

      <td>${formatPrice(order.total_amount)} บาท</td>

      <td>
        ${escapeHTML(getOrderStatusLabel(order.order_status))}
      </td>
    </tr>
  `).join('');
}

// =====================================
// VIEW ORDER DETAILS
// =====================================

async function openOrderDetails(order) {
  createOrderModal();

  const modal = getElement('orderDetailModal');
  const content = getElement('orderDetailContent');

  modal.style.display = 'block';

  content.innerHTML = '<p>กำลังโหลดรายการสินค้า...</p>';

  getElement('editingOrderId').value = order.id;

  getElement('orderStatusSelect').value =
    order.order_status || 'pending';

  getElement('orderAdminNote').value =
    order.admin_note || '';

  const { data: items, error } = await supabaseClient
    .from('order_items')
    .select(`
      id,
      product_id,
      product_name,
      product_image,
      unit_price,
      quantity,
      subtotal
    `)
    .eq('order_id', order.id)
    .order('id', { ascending: true });

  if (error) throw error;

  const address = order.shipping_address || {};

  const addressText = [
    address.address,
    address.subdistrict ? 'ตำบล' + address.subdistrict : '',
    address.district ? 'อำเภอ' + address.district : '',
    address.province ? 'จังหวัด' + address.province : '',
    address.postcode
  ].filter(Boolean).join(' ');

  const itemHTML = (items || []).map(item => `
    <div style="
      display:flex;
      gap:12px;
      padding:12px 0;
      border-bottom:1px solid #edf1ec;
      align-items:center;
    ">
      ${
        item.product_image
          ? `<img
              src="${escapeHTML(item.product_image)}"
              alt=""
              style="width:65px;height:65px;object-fit:cover;border-radius:8px"
            >`
          : ''
      }

      <div style="flex:1">
        <strong>${escapeHTML(item.product_name)}</strong>
        <p>จำนวน ${Number(item.quantity)} ชิ้น</p>
        <small>ราคาต่อชิ้น ${formatPrice(item.unit_price)} บาท</small>
      </div>

      <strong>${formatPrice(item.subtotal)} บาท</strong>
    </div>
  `).join('');

  content.innerHTML = `
    <div style="line-height:2">

      <h3>ข้อมูลคำสั่งซื้อ</h3>

      <p>
        <strong>เลขที่คำสั่งซื้อ:</strong>
        ${escapeHTML(order.order_number)}
      </p>

      <p>
        <strong>วันที่สั่งซื้อ:</strong>
        ${formatDate(order.created_at)}
      </p>

      <hr style="margin:15px 0">

      <h3>ข้อมูลลูกค้า</h3>

      <p><strong>ชื่อ:</strong>
        ${escapeHTML(order.customer_name)}</p>

      <p><strong>เบอร์โทรศัพท์:</strong>
        ${escapeHTML(order.phone)}</p>

      <p><strong>อีเมล:</strong>
        ${escapeHTML(order.email || '-')}</p>

      <p><strong>ที่อยู่จัดส่ง:</strong><br>
        ${escapeHTML(addressText || '-')}</p>

      <p><strong>หมายเหตุจากลูกค้า:</strong><br>
        ${escapeHTML(order.customer_note || '-').replace(/\n/g, '<br>')}</p>

      <hr style="margin:15px 0">

      <h3>รายการสินค้า</h3>

      ${itemHTML || '<p>ไม่พบรายการสินค้า</p>'}

      <div style="margin-top:15px;line-height:2">

        <p>
          ยอดรวมสินค้า:
          <strong>${formatPrice(order.subtotal)} บาท</strong>
        </p>

        <p>
          ค่าจัดส่ง:
          <strong>${formatPrice(order.shipping_fee)} บาท</strong>
        </p>

        <p style="font-size:20px">
          ยอดรวมทั้งหมด:
          <strong>${formatPrice(order.total_amount)} บาท</strong>
        </p>

      </div>

    </div>
  `;
}

// =====================================
// HANDLE ORDER CLICK
// =====================================

async function handleOrderAction(event) {
  const button = event.target.closest(
    'button[data-order-action="view"]'
  );

  if (!button) return;

  const order = orderList.find(
    item => String(item.id) === String(button.dataset.id)
  );

  if (!order) return;

  button.disabled = true;

  try {
    await openOrderDetails(order);
  } catch (error) {
    showMessage('ไม่สามารถเปิดรายละเอียดคำสั่งซื้อได้: ' + error.message);
  } finally {
    button.disabled = false;
  }
}

// =====================================
// CLOSE ORDER MODAL
// =====================================

function closeOrderModal() {
  const modal = getElement('orderDetailModal');

  if (modal) {
    modal.style.display = 'none';
  }
}

// =====================================
// SAVE ORDER STATUS
// =====================================

async function saveOrderStatus(event) {
  event.preventDefault();

  const button = getElement('saveOrderButton');

  const id = getElement('editingOrderId').value;
  const status = getElement('orderStatusSelect').value;
  const note = getElement('orderAdminNote').value.trim();

  const allowedStatuses = ORDER_STATUSES.map(item => item[0]);

  if (!id) {
    showMessage('ไม่พบรหัสคำสั่งซื้อ');
    return;
  }

  if (!allowedStatuses.includes(status)) {
    showMessage('สถานะคำสั่งซื้อไม่ถูกต้อง');
    return;
  }

  button.disabled = true;
  button.textContent = 'กำลังบันทึก...';

  try {
    const { error } = await supabaseClient
      .from('orders')
      .update({
        order_status: status,
        admin_note: note,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    showMessage('อัปเดตสถานะคำสั่งซื้อเรียบร้อยแล้ว');

    closeOrderModal();

    await loadOrders();

  } catch (error) {
    showMessage('บันทึกสถานะไม่สำเร็จ: ' + error.message);

  } finally {
    button.disabled = false;
    button.textContent = 'บันทึกการเปลี่ยนแปลง';
  }
}

// =====================================
// LOAD CUSTOM ORDER REQUESTS
// =====================================

async function loadCustomRequests() {
  const table = getElement('customRequestTable');

  if (!table) return;

  table.innerHTML = `
    <tr>
      <td colspan="6" class="empty">กำลังโหลดข้อมูล...</td>
    </tr>
  `;

  const { data, error } = await supabaseClient
    .from('custom_order_requests')
    .select(`
      id,
      request_number,
      customer_name,
      phone,
      email,
      contact_channel,
      product_type,
      dimensions,
      shape,
      pattern,
      quantity,
      description,
      quoted_price,
      status,
      admin_note,
      created_at
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  customRequestList = data || [];

  if (customRequestList.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="6" class="empty">ยังไม่มีคำขอสั่งทำสินค้า</td>
      </tr>
    `;

    return;
  }

  table.innerHTML = customRequestList.map(request => `
    <tr>
      <td>${escapeHTML(request.request_number)}</td>

      <td>
        ${escapeHTML(request.customer_name)}
        <br>
        <small>${escapeHTML(request.phone)}</small>
      </td>

      <td>${escapeHTML(request.product_type)}</td>

      <td>${Number(request.quantity || 1)}</td>

      <td>${escapeHTML(getCustomStatusLabel(request.status))}</td>

      <td>
        <button
          type="button"
          class="small-button"
          data-custom-action="view"
          data-id="${escapeHTML(request.id)}"
        >
          ดูรายละเอียด
        </button>
      </td>
    </tr>
  `).join('');
}

// =====================================
// LOAD CUSTOM REQUEST IMAGES
// =====================================

async function loadCustomRequestImages(requestId) {
  const imageArea = getElement('customReferenceImageArea');

  if (!imageArea) return;

  imageArea.innerHTML = '<p>กำลังโหลดรูปภาพ...</p>';

  const { data, error } = await supabaseClient
    .from('custom_request_images')
    .select('id,image_url,file_name')
    .eq('request_id', requestId)
    .order('id', { ascending: true });

  if (error) throw error;

  if (!data || data.length === 0) {
    imageArea.innerHTML = '<p>ลูกค้าไม่ได้แนบรูปภาพ</p>';
    return;
  }

  const images = await Promise.all(data.map(async image => {
    let imageUrl = image.image_url;

    if (!/^https?:\/\//i.test(imageUrl)) {
      const { data: signedData, error: signedError } =
        await supabaseClient.storage
          .from('custom-order-images 1')
          .createSignedUrl(imageUrl, 3600);

      if (signedError) throw signedError;

      imageUrl = signedData.signedUrl;
    }

    return `
      <div style="margin:12px 0">
        <a
          href="${escapeHTML(imageUrl)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="${escapeHTML(imageUrl)}"
            alt="รูปภาพตัวอย่างจากลูกค้า"
            style="width:130px;height:130px;object-fit:cover;border-radius:8px"
          >
        </a>

        <p>${escapeHTML(image.file_name || 'รูปภาพแนบ')}</p>
      </div>
    `;
  }));

  imageArea.innerHTML = `
    <p><strong>รูปภาพตัวอย่างจากลูกค้า:</strong></p>
    ${images.join('')}
    <p>กดที่รูปภาพเพื่อเปิดดูขนาดเต็ม</p>
  `;
}

// =====================================
// OPEN CUSTOM REQUEST DETAILS
// =====================================

async function openCustomRequest(request) {
  getElement('customRequestId').value = request.id;

  getElement('customQuotedPrice').value =
    request.quoted_price ?? '';

  getElement('customRequestStatus').value =
    request.status || 'pending';

  getElement('customAdminNote').value =
    request.admin_note || '';

  const details = getElement('customRequestDetails');

  details.innerHTML = `
    <p><strong>เลขที่คำขอ:</strong>
      ${escapeHTML(request.request_number)}</p>

    <p><strong>ชื่อลูกค้า:</strong>
      ${escapeHTML(request.customer_name)}</p>

    <p><strong>เบอร์โทรศัพท์:</strong>
      ${escapeHTML(request.phone)}</p>

    <p><strong>อีเมล:</strong>
      ${escapeHTML(request.email || '-')}</p>

    <p><strong>ช่องทางติดต่อ:</strong>
      ${escapeHTML(request.contact_channel || '-')}</p>

    <p><strong>ประเภทสินค้า:</strong>
      ${escapeHTML(request.product_type)}</p>

    <p><strong>ขนาด:</strong>
      ${escapeHTML(request.dimensions || '-')}</p>

    <p><strong>รูปทรง:</strong>
      ${escapeHTML(request.shape || '-')}</p>

    <p><strong>ลวดลาย:</strong>
      ${escapeHTML(request.pattern || '-')}</p>

    <p><strong>จำนวน:</strong>
      ${Number(request.quantity || 1)}</p>

    <p><strong>รายละเอียดเพิ่มเติม:</strong><br>
      ${escapeHTML(request.description || '-').replace(/\n/g, '<br>')}
    </p>

    <p><strong>วันที่ส่งคำขอ:</strong>
      ${formatDate(request.created_at)}</p>

    <p><strong>สถานะปัจจุบัน:</strong>
      ${escapeHTML(getCustomStatusLabel(request.status))}</p>

    <div id="customReferenceImageArea">
      <p>กำลังโหลดรูปภาพ...</p>
    </div>
  `;

  getElement('customRequestModal').style.display = 'block';

  await loadCustomRequestImages(request.id);
}

// =====================================
// HANDLE CUSTOM REQUEST CLICK
// =====================================

async function handleCustomRequestAction(event) {
  const button = event.target.closest(
    'button[data-custom-action="view"]'
  );

  if (!button) return;

  const request = customRequestList.find(
    item => String(item.id) === String(button.dataset.id)
  );

  if (!request) return;

  try {
    await openCustomRequest(request);
  } catch (error) {
    showMessage('ไม่สามารถเปิดรายละเอียดได้: ' + error.message);
  }
}

// =====================================
// SAVE CUSTOM REQUEST
// =====================================

async function saveCustomRequest(event) {
  event.preventDefault();

  const button = getElement('saveCustomRequestButton');

  button.disabled = true;
  button.textContent = 'กำลังบันทึก...';

  try {
    const id = getElement('customRequestId').value;

    const priceInput = getElement('customQuotedPrice').value.trim();
    const status = getElement('customRequestStatus').value;
    const adminNote = getElement('customAdminNote').value.trim();

    const allowedStatuses = [
      'pending',
      'reviewing',
      'quoted',
      'accepted',
      'rejected',
      'completed',
      'cancelled'
    ];

    if (!id) {
      throw new Error('ไม่พบรหัสคำขอสั่งทำ');
    }

    if (!allowedStatuses.includes(status)) {
      throw new Error('สถานะคำขอไม่ถูกต้อง');
    }

    let quotedPrice = null;

    if (priceInput !== '') {
      quotedPrice = Number(priceInput);

      if (!Number.isFinite(quotedPrice) || quotedPrice < 0) {
        throw new Error('กรุณาตรวจสอบราคาเสนอ');
      }
    }

    const { error } = await supabaseClient
      .from('custom_order_requests')
      .update({
        quoted_price: quotedPrice,
        status,
        admin_note: adminNote,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    showMessage('บันทึกข้อมูลคำขอสั่งทำเรียบร้อยแล้ว');

    closeCustomRequestModal();

    await loadCustomRequests();

  } catch (error) {
    showMessage('บันทึกข้อมูลไม่สำเร็จ: ' + error.message);

  } finally {
    button.disabled = false;
    button.textContent = 'บันทึกข้อมูล';
  }
}

// =====================================
// CLOSE CUSTOM REQUEST MODAL
// =====================================

function closeCustomRequestModal() {
  getElement('customRequestModal').style.display = 'none';
}

// =====================================
// OPEN PRODUCT MODAL
// =====================================

function openProductModal(product = null) {
  const form = getElement('productForm');

  form.reset();

  getElement('productId').value = '';

  const preview = getElement('imagePreview');

  preview.style.display = 'none';
  preview.removeAttribute('src');

  getElement('modalTitle').textContent =
    product ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่';

  if (product) {
    getElement('productId').value = product.id;

    getElement('productName').value = product.name || '';

    getElement('productNameEn').value = product.name_en || '';

    getElement('productCategory').value =
      product.category_id || '';

    getElement('productDescription').value =
      product.description || '';

    getElement('productPrice').value =
      product.price ?? '';

    getElement('productStock').value =
      product.stock ?? 0;

    getElement('fulfillmentType').value =
      product.fulfillment_type || 'preorder';

    getElement('productionDays').value =
      product.production_days ?? '';

    getElement('productActive').checked =
      product.is_active === true;

    if (product.image_url) {
      preview.src = product.image_url;
      preview.style.display = 'block';
    }

  } else {
    getElement('fulfillmentType').value = 'preorder';
    getElement('productActive').checked = true;
  }

  updateProductionField();

  getElement('productModal').style.display = 'block';
}

// =====================================
// CLOSE PRODUCT MODAL
// =====================================

function closeProductModal() {
  getElement('productModal').style.display = 'none';
}

// =====================================
// PRODUCTION FIELD
// =====================================

function updateProductionField() {
  const type = getElement('fulfillmentType').value;

  const group = getElement('productionDaysGroup');

  group.style.display =
    type === 'preorder' || type === 'custom'
      ? 'block'
      : 'none';

  getElement('productionDays').required = false;
}

// =====================================
// UPLOAD PRODUCT IMAGE
// =====================================

async function uploadProductImage(file) {
  const extension = file.name.split('.').pop().toLowerCase();

  const allowedExtensions = [
    'jpg',
    'jpeg',
    'png',
    'webp'
  ];

  if (!allowedExtensions.includes(extension)) {
    throw new Error('รองรับไฟล์ JPG, PNG และ WEBP เท่านั้น');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('รูปภาพต้องมีขนาดไม่เกิน 5 MB');
  }

  const fileName = `${crypto.randomUUID()}.${extension}`;

  const filePath = `products/${fileName}`;

  const { error } = await supabaseClient.storage
    .from('product-images 1')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  const { data } = supabaseClient.storage
    .from('product-images 1')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// =====================================
// SAVE PRODUCT
// =====================================

async function saveProduct(event) {
  event.preventDefault();

  const button = getElement('saveProductButton');

  button.disabled = true;
  button.textContent = 'กำลังบันทึก...';

  try {
    const id = getElement('productId').value;

    const categoryId = getElement('productCategory').value;

    const category = categoryList.find(
      item => String(item.id) === String(categoryId)
    );

    if (!category) {
      throw new Error('กรุณาเลือกหมวดหมู่สินค้า');
    }

    const name = getElement('productName').value.trim();

    if (!name) {
      throw new Error('กรุณากรอกชื่อสินค้า');
    }

    const nameEn = getElement('productNameEn').value.trim();

    const priceInput = getElement('productPrice').value.trim();

    const stockInput = getElement('productStock').value.trim();

    const price = priceInput === '' ? null : Number(priceInput);

    const stock = stockInput === '' ? 0 : Number(stockInput);

    if (
      (price !== null && (!Number.isFinite(price) || price < 0)) ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      throw new Error('กรุณาตรวจสอบราคาและจำนวนสินค้า');
    }

    const fulfillment = getElement('fulfillmentType').value;

    const allowedFulfillment = [
      'preorder',
      'ready_stock',
      'custom'
    ];

    if (!allowedFulfillment.includes(fulfillment)) {
      throw new Error('ประเภทสินค้าไม่ถูกต้อง');
    }

    const productionDaysInput =
      getElement('productionDays').value.trim();

    const productionDays =
      productionDaysInput === ''
        ? null
        : Number(productionDaysInput);

    if (
      productionDays !== null &&
      (!Number.isInteger(productionDays) || productionDays < 1)
    ) {
      throw new Error('ระยะเวลาผลิตต้องเป็นจำนวนวันตั้งแต่ 1 วันขึ้นไป');
    }

    let imageUrl = null;

    if (id) {
      const oldProduct = productList.find(
        product => String(product.id) === String(id)
      );

      imageUrl = oldProduct?.image_url || null;
    }

    const imageFile = getElement('productImage').files[0];

    if (imageFile) {
      if (!imageFile.type.startsWith('image/')) {
        throw new Error('กรุณาเลือกไฟล์รูปภาพ');
      }

      imageUrl = await uploadProductImage(imageFile);
    }

    const productData = {
      name,
      name_en: nameEn || null,
      category_id: category.id,
      description: getElement('productDescription').value.trim(),
      price,
      stock,
      image_url: imageUrl,
      fulfillment_type: fulfillment,
      production_days: productionDays,
      is_active: getElement('productActive').checked,
      updated_at: new Date().toISOString()
    };

    if (id) {
      const { error } = await supabaseClient
        .from('products')
        .update(productData)
        .eq('id', id);

      if (error) throw error;

      showMessage('แก้ไขสินค้าเรียบร้อยแล้ว');

    } else {
      const { error } = await supabaseClient
        .from('products')
        .insert([productData]);

      if (error) throw error;

      showMessage('เพิ่มสินค้าเรียบร้อยแล้ว');
    }

    closeProductModal();

    await loadProducts();

  } catch (error) {
    showMessage('บันทึกไม่สำเร็จ: ' + error.message);

  } finally {
    button.disabled = false;
    button.textContent = 'บันทึกสินค้า';
  }
}

// =====================================
// EDIT / ACTIVE / INACTIVE PRODUCT
// =====================================

async function handleProductAction(event) {
  const button = event.target.closest('button[data-action]');

  if (!button) return;

  const id = button.dataset.id;

  const product = productList.find(
    item => String(item.id) === String(id)
  );

  if (!product) return;

  if (button.dataset.action === 'edit') {
    openProductModal(product);
    return;
  }

  if (button.dataset.action === 'toggle') {
    const newStatus = !product.is_active;

    const message = newStatus
      ? `ต้องการเปิดขาย "${product.name}" หรือไม่?`
      : `ต้องการปิดการขาย "${product.name}" หรือไม่?`;

    if (!confirm(message)) return;

    button.disabled = true;

    try {
      const { error } = await supabaseClient
        .from('products')
        .update({
          is_active: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      showMessage(
        newStatus
          ? 'เปิดขายสินค้าเรียบร้อยแล้ว'
          : 'ปิดการขายสินค้าเรียบร้อยแล้ว'
      );

      await loadProducts();

    } catch (error) {
      showMessage('ไม่สามารถเปลี่ยนสถานะได้: ' + error.message);

      button.disabled = false;
    }
  }
}

// =====================================
// IMAGE PREVIEW
// =====================================

function previewProductImage(event) {
  const file = event.target.files[0];

  if (!file) return;

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (!allowedTypes.includes(file.type)) {
    showMessage('รองรับเฉพาะรูปภาพ JPG, PNG และ WEBP');

    event.target.value = '';

    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showMessage('รูปภาพต้องมีขนาดไม่เกิน 5 MB');

    event.target.value = '';

    return;
  }

  const preview = getElement('imagePreview');

  preview.src = URL.createObjectURL(file);

  preview.style.display = 'block';
}

// =====================================
// EVENT LISTENERS
// =====================================

function setupEvents() {

  getElement('categoryFilter')
    ?.addEventListener('click', event => {
      const button = event.target.closest('[data-category]');

      if (!button) return;

      filterProducts(button.dataset.category);
    });

  getElement('addProductButton')
    ?.addEventListener('click', () => openProductModal());

  // รองรับปุ่มปิดที่มี ID ซ้ำใน HTML เดิม
  getElement('productModal')
    ?.addEventListener('click', event => {
      if (
        event.target.id === 'productModal' ||
        event.target.id === 'cancelButton'
      ) {
        closeProductModal();
      }
    });

  getElement('productForm')
    ?.addEventListener('submit', saveProduct);

  getElement('fulfillmentType')
    ?.addEventListener('change', updateProductionField);

  getElement('productImage')
    ?.addEventListener('change', previewProductImage);

  getElement('productTable')
    ?.addEventListener('click', handleProductAction);

  // คำสั่งซื้อ
  getElement('orderTable')
    ?.addEventListener('click', handleOrderAction);

  // คำขอสั่งทำ
  getElement('customRequestTable')
    ?.addEventListener('click', handleCustomRequestAction);

  getElement('refreshCustomRequestsButton')
    ?.addEventListener('click', async () => {
      try {
        await loadCustomRequests();
        showMessage('รีเฟรชรายการคำขอเรียบร้อยแล้ว');
      } catch (error) {
        showMessage('โหลดรายการคำขอไม่สำเร็จ: ' + error.message);
      }
    });

  getElement('customRequestForm')
    ?.addEventListener('submit', saveCustomRequest);

  getElement('customRequestModal')
    ?.addEventListener('click', event => {
      if (
        event.target.id === 'customRequestModal' ||
        event.target.id === 'closeCustomRequestButton'
      ) {
        closeCustomRequestModal();
      }
    });

  getElement('logoutButton')
    ?.addEventListener('click', async () => {
      const { error } = await supabaseClient.auth.signOut();

      if (error) {
        showMessage(error.message);
        return;
      }

      window.location.href = 'admin-login.html';
    });
}

// =====================================
// START DASHBOARD
// =====================================

async function startDashboard() {
  try {
    setupEvents();

    const allowed = await checkAdmin();

    if (!allowed) return;

    createOrderModal();

    await loadCategories();
    await loadProducts();
    await loadOrders();
    await loadCustomRequests();

  } catch (error) {
    console.error(error);

    showMessage('ไม่สามารถโหลดข้อมูลได้: ' + error.message);
  }
}

startDashboard();
