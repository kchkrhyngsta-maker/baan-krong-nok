// ======================================================

// BAAN KRONG NOK - ADMIN DASHBOARD

// ======================================================

const SUPABASE_URL = 'https://acfrebknwxuybroilgqu.supabase.co';

const SUPABASE_KEY = 'sb_publishable_UjWZN8YsBLoBTKsbQ3GZsw_A1X3lSPK';

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

      name: name,

      name_en:

        $('productNameEn').value.trim() || null,

      category_id: Number(categoryId),

      description:

        $('productDescription').value.trim(),

      price: price,

      stock: stock,

      fulfillment_type:

        $('fulfillmentType').value,

      production_days: productionDays,

      image_url: imageUrl,

      is_active:

        $('productActive').checked,

      updated_at:

        new Date().toISOString()

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

// แสดงคำสั่งซื้อ

// ======================================================

function renderOrders() {

  const table = $('orderTable');

  if (!orders.length) {

    table.innerHTML = `

      <tr>

        <td colspan="5" class="empty-message">

          ยังไม่มีคำสั่งซื้อ

        </td>

      </tr>

    `;

    return;

  }

  table.innerHTML = orders.map(order => `

    <tr>

      <td>

        ${escapeHTML(order.order_number || '-')}

      </td>

      <td>

        ${escapeHTML(order.customer_name || '-')}

        <br>

        <small>${escapeHTML(order.phone || '-')}</small>

      </td>

      <td>

        ${formatDate(order.created_at)}

      </td>

      <td>

        ${formatPrice(order.total_amount)}

      </td>

      <td>

        ${escapeHTML(

          getStatusText(order.order_status)

        )}

        <br>

        <button

          type="button"

          class="btn-small"

          data-action="view-order"

          data-id="${escapeHTML(order.id)}"

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

  modal.className = 'modal';

  modal.innerHTML = `

    <div class="modal-content">

      <div class="modal-header">

        <h2>รายละเอียดคำสั่งซื้อ</h2>

        <button

          type="button"

          class="close-button"

          id="closeOrderModalButton"

        >

          ×

        </button>

      </div>

      <div id="orderDetailContent">

        กำลังโหลดข้อมูล...

      </div>

      <hr style="margin:18px 0">

      <label for="orderStatusSelect">

        สถานะคำสั่งซื้อ

      </label>

      <select id="orderStatusSelect">

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

        หมายเหตุสำหรับผู้ดูแล

      </label>

      <textarea

        id="orderAdminNote"

        rows="3"

      ></textarea>

      <div class="notice">

        เปลี่ยนสถานะเป็น “ชำระเงินแล้ว”

        หลังตรวจสอบหลักฐานและยืนยันการรับชำระเงินจริงเท่านั้น

      </div>

      <div class="modal-actions">

        <button

          type="button"

          class="btn-secondary"

          id="cancelOrderButton"

        >

          ปิด

        </button>

        <button

          type="button"

          id="saveOrderButton"

        >

          บันทึกสถานะ

        </button>

      </div>

    </div>

  `;

  document.body.appendChild(modal);

  $('closeOrderModalButton').addEventListener(

    'click',

    closeOrderModal

  );

  $('cancelOrderButton').addEventListener(

    'click',

    closeOrderModal

  );

  $('saveOrderButton').addEventListener(

    'click',

    saveOrderStatus

  );

}

function closeOrderModal() {

  if ($('orderDetailModal')) {

    $('orderDetailModal').style.display = 'none';

  }

  currentOrder = null;

}

// ======================================================

// จัดรูปแบบที่อยู่จัดส่ง

// ======================================================

function formatAddress(address) {

  if (!address) return '-';

  if (typeof address === 'string') {

    return escapeHTML(address);

  }

  if (typeof address !== 'object') {

    return '-';

  }

  return [

    address.address,

    address.address_line,

    address.subdistrict,

    address.district,

    address.province,

    address.postcode

  ]

    .filter(Boolean)

    .map(escapeHTML)

    .join(' ') || '-';

}

// ======================================================

// เปิดดูรายละเอียดคำสั่งซื้อ

// ======================================================

async function viewOrder(id) {

  createOrderModal();

  const order = orders.find(item =>

    String(item.id) === String(id)

  );

  if (!order) {

    showMessage('ไม่พบคำสั่งซื้อ', 'error');

    return;

  }

  currentOrder = order;

  $('orderDetailModal').style.display = 'flex';

  $('orderStatusSelect').value =

    order.order_status || 'pending';

  $('orderAdminNote').value =

    order.admin_note || '';

  $('orderDetailContent').innerHTML =

    'กำลังโหลดรายการสินค้า...';

  const { data: items, error } = await supabaseClient

    .from('order_items')

    .select('*')

    .eq('order_id', order.id);

  if (error) {

    console.error('Order items:', error);

    $('orderDetailContent').innerHTML =

      'โหลดรายการสินค้าไม่สำเร็จ: ' +

      escapeHTML(error.message);

    return;

  }

  const itemRows = (items || []).map(item => `

    <div class="order-item">

      ${

        item.product_image

          ? `

            <img

              src="${escapeHTML(item.product_image)}"

              alt="${escapeHTML(item.product_name || 'สินค้า')}"

            >

          `

          : ''

      }

      <div class="order-item-info">

        <strong>

          ${escapeHTML(item.product_name || '-')}

        </strong>

        <br>

        <small>

          จำนวน ${Number(item.quantity || 0)}

          · ราคาต่อชิ้น ${formatPrice(item.unit_price)}

        </small>

      </div>

      <div class="order-item-total">

        ${formatPrice(item.subtotal)}

      </div>

    </div>

  `).join('');

  $('orderDetailContent').innerHTML = `

    <div class="detail-box">

      <p>

        <strong>เลขคำสั่งซื้อ:</strong>

        ${escapeHTML(order.order_number || '-')}

      </p>

      <p>

        <strong>ชื่อลูกค้า:</strong>

        ${escapeHTML(order.customer_name || '-')}

      </p>

      <p>

        <strong>เบอร์โทรศัพท์:</strong>

        ${escapeHTML(order.phone || '-')}

      </p>

      <p>

        <strong>อีเมล:</strong>

        ${escapeHTML(order.email || '-')}

      </p>

      <p>

        <strong>ที่อยู่จัดส่ง:</strong>

        ${formatAddress(order.shipping_address)}

      </p>

      <p>

        <strong>วันที่สั่งซื้อ:</strong>

        ${formatDate(order.created_at)}

      </p>

    </div>

    <h3>รายการสินค้า</h3>

    ${

      itemRows ||

      '<p>ไม่มีรายการสินค้า</p>'

    }

    <div class="detail-box">

      <p>

        ยอดสินค้า:

        <strong>${formatPrice(order.subtotal)}</strong>

      </p>

      <p>

        ค่าจัดส่ง:

        <strong>${formatPrice(order.shipping_fee)}</strong>

      </p>

      <h3>

        ยอดรวม: ${formatPrice(order.total_amount)}

      </h3>

    </div>

    <p>

      <strong>หมายเหตุจากลูกค้า:</strong>

      ${escapeHTML(order.customer_note || '-')}

    </p>

  `;

}

// ======================================================

// บันทึกสถานะคำสั่งซื้อ

// ======================================================

async function saveOrderStatus() {

  if (!currentOrder) return;

  const status = $('orderStatusSelect').value;

  const adminNote =

    $('orderAdminNote').value.trim();

  if (!confirm('ยืนยันการเปลี่ยนสถานะคำสั่งซื้อหรือไม่?')) {

    return;

  }

  const button = $('saveOrderButton');

  button.disabled = true;

  button.textContent = 'กำลังบันทึก...';

  try {

    const { error } = await supabaseClient

      .from('orders')

      .update({

        order_status: status,

        admin_note: adminNote,

        updated_at: new Date().toISOString()

      })

      .eq('id', currentOrder.id);

    if (error) throw error;

    closeOrderModal();

    await loadOrders();

    showMessage(

      'บันทึกสถานะคำสั่งซื้อเรียบร้อยแล้ว'

    );

  } catch (error) {

    console.error('Save order:', error);

    showMessage(

      'บันทึกสถานะไม่สำเร็จ: ' + error.message,

      'error'

    );

  } finally {

    button.disabled = false;

    button.textContent = 'บันทึกสถานะ';

  }

}

// ======================================================

// โหลดคำขอสั่งทำพิเศษ

// ======================================================

async function loadCustomRequests() {

  const { data, error } = await supabaseClient

    .from('custom_order_requests')

    .select('*')

    .order('created_at', {

      ascending: false

    });

  if (error) throw error;

  customRequests = data || [];

  renderCustomRequests();

  updateDashboardStats();

}

// ======================================================

// แสดงคำขอสั่งทำพิเศษ

// ======================================================

function renderCustomRequests() {

  const table = $('customRequestTable');

  if (!customRequests.length) {

    table.innerHTML = `

      <tr>

        <td colspan="6" class="empty-message">

          ยังไม่มีคำขอสั่งทำพิเศษ

        </td>

      </tr>

    `;

    return;

  }

  table.innerHTML = customRequests.map(request => `

    <tr>

      <td>

        ${escapeHTML(request.request_number || '-')}

      </td>

      <td>

        ${escapeHTML(request.customer_name || '-')}

      </td>

      <td>

        ${escapeHTML(request.product_type || '-')}

      </td>

      <td>

        ${Number(request.quantity || 0)}

      </td>

      <td>

        ${escapeHTML(getStatusText(request.status))}

      </td>

      <td>

        <button

          type="button"

          class="btn-small"

          data-action="view-custom"

          data-id="${request.id}"

        >

          รายละเอียด

        </button>

      </td>

    </tr>

  `).join('');

}

// ======================================================

// เปิดดูรายละเอียดคำขอสั่งทำ

// ======================================================

async function viewCustomRequest(id) {

  const request = customRequests.find(item =>

    String(item.id) === String(id)

  );

  if (!request) {

    showMessage('ไม่พบคำขอสั่งทำ', 'error');

    return;

  }

  $('customRequestId').value = request.id;

  $('customQuotedPrice').value =

    request.quoted_price ?? '';

  $('customRequestStatus').value =

    request.status || 'pending';

  $('customAdminNote').value =

    request.admin_note || '';

  $('customRequestDetails').innerHTML = `

    <p>

      <strong>เลขที่คำขอ:</strong>

      ${escapeHTML(request.request_number || '-')}

    </p>

    <p>

      <strong>ชื่อลูกค้า:</strong>

      ${escapeHTML(request.customer_name || '-')}

    </p>

    <p>

      <strong>เบอร์โทร:</strong>

      ${escapeHTML(request.phone || '-')}

    </p>

    <p>

      <strong>อีเมล:</strong>

      ${escapeHTML(request.email || '-')}

    </p>

    <p>

      <strong>ช่องทางติดต่อ:</strong>

      ${escapeHTML(request.contact_channel || '-')}

    </p>

    <p>

      <strong>ประเภทงาน:</strong>

      ${escapeHTML(request.product_type || '-')}

    </p>

    <p>

      <strong>ขนาด:</strong>

      ${escapeHTML(request.dimensions || '-')}

    </p>

    <p>

      <strong>รูปทรง:</strong>

      ${escapeHTML(request.shape || '-')}

    </p>

    <p>

      <strong>ลวดลาย:</strong>

      ${escapeHTML(request.pattern || '-')}

    </p>

    <p>

      <strong>จำนวน:</strong>

      ${Number(request.quantity || 0)}

    </p>

    <p>

      <strong>รายละเอียด:</strong>

      ${escapeHTML(request.description || '-')}

    </p>

    <div id="customReferenceImageArea">

      กำลังโหลดรูปภาพอ้างอิง...

    </div>

  `;

  $('customRequestModal').style.display = 'flex';

  await loadCustomRequestImages(request.id);

}

// ======================================================

// โหลดรูปภาพอ้างอิงจากลูกค้า

// ======================================================

async function loadCustomRequestImages(requestId) {

  const area = $('customReferenceImageArea');

  if (!area) return;

  const { data, error } = await supabaseClient

    .from('custom_request_images')

    .select('*')

    .eq('request_id', requestId);

  if (error) {

    console.error('Custom images:', error);

    area.textContent =

      'โหลดรูปภาพอ้างอิงไม่สำเร็จ';

    return;

  }

  if (!data?.length) {

    area.textContent = 'ไม่มีรูปภาพอ้างอิง';

    return;

  }

  const results = await Promise.all(

    data.map(async image => {

      const { data: signed, error: signedError } =

        await supabaseClient.storage

          .from(CUSTOM_IMAGE_BUCKET)

          .createSignedUrl(image.image_url, 3600);

      if (signedError) {

        console.error(signedError);

        return null;

      }

      return {

        url: signed.signedUrl,

        name: image.file_name

      };

    })

  );

  area.innerHTML = `

    <h3 style="margin:15px 0 8px">

      รูปภาพอ้างอิงจากลูกค้า

    </h3>

    <div style="display:flex;flex-wrap:wrap;gap:12px">

      ${

        results.filter(Boolean).map(image => `

          <div>

            <a

              href="${escapeHTML(image.url)}"

              target="_blank"

              rel="noopener noreferrer"

            >

              <img

                src="${escapeHTML(image.url)}"

                alt="รูปอ้างอิง"

                style="

                  width:120px;

                  height:120px;

                  object-fit:cover;

                  border-radius:8px;

                "

              >

            </a>

            <br>

            <small>

              ${escapeHTML(image.name || '')}

            </small>

          </div>

        `).join('')

      }

    </div>

  `;

}

// ======================================================

// บันทึกคำขอสั่งทำพิเศษ

// ======================================================

async function saveCustomRequest(event) {

  event.preventDefault();

  const id = $('customRequestId').value;

  if (!id) {

    showMessage(

      'ไม่พบข้อมูลคำขอสั่งทำ',

      'error'

    );

    return;

  }

  const priceText =

    $('customQuotedPrice').value.trim();

  const quotedPrice = priceText === ''

    ? null

    : Number(priceText);

  if (

    quotedPrice !== null &&

    (

      !Number.isFinite(quotedPrice) ||

      quotedPrice < 0

    )

  ) {

    showMessage('ราคาที่เสนอไม่ถูกต้อง', 'error');

    return;

  }

  const button = $('saveCustomRequestButton');

  button.disabled = true;

  button.textContent = 'กำลังบันทึก...';

  try {

    const { error } = await supabaseClient

      .from('custom_order_requests')

      .update({

        quoted_price: quotedPrice,

        status: $('customRequestStatus').value,

        admin_note: $('customAdminNote').value.trim(),

        updated_at: new Date().toISOString()

      })

      .eq('id', id);

    if (error) throw error;

    closeCustomRequestModal();

    await loadCustomRequests();

    showMessage(

      'บันทึกคำขอสั่งทำเรียบร้อยแล้ว'

    );

  } catch (error) {

    console.error('Save custom request:', error);

    showMessage(

      'บันทึกคำขอไม่สำเร็จ: ' + error.message,

      'error'

    );

  } finally {

    button.disabled = false;

    button.textContent = 'บันทึกข้อมูล';

  }

}

function closeCustomRequestModal() {

  $('customRequestModal').style.display = 'none';

}

// ======================================================

// อัปเดตตัวเลขบนแดชบอร์ด

// ======================================================

function updateDashboardStats() {

  $('productCount').textContent =

    products.length;

  $('activeProductCount').textContent =

    products.filter(product => product.is_active).length;

  $('orderCount').textContent =

    orders.length;

  $('pendingOrderCount').textContent =

    orders.filter(order =>

      [

        'pending',

        'awaiting_payment',

        'payment_review'

      ].includes(order.order_status)

    ).length;

}

// ======================================================

// ตั้งค่าปุ่มและเหตุการณ์ต่าง ๆ

// ======================================================

function setupEventListeners() {

  // ปุ่มสินค้า

  $('addProductButton').addEventListener(

    'click',

    () => openProductModal()

  );

  $('closeProductButton').addEventListener(

    'click',

    closeProductModal

  );

  $('cancelButton').addEventListener(

    'click',

    closeProductModal

  );

  $('productForm').addEventListener(

    'submit',

    saveProduct

  );

  // ออกจากระบบ

  $('logoutButton').addEventListener(

    'click',

    logoutAdmin

  );

  // ตัวอย่างรูปภาพก่อนบันทึก

  $('productImage').addEventListener(

    'change',

    event => {

      const file = event.target.files?.[0];

      if (!file) return;

      const preview = $('imagePreview');

      preview.src = URL.createObjectURL(file);

      preview.style.display = 'block';

    }

  );

  // ปิดหน้าต่างคำขอสั่งทำ

  $('closeCustomRequestButton').addEventListener(

    'click',

    closeCustomRequestModal

  );

  $('closeCustomRequestButton2').addEventListener(

    'click',

    closeCustomRequestModal

  );

  $('customRequestForm').addEventListener(

    'submit',

    saveCustomRequest

  );

  // กรองหมวดหมู่สินค้า

  $('categoryFilter').addEventListener(

    'click',

    event => {

      const button = event.target.closest(

        'button[data-category]'

      );

      if (button) {

        filterProducts(button.dataset.category);

      }

    }

  );

  // ปุ่มในตารางสินค้า

  $('productTable').addEventListener(

    'click',

    event => {

      const button = event.target.closest(

        'button[data-action]'

      );

      if (!button) return;

      const { action, id } = button.dataset;

      if (action === 'edit-product') {

        const product = products.find(item =>

          String(item.id) === String(id)

        );

        if (product) {

          openProductModal(product);

        }

      } else if (action === 'toggle-product') {

        toggleProduct(id);

      } else if (action === 'delete-product') {

        deleteProduct(id);

      }

    }

  );

  // ปุ่มดูรายละเอียดคำสั่งซื้อ

  $('orderTable').addEventListener(

    'click',

    event => {

      const button = event.target.closest(

        'button[data-action="view-order"]'

      );

      if (button) {

        viewOrder(button.dataset.id);

      }

    }

  );

  // ปุ่มดูรายละเอียดคำขอสั่งทำ

  $('customRequestTable').addEventListener(

    'click',

    event => {

      const button = event.target.closest(

        'button[data-action="view-custom"]'

      );

      if (button) {

        viewCustomRequest(button.dataset.id);

      }

    }

  );

}

// ======================================================

// เริ่มต้นระบบแดชบอร์ด

// ======================================================

async function initializeDashboard() {

  const allowed = await checkAdmin();

  if (!allowed) return;

  createOrderModal();

  setupEventListeners();

  try {

    await loadCategories();

    const results = await Promise.allSettled([

      loadProducts(),

      loadOrders(),

      loadCustomRequests()

    ]);

    results.forEach((result, index) => {

      if (result.status === 'rejected') {

        console.error(

          'Dashboard data load failed:',

          index,

          result.reason

        );

      }

    });

  } catch (error) {

    console.error(

      'Dashboard initialization:',

      error

    );

    showMessage(

      'โหลดข้อมูลแดชบอร์ดไม่สำเร็จ: ' +

      error.message,

      'error'

    );

  }

}

// ======================================================

// เรียกใช้งานเมื่อหน้าเว็บโหลดเสร็จ

// ======================================================

document.addEventListener(

  'DOMContentLoaded',

  initializeDashboard

);
