const SUPABASE_URL = 'https://acfrebknwxuybroilgqu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_UjWZN8YsBLoBTKsbQ3GZsw_A1X3lSPK';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const forgotButton = document.getElementById('forgotButton');
const message = document.getElementById('message');

// เข้าสู่ระบบ
loginForm.addEventListener('submit', async function(event) {
  event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  loginButton.disabled = true;
  loginButton.textContent = 'กำลังตรวจสอบ...';
  message.textContent = '';

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
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

    setTimeout(() => {
      window.location.href = 'admin.html';
    }, 1200);

  } catch (error) {
    message.style.color = '#C0392B';
    message.textContent = error.message || 'เข้าสู่ระบบไม่สำเร็จ';

    loginButton.disabled = false;
    loginButton.textContent = 'เข้าสู่ระบบ';
  }
});

// ลืมรหัสผ่าน
forgotButton.addEventListener('click', async function() {
  message.style.color = '#39764A';
  message.textContent = 'กำลังกดปุ่มลืมรหัสผ่าน...';
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
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://kchkrhyngsta-maker.github.io/baan-krong-nok/update-password.html'
    });

    if (error) throw error;

    message.style.color = '#28613B';
    message.textContent = 'ส่งลิงก์เปลี่ยนรหัสผ่านแล้ว กรุณาตรวจสอบอีเมล';

  } catch (error) {
    message.style.color = '#C0392B';
    message.textContent = 'ส่งอีเมลไม่สำเร็จ: ' + error.message;

  } finally {
    forgotButton.disabled = false;
    forgotButton.textContent = 'ลืมรหัสผ่าน?';
  }
});
