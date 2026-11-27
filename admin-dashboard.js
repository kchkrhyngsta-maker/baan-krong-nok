// =====================================
// BAAN KRONG NOK - ADMIN DASHBOARD
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

// =====================================
// ELEMENTS
// =====================================

const getElement = (id) => document.getElementById(id);

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
    "'": '&#039;'
  })[character]);
}

function formatPrice(price) {
  return Number(price || 0).toLocaleString('th-TH');
}

function formatDate(date) {
  if (!date) return '-';

  return new Date(date).toLocaleString('th-TH', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

// =====================================
// CUSTOM REQUEST STATUS
// =====================================

function getCustomStatusLabel(status) {

  const labels = {
    pending: 'รอตรวจสอบ',
    reviewing: 'กำลังตรวจสอบ',
    quoted: 'เสนอราคาแล้ว',
    approved: 'ลูกค้าอนุมัติ',
    in_production: 'กำลังผลิต',
    completed: 'เสร็จสิ้น',
    rejected: 'ไม่รับคำขอ',
    cancelled: 'ยกเลิก'
  };

  return labels[status] || status || '-';
}

// =====================================
// CHECK ADMIN
// =====================================

async function checkAdmin() {

  const { data, error } =
    await supabaseClient.auth.getSession();

  if (error || !data.session) {
    window.location.href = 'admin-login.html';
    return false;
  }

  const { data: isAdmin, error: adminError } =
    await supabaseClient.rpc('is_admin');

  if (adminError || isAdmin !== true) {

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

  select.innerHTML =
    '<option value="">เลือกหมวดหมู่สินค้า</option>';

  categoryList.forEach(category => {

    const option = document.createElement('option');

    option.value = category.id;
    option.textContent = category.name;

    select.appendChild(option);

  });
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
      category,
      category_id,
      description,
      price,
      image_url,
      stock,
      is_active,
      fulfillment_type,
      production_days
    `)
    .order('id', { ascending: false });

  if (error) throw error;

  productList = data || [];

  getElement('productCount').textContent =
    productList.length;

  getElement('activeProductCount').textContent =
    productList.filter(p => p.is_active).length;

  const table = getElement('productTable');

  if (productList.length === 0) {

    table.innerHTML = `
      <tr>
        <td colspan="7">ยังไม่มีสินค้า</td>
      </tr>
    `;

    return;
  }

  table.innerHTML = productList.map(product => {

    const image = product.image_url
      ? `<img
          src="${escapeHTML(product.image_url)}"
          class="product-image"
          alt="รูปสินค้า"
          loading="lazy"
        >`
      : 'ไม่มีรูป';

    const fulfillment =
      product.fulfillment_type === 'preorder'
        ? 'พรีออเดอร์'
        : 'พร้อมส่ง';

    const status =
      product.is_active
        ? 'เปิดขาย'
        : 'ปิดขาย';

    const actionText =
      product.is_active
        ? 'ปิดขาย'
        : 'เปิดขาย';

    return `
      <tr>

        <td>${image}</td>

        <td>${escapeHTML(product.name)}</td>

        <td>${formatPrice(product.price)} บาท</td>

        <td>${Number(product.stock || 0)}</td>

        <td>${fulfillment}</td>

        <td class="status">${status}</td>

        <td>

          <button
            type="button"
            class="action-btn edit-btn"
            data-action="edit"
            data-id="${escapeHTML(product.id)}"
          >
            แก้ไข
          </button>

          <button
            type="button"
            class="action-btn delete-btn"
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
// LOAD ORDERS
// =====================================

async function loadOrders() {

  const { data, error } = await supabaseClient
    .from('orders')
    .select(`
      id,
      order_number,
      customer_name,
      phone,
      total_amount,
      order_status,
      created_at
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const orders = data || [];

  getElement('orderCount').textContent =
    orders.length;

  getElement('pendingOrderCount').textContent =
    orders.filter(
      order => order.order_status === 'pending_confirmation'
    ).length;

  const table = getElement('orderTable');

  if (orders.length === 0) {

    table.innerHTML = `
      <tr>
        <td colspan="5">ยังไม่มีคำสั่งซื้อ</td>
      </tr>
    `;

    return;
  }

  table.innerHTML = orders.map(order => `

    <tr>

      <td>${escapeHTML(order.order_number)}</td>

      <td>${escapeHTML(order.customer_name)}</td>

      <td>${escapeHTML(order.phone)}</td>

      <td>${formatPrice(order.total_amount)} บาท</td>

      <td>${escapeHTML(order.order_status)}</td>

    </tr>

  `).join('');
}

// =====================================
// LOAD CUSTOM ORDER REQUESTS
// =====================================

async function loadCustomRequests() {

  const table = getElement('customRequestTable');

  table.innerHTML = `
    <tr>
      <td colspan="8">กำลังโหลดข้อมูล...</td>
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
      reference_image_path,
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
        <td colspan="8">ยังไม่มีคำขอสั่งทำสินค้า</td>
      </tr>
    `;

    return;
  }

  table.innerHTML = customRequestList.map(request => `

    <tr>

      <td>${escapeHTML(request.request_number)}</td>

      <td>${escapeHTML(request.customer_name)}</td>

      <td>${escapeHTML(request.phone)}</td>

      <td>${escapeHTML(request.product_type)}</td>

      <td>${Number(request.quantity || 1)}</td>

      <td class="status">
        ${escapeHTML(getCustomStatusLabel(request.status))}
      </td>

      <td>${formatDate(request.created_at)}</td>

      <td>
        <button
          type="button"
          class="action-btn view-btn"
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
      ${escapeHTML(request.description || '-').replace(/\n/g, '<br>')}</p>

    <p><strong>วันที่ส่งคำขอ:</strong>
      ${formatDate(request.created_at)}</p>

    <p><strong>สถานะปัจจุบัน:</strong>
      ${escapeHTML(getCustomStatusLabel(request.status))}</p>

    <div id="customReferenceImageArea">
      <p><strong>รูปภาพตัวอย่างจากลูกค้า:</strong></p>
      <p>กำลังโหลดรูปภาพ...</p>
    </div>
  `;

  getElement('customRequestModal').style.display = 'block';

  // รูปภาพอยู่ใน Storage แบบ Private
  // จึงต้องสร้าง Signed URL หลังจากผู้ดูแลเข้าสู่ระบบแล้ว

  const imageArea = getElement('customReferenceImageArea');

  if (request.reference_image_path) {

    try {

      const { data, error } = await supabaseClient.storage
        .from('custom-order-images')
        .createSignedUrl(
          request.reference_image_path,
          3600
        );

      if (error) throw error;

      imageArea.innerHTML = `
        <p><strong>รูปภาพตัวอย่างจากลูกค้า:</strong></p>

        <a
          href="${escapeHTML(data.signedUrl)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="${escapeHTML(data.signedUrl)}"
            class="custom-reference-image"
            alt="รูปภาพตัวอย่างจากลูกค้า"
          >
        </a>

        <p>กดที่รูปภาพเพื่อเปิดดูขนาดเต็ม</p>
      `;

    } catch (error) {

      imageArea.innerHTML = `
        <p><strong>รูปภาพตัวอย่างจากลูกค้า:</strong></p>
        <p>ไม่สามารถเปิดรูปภาพได้: ${escapeHTML(error.message)}</p>
      `;

    }

  } else {

    imageArea.innerHTML = `
      <p><strong>รูปภาพตัวอย่างจากลูกค้า:</strong></p>
      <p>ลูกค้าไม่ได้แนบรูปภาพ</p>
    `;

  }

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

    const priceInput =
      getElement('customQuotedPrice').value.trim();

    const status =
      getElement('customRequestStatus').value;

    const adminNote =
      getElement('customAdminNote').value.trim();

    const allowedStatuses = [
      'pending',
      'reviewing',
      'quoted',
      'approved',
      'in_production',
      'completed',
      'rejected',
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

      if (
        !Number.isFinite(quotedPrice) ||
        quotedPrice < 0
      ) {
        throw new Error('กรุณาตรวจสอบราคาเสนอ');
      }

    }

    const updateData = {
      quoted_price: quotedPrice,
      status: status,
      admin_note: adminNote,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabaseClient
      .from('custom_order_requests')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    showMessage('บันทึกข้อมูลคำขอสั่งทำเรียบร้อยแล้ว');

    closeCustomRequestModal();

    await loadCustomRequests();

  } catch (error) {

    showMessage('บันทึกข้อมูลไม่สำเร็จ: ' + error.message);

  } finally {

    button.disabled = false;
    button.textContent = 'บันทึกข้อมูลคำขอ';

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

  getElement('imagePreview').style.display = 'none';

  getElement('imagePreview').removeAttribute('src');

  getElement('modalTitle').textContent =
    product ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่';

  if (product) {

    getElement('productId').value = product.id;

    getElement('productName').value =
      product.name || '';

    getElement('productCategory').value =
      product.category_id || '';

    getElement('productDescription').value =
      product.description || '';

    getElement('productPrice').value =
      product.price ?? 0;

    getElement('productStock').value =
      product.stock ?? 0;

    getElement('fulfillmentType').value =
      product.fulfillment_type || 'ready_to_ship';

    getElement('productionDays').value =
      product.production_days || '';

    getElement('productActive').value =
      String(product.is_active);

    if (product.image_url) {

      const preview = getElement('imagePreview');

      preview.src = product.image_url;

      preview.style.display = 'block';

    }

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
// PREORDER FIELD
// =====================================

function updateProductionField() {

  const type = getElement('fulfillmentType').value;

  const group = getElement('productionDaysGroup');

  group.style.display =
    type === 'preorder' ? 'block' : 'none';

  getElement('productionDays').required =
    type === 'preorder';

}

// =====================================
// UPLOAD IMAGE
// =====================================

async function uploadProductImage(file) {

  const extension =
    file.name.split('.').pop().toLowerCase();

  const allowedExtensions = [
    'jpg',
    'jpeg',
    'png',
    'webp',
    'gif'
  ];

  if (!allowedExtensions.includes(extension)) {
    throw new Error('รองรับไฟล์ JPG, PNG, WEBP และ GIF เท่านั้น');
  }

  const fileName =
    `${crypto.randomUUID()}.${extension}`;

  const filePath =
    `products/${fileName}`;

  const { error } = await supabaseClient.storage
    .from('product-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  const { data } = supabaseClient.storage
    .from('product-images')
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

    const categoryId =
      getElement('productCategory').value;

    const category = categoryList.find(
      item => String(item.id) === String(categoryId)
    );

    if (!category) {
      throw new Error('กรุณาเลือกหมวดหมู่สินค้า');
    }

    const name =
      getElement('productName').value.trim();

    if (!name) {
      throw new Error('กรุณากรอกชื่อสินค้า');
    }

    const price =
      Number(getElement('productPrice').value);

    const stock =
      Number(getElement('productStock').value);

    if (
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      throw new Error('กรุณาตรวจสอบราคาและจำนวนสินค้า');
    }

    const fulfillment =
      getElement('fulfillmentType').value;

    const productionDays =
      getElement('productionDays').value;

    if (
      fulfillment === 'preorder' &&
      (!productionDays || Number(productionDays) < 1)
    ) {
      throw new Error('กรุณาระบุระยะเวลาผลิตสินค้า');
    }

    let imageUrl = null;

    if (id) {

      const oldProduct = productList.find(
        p => String(p.id) === String(id)
      );

      imageUrl = oldProduct?.image_url || null;

    }

    const imageFile =
      getElement('productImage').files[0];

    if (imageFile) {

      if (!imageFile.type.startsWith('image/')) {
        throw new Error('กรุณาเลือกไฟล์รูปภาพ');
      }

      if (imageFile.size > 5 * 1024 * 1024) {
        throw new Error('รูปภาพต้องมีขนาดไม่เกิน 5 MB');
      }

      imageUrl = await uploadProductImage(imageFile);

    }

    const productData = {

      name: name,

      category_id: category.id,

      category: category.name,

      description:
        getElement('productDescription').value.trim(),

      price: price,

      stock: stock,

      image_url: imageUrl,

      fulfillment_type: fulfillment,

      production_days:
        fulfillment === 'preorder'
          ? Number(productionDays)
          : null,

      is_active:
        getElement('productActive').value === 'true'

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

  const button = event.target.closest(
    'button[data-action]'
  );

  if (!button) return;

  const id = button.dataset.id;

  const product = productList.find(
    p => String(p.id) === String(id)
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
          is_active: newStatus
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

  if (!file.type.startsWith('image/')) {

    showMessage('กรุณาเลือกไฟล์รูปภาพ');

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

  getElement('addProductButton')
    .addEventListener('click', () => {
      openProductModal();
    });

  getElement('cancelButton')
    .addEventListener('click', closeProductModal);

  getElement('productForm')
    .addEventListener('submit', saveProduct);

  getElement('fulfillmentType')
    .addEventListener('change', updateProductionField);

  getElement('productImage')
    .addEventListener('change', previewProductImage);

  getElement('productTable')
    .addEventListener('click', handleProductAction);

  getElement('productModal')
    .addEventListener('click', event => {

      if (event.target.id === 'productModal') {
        closeProductModal();
      }

    });

  // รายการคำขอสั่งทำ

  getElement('customRequestTable')
    .addEventListener('click', handleCustomRequestAction);

  getElement('refreshCustomRequestsButton')
    .addEventListener('click', async () => {

      try {

        await loadCustomRequests();

        showMessage('รีเฟรชรายการคำขอเรียบร้อยแล้ว');

      } catch (error) {

        showMessage('โหลดรายการคำขอไม่สำเร็จ: ' + error.message);

      }

    });

  getElement('customRequestForm')
    .addEventListener('submit', saveCustomRequest);

  getElement('closeCustomRequestButton')
    .addEventListener('click', closeCustomRequestModal);

  getElement('customRequestModal')
    .addEventListener('click', event => {

      if (event.target.id === 'customRequestModal') {
        closeCustomRequestModal();
      }

    });

  // ออกจากระบบ

  getElement('logoutButton')
    .addEventListener('click', async () => {

      const { error } =
        await supabaseClient.auth.signOut();

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

    await loadCategories();

    await loadProducts();

    await loadOrders();

    await loadCustomRequests();

  } catch (error) {

    showMessage(
      'ไม่สามารถโหลดข้อมูลได้: ' + error.message
    );

  }

}

startDashboard();
