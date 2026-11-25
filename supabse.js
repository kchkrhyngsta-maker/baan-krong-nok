
// ข้อมูลเชื่อมต่อ Supabase
const SUPABASE_URL = "https://acfrebknwxuybroilgqu.supabase.co/rest/v1/";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_UjWZN8YsBLoBTKsbQ3GZsw_A1X3lSPK_";

// สร้างการเชื่อมต่อ
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

console.log("เชื่อมต่อ Supabase พร้อมใช้งาน");
