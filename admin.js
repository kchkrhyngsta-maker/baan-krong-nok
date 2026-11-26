const SUPABASE_URL = 'https://acfrebknwxuybroilgqu.supabase.co';

const SUPABASE_KEY = 'sb_publishable_UjWZN8YsBLoBTKsbQ3GZsw_A1X3lSPK';

const supabaseClient = window.supabase.createClient(
SUPABASE_URL,
SUPABASE_KEY
);

const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const message = document.getElementById('message');

loginForm.addEventListener('submit', async function(event) {
event.preventDefault();

const email = document.getElementById('email').value.trim();
const password = document.getElementById('password').value;

loginButton.disabled = true;
loginButton.textContent = 'กำลังตรวจสอบ...';
message.textContent = '';

try {
// ตรวจสอบบัญชีผู้ใช้งาน
const { data, error } =
await supabaseClient.auth.signInWithPassword({
email: email,
password: password
});

if (error) {
  throw error;
}

// ตรวจสอบสิทธิ์ผู้ดูแลระบบ
const { data: isAdmin, error: adminError } =
  await supabaseClient.rpc('is_admin');

if (adminError) {
  throw adminError;
}

if (isAdmin !== true) {
  await supabaseClient.auth.signOut();
  throw new Error('บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ');
}

message.style.color = '#28613B';
message.textContent = 'เข้าสู่ระบบสำเร็จ กำลังไปยังหน้าจัดการร้านค้า...';

// ไปยังหน้าจัดการร้านค้า
setTimeout(function() {
  window.location.href = 'admin.html';
}, 1200);

} catch (error) {
message.style.color = '#C0392B';
message.textContent = error.message || 'เข้าสู่ระบบไม่สำเร็จ';

loginButton.disabled = false;
loginButton.textContent = 'เข้าสู่ระบบ';

}
});
