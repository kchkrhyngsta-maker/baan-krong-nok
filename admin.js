const SUPABASE_URL = 'https://acfrebknwxuybroilgqu.supabase.co';

const SUPABASE_KEY = 'sb_publishable_UjWZN8YsBLoBTKsbQ3GZsw_A1X3lSPK';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const message = document.getElementById('message');

// เพิ่มปุ่มลืมรหัสผ่าน
const forgotButton = document.createElement('button');

forgotButton.type = 'button';
forgotButton.textContent = 'ลืมรหัสผ่าน?';
forgotButton.style.cssText = `
  display: block;
  width: 100%;
  margin-top: 15px;
  padding: 10px;
  background: transparent;
  color: #39764A;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 15px;
`;

loginForm.insertAdjacentElement('afterend', forgotButton);

// ระบบเข้าสู่ระบบเดิม
loginForm.addEventListener('submit', async function(event) {
  event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  loginButton.disabled = true;
  loginButton.textContent = 'กำลังตรวจสอบ...';
  message.textContent = '';

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) throw error;

    const { data: isAdmin, error: adminError } =
      await supabaseClient.rpc('is_admin');

    if (adminError) throw adminError;

    if (isAdmin !== true) {
      await supabaseClient.auth.signOut();
      throw new Error('บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ');
    }

    message.style.color = '#28613B';
    message.textContent = 'เข้าสู่ระบบสำเร็จ กำลังไปยังหน้าจัดการร้านค้า...';

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

// ระบบลืมรหัสผ่าน
forgotButton.addEventListener('click', async function() {

  const email = document.getElementById('email').value.trim();

  if (!email) {
    message.style.color = '#C0392B';
    message.textContent = 'กรุณากรอกอีเมลก่อนกดลืมรหัสผ่าน';
    document.getElementById('email').focus();
    return;
  }

  forgotButton.disabled = true;
  forgotButton.textContent = 'กำลังส่งอีเมล...';

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: 'https://kchkrhyngsta-maker.github.io/baan-krong-nok/update-password.html'
      }
    );

    if (error) throw error;

    message.style.color = '#28613B';
    message.textContent =
      'ส่งลิงก์เปลี่ยนรหัสผ่านแล้ว กรุณาตรวจสอบอีเมลของคุณ';

  } catch (error) {
    message.style.color = '#C0392B';
    message.textContent = error.message || 'ส่งอีเมลไม่สำเร็จ';

  } finally {
    forgotButton.disabled = false;
    forgotButton.textContent = 'ลืมรหัสผ่าน?';
  }
});
