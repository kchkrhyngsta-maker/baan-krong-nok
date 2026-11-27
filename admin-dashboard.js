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
      order_status
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

  // เพิ่มสินค้า
  getElement('addProductButton')
    .addEventListener('click', () => {

      openProductModal();

    });

  // ยกเลิก
  getElement('cancelButton')
    .addEventListener('click', closeProductModal);

  // บันทึกสินค้า
  getElement('productForm')
    .addEventListener('submit', saveProduct);

  // เลือกพร้อมส่ง / พรีออเดอร์
  getElement('fulfillmentType')
    .addEventListener('change', updateProductionField);

  // แสดงตัวอย่างรูปภาพ
  getElement('productImage')
    .addEventListener('change', previewProductImage);

  // จัดการสินค้า
  getElement('productTable')
    .addEventListener('click', handleProductAction);

  // คลิกพื้นที่ด้านนอกเพื่อปิดหน้าต่าง
  getElement('productModal')
    .addEventListener('click', event => {

      if (event.target.id === 'productModal') {
        closeProductModal();
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

  } catch (error) {

    showMessage(
      'ไม่สามารถโหลดข้อมูลได้: ' + error.message
    );

  }

}

startDashboard();
