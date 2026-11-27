const SUPABASE_URL = ‘https://acfrebknwxuybroilgqu.supabase.co’;
const SUPABASE_KEY = ‘sb_publishable_UjWZN8YsBLoBTKsbQ3GZsw_A1X3lSPK’;

const supabaseClient = window.supabase.createClient(
SUPABASE_URL,
SUPABASE_KEY
);

const messageBox = document.getElementById(‘pageMessage’);

let productList = [];
let categoryList = [];

function showMessage(message) {
messageBox.style.display = ‘block’;
messageBox.textContent = message;
window.scrollTo({top: 0, behavior: ‘smooth’});
}

function escapeHTML(value) {
return String(value ?? ‘’).replace(/[&<>”’]/g, character => ({
‘&’: ‘&’,
‘<’: ‘<’,
‘>’: ‘>’,
‘”’: ‘"’,
“’”: ‘'’
})[character]);
}

function formatPrice(price) {
return Number(price || 0).toLocaleString(‘th-TH’);
}

// ตรวจสอบสิทธิ์แอดมิน
async function checkAdmin() {
const {data, error} = await supabaseClient.auth.getSession();

if (error || !data.session) {
window.location.href = ‘admin-login.html’;
return false;
}

const {data: isAdmin, error: adminError} =
await supabaseClient.rpc(‘is_admin’);

if (adminError || isAdmin !== true) {
await supabaseClient.auth.signOut();
window.location.href = ‘admin-login.html’;
return false;
}

return true;
}

// โหลดหมวดหมู่
async function loadCategories() {
const {data, error} = await supabaseClient
.from(‘categories’)
.select(‘id,name,slug,is_active’)
.eq(‘is_active’, true)
.order(‘sort_order’);

if (error) throw error;

categoryList = data || [];

const select = document.getElementById(‘productCategory’);

select.innerHTML = ‘เลือกหมวดหมู่สินค้า’ +
categoryList.map(category => <option value="${escapeHTML(category.id)}"> ${escapeHTML(category.name)} </option>).join(’’);
}

// โหลดสินค้า
async function loadProducts() {
const {data, error} = await supabaseClient
.from(‘products’)
.select(id, name, category, category_id, description, price, image_url, stock, is_active, fulfillment_type, production_days)
.order(‘id’, {ascending: false});

if (error) throw error;

productList = data || [];

document.getElementById(‘productCount’).textContent =
productList.length;

document.getElementById(‘activeProductCount’).textContent =
productList.filter(p => p.is_active).length;

const table = document.getElementById(‘productTable’);

if (!productList.length) {
table.innerHTML = ‘ยังไม่มีสินค้า’;
return;
}

table.innerHTML = productList.map(product => <tr> <td> ${product.image_url ?`
: ‘ไม่มีรูป’}
  <td>${escapeHTML(product.name)}</td>
  <td>${formatPrice(product.price)} บาท</td>
  <td>${Number(product.stock || 0)}</td>
  <td>
    ${product.fulfillment_type === 'preorder'
      ? 'พรีออเดอร์'
      : 'พร้อมส่ง'}
  </td>
  <td class="status">
    ${product.is_active ? 'เปิดขาย' : 'ปิดขาย'}
  </td>
  <td>
    <button class="action-btn edit-btn"
      data-action="edit"
      data-id="${escapeHTML(product.id)}">
      แก้ไข
    </button>
    <button class="action-btn delete-btn"
      data-action="delete"
      data-id="${escapeHTML(product.id)}">
      ปิดขาย
    </button>
  </td>
</tr>

`).join(’’);
}

// โหลดคำสั่งซื้อ
async function loadOrders() {
const {data, error} = await supabaseClient
.from(‘orders’)
.select(‘id,order_number,customer_name,phone,total_amount,order_status’)
.order(‘created_at’, {ascending: false});

if (error) throw error;

const orders = data || [];

document.getElementById(‘orderCount’).textContent = orders.length;

document.getElementById(‘pendingOrderCount’).textContent =
orders.filter(o => o.order_status === ‘pending_confirmation’).length;

document.getElementById(‘orderTable’).innerHTML = orders.length
? orders.map(order => <tr> <td>${escapeHTML(order.order_number)}</td> <td>${escapeHTML(order.customer_name)}</td> <td>${escapeHTML(order.phone)}</td> <td>${formatPrice(order.total_amount)} บาท</td> <td>${escapeHTML(order.order_status)}</td> </tr>).join(’’)
: ‘ยังไม่มีคำสั่งซื้อ’;
}

// เปิดหน้าต่างสินค้า
function openProductModal(product = null) {
document.getElementById(‘productForm’).reset();

document.getElementById(‘productId’).value = ‘’;
document.getElementById(‘imagePreview’).style.display = ‘none’;

document.getElementById(‘modalTitle’).textContent =
product ? ‘แก้ไขสินค้า’ : ‘เพิ่มสินค้าใหม่’;

if (product) {
document.getElementById(‘productId’).value = product.id;
document.getElementById(‘productName’).value = product.name || ‘’;

document.getElementById('productCategory').value =
  product.category_id || '';
document.getElementById('productDescription').value =
  product.description || '';
document.getElementById('productPrice').value =
  product.price ?? 0;
document.getElementById('productStock').value =
  product.stock ?? 0;
document.getElementById('fulfillmentType').value =
  product.fulfillment_type || 'ready_to_ship';
document.getElementById('productionDays').value =
  product.production_days || '';
document.getElementById('productActive').value =
  String(product.is_active);
if (product.image_url) {
  const preview = document.getElementById('imagePreview');
  preview.src = product.image_url;
  preview.style.display = 'block';
}

}

updateProductionField();

document.getElementById(‘productModal’).style.display = ‘block’;
}

// ปิดหน้าต่าง
function closeProductModal() {
document.getElementById(‘productModal’).style.display = ‘none’;
}

// แสดงช่องระยะเวลาผลิต
function updateProductionField() {
const type = document.getElementById(‘fulfillmentType’).value;

document.getElementById(‘productionDaysGroup’).style.display =
type === ‘preorder’ ? ‘block’ : ‘none’;
}

// อัปโหลดรูปภาพ
async function uploadProductImage(file) {
const extension = file.name.split(’.’).pop().toLowerCase();
const fileName =
${crypto.randomUUID()}.${extension};

const filePath = products/${fileName};

const {error} = await supabaseClient.storage
.from(‘product-images’)
.upload(filePath, file, {
cacheControl: ‘3600’,
upsert: false
});

if (error) throw error;

const {data} = supabaseClient.storage
.from(‘product-images’)
.getPublicUrl(filePath);

return data.publicUrl;
}

// บันทึกสินค้า
async function saveProduct(event) {
event.preventDefault();

const button = document.getElementById(‘saveProductButton’);

button.disabled = true;
button.textContent = ‘กำลังบันทึก…’;

try {
const id = document.getElementById(‘productId’).value;
const categoryId = document.getElementById(‘productCategory’).value;

const category = categoryList.find(
  item => String(item.id) === String(categoryId)
);
if (!category) {
  throw new Error('กรุณาเลือกหมวดหมู่สินค้า');
}
const fulfillment =
  document.getElementById('fulfillmentType').value;
const productionDays =
  document.getElementById('productionDays').value;
if (fulfillment === 'preorder' &&
    (!productionDays || Number(productionDays) < 1)) {
  throw new Error('กรุณาระบุระยะเวลาผลิตสินค้า');
}
const price = Number(document.getElementById('productPrice').value);
const stock = Number(document.getElementById('productStock').value);
if (!Number.isFinite(price) || price < 0 ||
    !Number.isInteger(stock) || stock < 0) {
  throw new Error('กรุณาตรวจสอบราคาและจำนวนสต็อก');
}
let imageUrl = id
  ? productList.find(p => String(p.id) === String(id))?.image_url || null
  : null;
const imageFile = document.getElementById('productImage').files[0];
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
  name: document.getElementById('productName').value.trim(),
  category_id: category.id,
  category: category.name,
  description: document.getElementById('productDescription').value.trim(),
  price,
  stock,
  image_url: imageUrl,
  fulfillment_type: fulfillment,
  production_days: fulfillment === 'preorder'
    ? Number(productionDays)
    : null,
  is_active:
    document.getElementById('productActive').value === 'true'
};
if (id) {
  const {error} = await supabaseClient
    .from('products')
    .update(productData)
    .eq('id', id);
  if (error) throw error;
  showMessage('แก้ไขสินค้าเรียบร้อยแล้ว');
} else {
  const {error} = await supabaseClient
    .from('products')
    .insert([productData]);
  if (error) throw error;
  showMessage('เพิ่มสินค้าเรียบร้อยแล้ว');
}
closeProductModal();
await loadProducts();

} catch (error) {
showMessage(’บันทึกไม่สำเร็จ: ’ + error.message);
} finally {
button.disabled = false;
button.textContent = ‘บันทึกสินค้า’;
}
}

// จัดการปุ่มแก้ไขและปิดขาย
async function handleProductAction(event) {
const button = event.target.closest(‘button[data-action]’);

if (!button) return;

const id = button.dataset.id;

const product = productList.find(
p => String(p.id) === String(id)
);

if (!product) return;

if (button.dataset.action === ‘edit’) {
openProductModal(product);
return;
}

if (button.dataset.action === ‘delete’) {
if (!confirm(ต้องการปิดการขาย "${product.name}" หรือไม่?)) {
return;
}

const {error} = await supabaseClient
  .from('products')
  .update({is_active: false})
  .eq('id', id);
if (error) {
  showMessage('ปิดการขายไม่สำเร็จ: ' + error.message);
  return;
}
showMessage('ปิดการขายสินค้าเรียบร้อยแล้ว');
await loadProducts();

}
}

// ออกจากระบบ
document.getElementById(‘logoutButton’)
.addEventListener(‘click’, async () => {
const {error} = await supabaseClient.auth.signOut();

if (error) {
  showMessage(error.message);
  return;
}
window.location.href = 'admin-login.html';

});

// ปุ่มเพิ่มสินค้า
document.getElementById(‘addProductButton’)
.addEventListener(‘click’, () => openProductModal());

// ปุ่มยกเลิก
document.getElementById(‘cancelButton’)
.addEventListener(‘click’, closeProductModal);

// บันทึกฟอร์ม
document.getElementById(‘productForm’)
.addEventListener(‘submit’, saveProduct);

// เลือกประเภทสินค้า
document.getElementById(‘fulfillmentType’)
.addEventListener(‘change’, updateProductionField);

// แสดงตัวอย่างรูป
document.getElementById(‘productImage’)
.addEventListener(‘change’, event => {
const file = event.target.files[0];
if (!file) return;

const preview = document.getElementById('imagePreview');
preview.src = URL.createObjectURL(file);
preview.style.display = 'block';

});

// ปุ่มจัดการสินค้า
document.getElementById(‘productTable’)
.addEventListener(‘click’, handleProductAction);

// เริ่มระบบ
async function startDashboard() {
try {
const allowed = await checkAdmin();

if (!allowed) return;
await loadCategories();
await loadProducts();
await loadOrders();

} catch (error) {
showMessage(’ไม่สามารถโหลดข้อมูลได้: ’ + error.message);
}
}

startDashboard();
