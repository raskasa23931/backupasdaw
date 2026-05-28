const { sendMessage, sendDocument, getFile, answerCallback, setWebhook } = require('../lib/telegram');
const { getSession, upsertSession, getLicenseKeys, createLicenseKey, updateLicenseKey, deleteLicenseKey, listLicenseKeys } = require('../lib/db');
const { checkVcpuQuotaHTML, checkAIServicesHTML, createEC2Instance, batchCheck } = require('../lib/aws');
const { linodeListRegions, linodeListTypes, linodeListImages, linodeCreate, doListDroplets, doListRegions, doListSizes, doCreateDroplet } = require('../lib/cloud');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ========== Keyboards ==========
function platformKeyboard(platforms) {
  const buttons = [];
  if (platforms.includes('aws')) buttons.push([{ text: '☁️ AWS', callback_data: 'platform_aws' }]);
  if (platforms.includes('linode')) buttons.push([{ text: '🟢 Linode', callback_data: 'platform_linode' }]);
  if (platforms.includes('digitalocean')) buttons.push([{ text: '🔵 DigitalOcean', callback_data: 'platform_do' }]);
  return { inline_keyboard: buttons };
}
const AWS_MENU = { inline_keyboard: [[{ text: '📊 Check vCPU Limit', callback_data: 'aws_vcpu' }],[{ text: '🤖 Check AI Services (Bedrock/Claude)', callback_data: 'aws_ai' }],[{ text: '🚀 Auto Create EC2 Instance', callback_data: 'aws_create' }],[{ text: '📦 Batch Check (Upload .txt)', callback_data: 'aws_batch' }],[{ text: '🔙 Ganti Platform', callback_data: 'back_platform' }]] };
const LINODE_MENU = { inline_keyboard: [[{ text: '🚀 Create Linode Instance', callback_data: 'linode_create_start' }],[{ text: '🔙 Ganti Platform', callback_data: 'back_platform' }]] };
const DO_MENU = { inline_keyboard: [[{ text: '🔍 Check Droplets', callback_data: 'do_list' }],[{ text: '🚀 Create Droplet', callback_data: 'do_create_start' }],[{ text: '🔙 Ganti Platform', callback_data: 'back_platform' }]] };
const AWS_REGION_KB = { inline_keyboard: [[{ text: 'us-east-1 (N. Virginia)', callback_data: 'region_us-east-1' },{ text: 'us-west-2 (Oregon)', callback_data: 'region_us-west-2' }],[{ text: 'ap-southeast-1 (Singapore)', callback_data: 'region_ap-southeast-1' },{ text: 'ap-northeast-1 (Tokyo)', callback_data: 'region_ap-northeast-1' }],[{ text: 'eu-west-1 (Ireland)', callback_data: 'region_eu-west-1' },{ text: 'eu-central-1 (Frankfurt)', callback_data: 'region_eu-central-1' }],[{ text: 'ap-southeast-3 (Jakarta)', callback_data: 'region_ap-southeast-3' },{ text: 'ap-south-1 (Mumbai)', callback_data: 'region_ap-south-1' }],[{ text: '🌍 All Regions', callback_data: 'region_all' }],[{ text: '🔙 Menu AWS', callback_data: 'back_aws' }]] };
const BATCH_REGION_KB = { inline_keyboard: [[{ text: 'us-east-1 (N. Virginia)', callback_data: 'batchregion_us-east-1' },{ text: 'us-west-2 (Oregon)', callback_data: 'batchregion_us-west-2' }],[{ text: 'ap-southeast-1 (Singapore)', callback_data: 'batchregion_ap-southeast-1' },{ text: 'ap-northeast-1 (Tokyo)', callback_data: 'batchregion_ap-northeast-1' }],[{ text: 'eu-west-1 (Ireland)', callback_data: 'batchregion_eu-west-1' },{ text: 'eu-central-1 (Frankfurt)', callback_data: 'batchregion_eu-central-1' }],[{ text: 'ap-southeast-3 (Jakarta)', callback_data: 'batchregion_ap-southeast-3' },{ text: 'ap-south-1 (Mumbai)', callback_data: 'batchregion_ap-south-1' }],[{ text: '🌍 All Regions', callback_data: 'batchregion_all' }],[{ text: '🔙 Menu AWS', callback_data: 'back_aws' }]] };
const EC2_TYPE_KB = { inline_keyboard: [[{ text: 't3.micro', callback_data: 'ec2type_t3.micro' },{ text: 't3.small', callback_data: 'ec2type_t3.small' }],[{ text: 't3.medium', callback_data: 'ec2type_t3.medium' },{ text: 't3.large', callback_data: 'ec2type_t3.large' }],[{ text: 'm5.xlarge', callback_data: 'ec2type_m5.xlarge' },{ text: 'c5.xlarge', callback_data: 'ec2type_c5.xlarge' }],[{ text: '🔙 Menu AWS', callback_data: 'back_aws' }]] };
const BATCH_TYPE_KB = { inline_keyboard: [[{ text: '📊 Batch Check vCPU', callback_data: 'batch_vcpu' }],[{ text: '🤖 Batch Check AI Services', callback_data: 'batch_ai' }],[{ text: '🔙 Menu AWS', callback_data: 'back_aws' }]] };
const ADMIN_MENU = { inline_keyboard: [[{ text: '➕ Generate License Key', callback_data: 'adm_gen_start' }],[{ text: '📋 List Semua Keys', callback_data: 'adm_list' }],[{ text: '🔍 Cari Key / User', callback_data: 'adm_search_start' }],[{ text: '❌ Logout Admin', callback_data: 'adm_logout' }]] };
const ADMIN_PLATFORM_KB = { inline_keyboard: [[{ text: '☁️ AWS', callback_data: 'admplat_aws' },{ text: '🟢 Linode', callback_data: 'admplat_linode' }],[{ text: '🔵 DigitalOcean', callback_data: 'admplat_digitalocean' }],[{ text: '🌐 Semua Platform', callback_data: 'admplat_all' }],[{ text: '🔙 Menu Admin', callback_data: 'adm_back' }]] };
const ADMIN_EXPIRY_KB = { inline_keyboard: [[{ text: '7 hari', callback_data: 'admexp_7' },{ text: '30 hari', callback_data: 'admexp_30' }],[{ text: '90 hari', callback_data: 'admexp_90' },{ text: '365 hari', callback_data: 'admexp_365' }],[{ text: '♾️ Tidak Expired', callback_data: 'admexp_never' }],[{ text: '🔙 Menu Admin', callback_data: 'adm_back' }]] };

// ========== Helpers ==========
function genKey(prefix) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const seg = () => Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
  return `${(prefix||'LUNA').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8)}-${seg()}-${seg()}-${seg()}`;
}
function td(session) { try { return JSON.parse(session?.temp_data || '{}'); } catch { return {}; } }

async function validateLicense(key, uid) {
  const keys = await getLicenseKeys({ key });
  if (!keys.length) return { valid: false, message: '❌ License key tidak ditemukan.', platforms: '' };
  const k = keys[0];
  if (!k.is_active) return { valid: false, message: '❌ License key sudah tidak aktif.', platforms: '' };
  if (k.expires_at && new Date(k.expires_at) < new Date()) return { valid: false, message: '❌ License key sudah expired.', platforms: '' };
  if (!k.telegram_user_id) {
    await updateLicenseKey(k.id, { telegram_user_id: uid, used_at: new Date().toISOString() });
  } else if (k.telegram_user_id !== uid) {
    return { valid: false, message: '❌ License key ini sudah dipakai akun lain.', platforms: '' };
  }
  return { valid: true, platforms: k.platform_access || 'aws' };
}

async function sendAdminMenu(chatId) {
  await sendMessage(chatId, `🔐 <b>Admin Panel</b>\n\nSelamat datang, Admin!`, ADMIN_MENU);
}

async function sendAdminKeyList(chatId) {
  const keys = await listLicenseKeys();
  if (!keys.length) { await sendMessage(chatId, `📋 Belum ada license key.`); await sendAdminMenu(chatId); return; }
  const total = keys.length, active = keys.filter(k => k.is_active).length, used = keys.filter(k => k.telegram_user_id).length;
  let text = `📋 <b>License Keys (${total} total | ${active} aktif | ${used} dipakai)</b>\n\n`;
  for (const k of keys) {
    const exp = k.expires_at ? new Date(k.expires_at).toLocaleDateString('id-ID') : 'No expiry';
    text += `${k.is_active ? '🟢' : '🔴'} <code>${k.key}</code>\n   📛 ${k.user_label||'-'} | 🌐 ${k.platform_access||'aws'} | ⏰ ${exp}\n   👤 ${k.telegram_user_id||'-'}\n   /toggle_${k._id.toString().slice(0,8)} /del_${k._id.toString().slice(0,8)} /unbind_${k._id.toString().slice(0,8)}\n\n`;
  }
  if (text.length > 3500) {
    const plain = keys.map(k => `[${k.is_active?'ACTIVE':'INACTIVE'}] ${k.key} | ${k.user_label||'-'} | ${k.platform_access||'aws'} | TG:${k.telegram_user_id||'-'} | Exp:${k.expires_at?new Date(k.expires_at).toLocaleDateString('id-ID'):'No expiry'}`).join('\n');
    await sendDocument(chatId, plain, `license_keys_${Date.now()}.txt`, `📋 Total: ${total} keys`);
  } else {
    await sendMessage(chatId, text);
  }
  await sendMessage(chatId, `Menu Admin:`, ADMIN_MENU);
}

// ========== Message Handler ==========
async function handleMessage(msg) {
  const chatId = msg.chat?.id;
  const uid = String(msg.from?.id || chatId);
  const text = msg.text || '';
  const document = msg.document;

  if (text === '/start') {
    await upsertSession(uid, { state: 'awaiting_license', aws_access_key: '', aws_secret_key: '', aws_region: '', license_key: '', pending_action: '', temp_data: '' });
    await sendMessage(chatId, `🔐 <b>Selamat datang di Cloud Checker Bot!</b>\n\n☁️ <b>AWS</b> — vCPU Quota, AI Services, EC2, Batch Check\n🟢 <b>Linode</b> — Create Instance\n🔵 <b>DigitalOcean</b> — Check & Create Droplet\n\nSilakan masukkan <b>License Key</b> kamu:\n\n<i>Admin? Ketik /admin</i>`);
    return;
  }
  if (text === '/admin') {
    await upsertSession(uid, { state: 'admin_awaiting_password', temp_data: '' });
    await sendMessage(chatId, `🔐 Masukkan <b>password admin</b>:`);
    return;
  }

  const session = await getSession(uid);
  const state = session?.state || 'awaiting_license';
  const tmp = td(session);

  // ===== ADMIN STATES =====
  if (state === 'admin_awaiting_password') {
    if (text.trim() === ADMIN_PASSWORD) { await upsertSession(uid, { state: 'admin_menu', temp_data: '' }); await sendAdminMenu(chatId); }
    else await sendMessage(chatId, `❌ Password salah. Coba lagi:`);
    return;
  }
  if (state === 'admin_gen_label') {
    tmp.gen_label = text.trim();
    await upsertSession(uid, { state: 'admin_gen_platform', temp_data: JSON.stringify(tmp) });
    await sendMessage(chatId, `✅ Label: <b>${tmp.gen_label}</b>\n\nPilih platform akses:`, ADMIN_PLATFORM_KB);
    return;
  }
  if (state === 'admin_gen_prefix') {
    tmp.gen_prefix = text.trim() === '-' ? 'LUNA' : text.trim();
    await upsertSession(uid, { state: 'admin_gen_expiry', temp_data: JSON.stringify(tmp) });
    await sendMessage(chatId, `✅ Prefix: <b>${tmp.gen_prefix}</b>\n\nPilih masa berlaku:`, ADMIN_EXPIRY_KB);
    return;
  }
  if (state === 'admin_search') {
    const query = text.trim().toLowerCase();
    const keys = await listLicenseKeys();
    const results = keys.filter(k => k.key?.toLowerCase().includes(query) || k.user_label?.toLowerCase().includes(query) || k.telegram_user_id?.toLowerCase().includes(query));
    if (!results.length) { await sendMessage(chatId, `🔍 Tidak ditemukan: <b>${text.trim()}</b>`); }
    else {
      let out = `🔍 <b>Hasil (${results.length}):</b>\n\n`;
      for (const k of results) {
        const exp = k.expires_at ? new Date(k.expires_at).toLocaleDateString('id-ID') : 'No expiry';
        out += `${k.is_active?'🟢':'🔴'} <code>${k.key}</code>\n   📛 ${k.user_label||'-'} | 🌐 ${k.platform_access||'aws'} | ⏰ ${exp}\n   👤 ${k.telegram_user_id||'-'}\n   /toggle_${k._id.toString().slice(0,8)} /del_${k._id.toString().slice(0,8)} /unbind_${k._id.toString().slice(0,8)}\n\n`;
      }
      await sendMessage(chatId, out);
    }
    await upsertSession(uid, { state: 'admin_menu' });
    await sendMessage(chatId, `Menu Admin:`, ADMIN_MENU);
    return;
  }
  if (state === 'admin_menu' || state?.startsWith('admin')) {
    const toggleMatch = text.match(/^\/toggle_([a-f0-9]{8})$/i);
    if (toggleMatch) {
      const keys = await listLicenseKeys();
      const key = keys.find(k => k._id.toString().startsWith(toggleMatch[1]));
      if (!key) { await sendMessage(chatId, `❌ Key tidak ditemukan.`); return; }
      await updateLicenseKey(key._id.toString(), { is_active: !key.is_active });
      await sendMessage(chatId, `${!key.is_active?'✅ Key diaktifkan':'🔴 Key dinonaktifkan'}: <code>${key.key}</code>`);
      return;
    }
    const delMatch = text.match(/^\/del_([a-f0-9]{8})$/i);
    if (delMatch) {
      const keys = await listLicenseKeys();
      const key = keys.find(k => k._id.toString().startsWith(delMatch[1]));
      if (!key) { await sendMessage(chatId, `❌ Key tidak ditemukan.`); return; }
      await deleteLicenseKey(key._id.toString());
      await sendMessage(chatId, `🗑️ Key dihapus: <code>${key.key}</code>`);
      return;
    }
    const unbindMatch = text.match(/^\/unbind_([a-f0-9]{8})$/i);
    if (unbindMatch) {
      const keys = await listLicenseKeys();
      const key = keys.find(k => k._id.toString().startsWith(unbindMatch[1]));
      if (!key) { await sendMessage(chatId, `❌ Key tidak ditemukan.`); return; }
      await updateLicenseKey(key._id.toString(), { telegram_user_id: '', used_at: '' });
      await sendMessage(chatId, `🔓 Key di-unbind: <code>${key.key}</code>`);
      return;
    }
    await sendAdminMenu(chatId);
    return;
  }

  // ===== USER STATES =====
  if (state === 'awaiting_license') {
    const v = await validateLicense(text.trim(), uid);
    if (!v.valid) { await sendMessage(chatId, v.message + '\n\nCoba masukkan license key lagi:'); return; }
    await upsertSession(uid, { state: 'platform_select', license_key: text.trim(), temp_data: JSON.stringify({ platforms: v.platforms }) });
    const count = [v.platforms.includes('aws'), v.platforms.includes('linode'), v.platforms.includes('digitalocean')].filter(Boolean).length;
    await sendMessage(chatId, `✅ <b>License Valid!</b> 🎉\n\nAkses ke <b>${count} platform</b>. Pilih:`, platformKeyboard(v.platforms));
    return;
  }
  if (state === 'awaiting_aws_keys') {
    const lines = text.trim().split('\n').map(l => l.trim());
    if (lines.length < 2) { await sendMessage(chatId, `⚠️ Format:\n\n<code>ACCESS_KEY_ID\nSECRET_ACCESS_KEY</code>`); return; }
    await upsertSession(uid, { state: 'awaiting_region', aws_access_key: lines[0], aws_secret_key: lines[1] });
    await sendMessage(chatId, `✅ Credentials disimpan! Pilih region:`, AWS_REGION_KB);
    return;
  }
  if (state === 'awaiting_ec2_ami') {
    await sendMessage(chatId, `⏳ Membuat EC2 instance...`);
    const result = await createEC2Instance(session?.aws_access_key, session?.aws_secret_key, session?.aws_region, tmp.instance_type||'t3.micro', text.trim());
    await sendMessage(chatId, result);
    await upsertSession(uid, { state: 'aws_menu', temp_data: '' });
    await sendMessage(chatId, `Menu AWS:`, AWS_MENU);
    return;
  }
  if (state === 'awaiting_batch_file') {
    if (!document) { await sendMessage(chatId, `📎 Kirim file <b>.txt</b>\n\nFormat: <code>ACCESS_KEY:SECRET_KEY</code>`); return; }
    const fileUrl = await getFile(document.file_id);
    if (!fileUrl) { await sendMessage(chatId, '❌ Gagal mengambil file.'); return; }
    const fetch = require('node-fetch');
    const content = await (await fetch(fileUrl)).text();
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (!lines.length) { await sendMessage(chatId, '❌ File kosong.'); return; }
    tmp.accounts = lines;
    await upsertSession(uid, { state: 'awaiting_batch_region', temp_data: JSON.stringify(tmp) });
    await sendMessage(chatId, `✅ <b>${lines.length} akun</b> siap dicek.\n\nPilih region:`, BATCH_REGION_KB);
    return;
  }
  if (state === 'awaiting_linode_token') {
    const token = text.trim();
    try {
      await linodeListRegions(token);
      tmp.linode_token = token;
      const regions = (await linodeListRegions(token)).slice(0, 16);
      await upsertSession(uid, { state: 'linode_pick_region', temp_data: JSON.stringify(tmp) });
      const buttons = [];
      for (let i = 0; i < regions.length; i += 2) {
        const row = [{ text: regions[i].label, callback_data: `linoderegion_${regions[i].id}` }];
        if (regions[i+1]) row.push({ text: regions[i+1].label, callback_data: `linoderegion_${regions[i+1].id}` });
        buttons.push(row);
      }
      buttons.push([{ text: '🔙 Menu Linode', callback_data: 'back_linode' }]);
      await sendMessage(chatId, `✅ Token valid! Pilih region:`, { inline_keyboard: buttons });
    } catch (e) { await sendMessage(chatId, `❌ Token tidak valid: ${e.message}\n\nCoba lagi:`); }
    return;
  }
  if (state === 'awaiting_linode_label') {
    tmp.linode_label = text.trim() === '-' ? `linode-${Date.now()}` : text.trim();
    await upsertSession(uid, { state: 'awaiting_linode_rootpass', temp_data: JSON.stringify(tmp) });
    await sendMessage(chatId, `✅ Label: <b>${tmp.linode_label}</b>\n\nMasukkan <b>Root Password</b> (min 6 karakter):`);
    return;
  }
  if (state === 'awaiting_linode_rootpass') {
    if (text.length < 6) { await sendMessage(chatId, '⚠️ Password min 6 karakter:'); return; }
    await sendMessage(chatId, `⏳ Membuat Linode instance...`);
    try {
      const result = await linodeCreate({ token: tmp.linode_token, region: tmp.linode_region, type: tmp.linode_type, image: tmp.linode_image, label: tmp.linode_label, root_pass: text.trim() });
      await sendMessage(chatId, result);
    } catch (e) { await sendMessage(chatId, `❌ Gagal: ${e.message}`); }
    await upsertSession(uid, { state: 'linode_menu', temp_data: JSON.stringify({ linode_token: tmp.linode_token }) });
    await sendMessage(chatId, `Menu Linode:`, LINODE_MENU);
    return;
  }
  if (state === 'awaiting_do_token') {
    const token = text.trim();
    try {
      await doListRegions(token);
      tmp.do_token = token;
      await upsertSession(uid, { state: 'do_menu', temp_data: JSON.stringify(tmp) });
      await sendMessage(chatId, `✅ Token valid! Menu DigitalOcean:`, DO_MENU);
    } catch (e) { await sendMessage(chatId, `❌ Token tidak valid: ${e.message}\n\nCoba lagi:`); }
    return;
  }
  if (state === 'awaiting_do_droplet_name') {
    tmp.do_droplet_name = text.trim() === '-' ? `droplet-${Date.now()}` : text.trim();
    try {
      const regions = (await doListRegions(tmp.do_token)).slice(0, 16);
      await upsertSession(uid, { state: 'do_pick_region', temp_data: JSON.stringify(tmp) });
      const buttons = [];
      for (let i = 0; i < regions.length; i += 2) {
        const row = [{ text: `${regions[i].name} (${regions[i].slug})`, callback_data: `doregion_${regions[i].slug}` }];
        if (regions[i+1]) row.push({ text: `${regions[i+1].name} (${regions[i+1].slug})`, callback_data: `doregion_${regions[i+1].slug}` });
        buttons.push(row);
      }
      buttons.push([{ text: '🔙 Menu DO', callback_data: 'back_do' }]);
      await sendMessage(chatId, `✅ Nama: <b>${tmp.do_droplet_name}</b>\n\nPilih region:`, { inline_keyboard: buttons });
    } catch (e) { await sendMessage(chatId, `❌ Error: ${e.message}`); }
    return;
  }

  // Fallback
  if (state === 'aws_menu') await sendMessage(chatId, `Menu AWS:`, AWS_MENU);
  else if (state === 'linode_menu') await sendMessage(chatId, `Menu Linode:`, LINODE_MENU);
  else if (state === 'do_menu') await sendMessage(chatId, `Menu DO:`, DO_MENU);
  else if (state === 'platform_select') await sendMessage(chatId, `Pilih platform:`, platformKeyboard(tmp.platforms || 'aws'));
  else if (state?.startsWith('admin')) await sendAdminMenu(chatId);
  else await sendMessage(chatId, `Ketik /start untuk mulai.\nAdmin? Ketik /admin`);
}

// ========== Callback Handler ==========
async function handleCallback(cb) {
  const chatId = cb.message?.chat?.id;
  const uid = String(cb.from?.id || chatId);
  const data = cb.data;
  await answerCallback(cb.id);
  const session = await getSession(uid);
  if (!session) { await sendMessage(chatId, '🔐 Ketik /start untuk mulai.'); return; }
  const tmp = td(session);

  // Admin callbacks
  if (data === 'adm_back') { await upsertSession(uid, { state: 'admin_menu' }); await sendAdminMenu(chatId); return; }
  if (data === 'adm_logout') { await upsertSession(uid, { state: 'awaiting_license', temp_data: '' }); await sendMessage(chatId, `✅ Logout admin. Ketik /start atau /admin.`); return; }
  if (data === 'adm_list') { await sendAdminKeyList(chatId); return; }
  if (data === 'adm_search_start') { await upsertSession(uid, { state: 'admin_search' }); await sendMessage(chatId, `🔍 Masukkan kata kunci (key, label, TG ID):`); return; }
  if (data === 'adm_gen_start') { await upsertSession(uid, { state: 'admin_gen_label', temp_data: JSON.stringify({ gen_prefix: 'LUNA' }) }); await sendMessage(chatId, `➕ <b>Generate Key</b>\n\nMasukkan label/nama:`); return; }

  if (data.startsWith('admplat_')) {
    const platform = data.replace('admplat_', '');
    const map = { all: 'aws,linode,digitalocean', aws: 'aws', linode: 'linode', digitalocean: 'digitalocean' };
    tmp.gen_platforms = map[platform] || 'aws';
    await upsertSession(uid, { state: 'admin_gen_prefix', temp_data: JSON.stringify(tmp) });
    await sendMessage(chatId, `✅ Platform: <b>${tmp.gen_platforms}</b>\n\nMasukkan prefix key:\n("-" untuk default LUNA)`);
    return;
  }
  if (data.startsWith('admexp_')) {
    const exp = data.replace('admexp_', '');
    let expiresAt = null;
    if (exp !== 'never') { const d = new Date(); d.setDate(d.getDate() + parseInt(exp)); expiresAt = d.toISOString(); }
    const newKey = genKey(tmp.gen_prefix || 'LUNA');
    const record = { key: newKey, user_label: tmp.gen_label || '', is_active: true, platform_access: tmp.gen_platforms || 'aws' };
    if (expiresAt) record.expires_at = expiresAt;
    await createLicenseKey(record);
    await upsertSession(uid, { state: 'admin_menu', temp_data: '' });
    const expText = expiresAt ? `📅 Expires: <b>${new Date(expiresAt).toLocaleDateString('id-ID')}</b>` : `📅 Tidak expired`;
    await sendMessage(chatId, `✅ <b>License Key Dibuat!</b>\n\n🗝️ Key:\n<code>${newKey}</code>\n\n📛 Label: <b>${tmp.gen_label||'-'}</b>\n🌐 Platform: <b>${tmp.gen_platforms}</b>\n${expText}\n\n<i>Tap key di atas untuk copy</i>`);
    await sendMessage(chatId, `Menu Admin:`, ADMIN_MENU);
    return;
  }

  // Navigation
  if (data === 'back_platform') { await upsertSession(uid, { state: 'platform_select' }); await sendMessage(chatId, `Pilih platform:`, platformKeyboard(tmp.platforms || 'aws')); return; }
  if (data === 'back_aws') { await upsertSession(uid, { state: 'aws_menu', pending_action: '' }); await sendMessage(chatId, `☁️ Menu AWS:`, AWS_MENU); return; }
  if (data === 'back_linode') { await upsertSession(uid, { state: 'linode_menu' }); await sendMessage(chatId, `🟢 Menu Linode:`, LINODE_MENU); return; }
  if (data === 'back_do') { await upsertSession(uid, { state: 'do_menu' }); await sendMessage(chatId, `🔵 Menu DO:`, DO_MENU); return; }
  if (data === 'platform_aws') { await upsertSession(uid, { state: 'aws_menu' }); await sendMessage(chatId, `☁️ <b>Menu AWS</b>`, AWS_MENU); return; }
  if (data === 'platform_linode') { await upsertSession(uid, { state: 'linode_menu' }); await sendMessage(chatId, `🟢 <b>Menu Linode</b>`, LINODE_MENU); return; }
  if (data === 'platform_do') {
    if (tmp.do_token) { await upsertSession(uid, { state: 'do_menu' }); await sendMessage(chatId, `🔵 <b>Menu DO</b>`, DO_MENU); }
    else { await upsertSession(uid, { state: 'awaiting_do_token' }); await sendMessage(chatId, `🔵 Masukkan <b>DO API Token</b>:\n\n<i>DigitalOcean → API → Tokens</i>`); }
    return;
  }

  // AWS
  if (data === 'aws_vcpu') { await upsertSession(uid, { state: 'awaiting_aws_keys', pending_action: 'vcpu_check' }); await sendMessage(chatId, `📊 <b>Check vCPU Limit</b>\n\n<code>ACCESS_KEY_ID\nSECRET_ACCESS_KEY</code>`); return; }
  if (data === 'aws_ai') { await upsertSession(uid, { state: 'awaiting_aws_keys', pending_action: 'ai_check' }); await sendMessage(chatId, `🤖 <b>Check AI Services</b>\n\n<code>ACCESS_KEY_ID\nSECRET_ACCESS_KEY</code>`); return; }
  if (data === 'aws_create') { await upsertSession(uid, { state: 'awaiting_aws_keys', pending_action: 'create_instance' }); await sendMessage(chatId, `🚀 <b>Auto Create EC2</b>\n\n<code>ACCESS_KEY_ID\nSECRET_ACCESS_KEY</code>`); return; }
  if (data === 'aws_batch') { await sendMessage(chatId, `📦 Pilih jenis batch:`, BATCH_TYPE_KB); return; }
  if (data === 'batch_vcpu' || data === 'batch_ai') {
    await upsertSession(uid, { state: 'awaiting_batch_file', temp_data: JSON.stringify({ batch_type: data === 'batch_vcpu' ? 'vcpu' : 'ai' }) });
    await sendMessage(chatId, `📎 Upload file <b>.txt</b>\n\nFormat: <code>ACCESS_KEY:SECRET_KEY</code>`);
    return;
  }
  if (data.startsWith('region_')) {
    const region = data.replace('region_', '');
    const pendingAction = session.pending_action || 'vcpu_check';
    if (pendingAction === 'create_instance') { await upsertSession(uid, { state: 'awaiting_ec2_type', aws_region: region }); await sendMessage(chatId, `✅ Region: <b>${region}</b>\n\nPilih tipe EC2:`, EC2_TYPE_KB); return; }
    await upsertSession(uid, { state: 'checking', aws_region: region });
    await sendMessage(chatId, `⏳ Mengecek di region <b>${region === 'all' ? 'semua' : region}</b>...`);
    const ALL_REGIONS = ['us-east-1','us-west-2','ap-southeast-1','ap-northeast-1','eu-west-1','eu-central-1','ap-southeast-3','ap-south-1'];
    const regions = region === 'all' ? ALL_REGIONS : [region];
    let result = '';
    for (const r of regions) {
      const res = pendingAction === 'vcpu_check' ? await checkVcpuQuotaHTML(session.aws_access_key, session.aws_secret_key, r) : await checkAIServicesHTML(session.aws_access_key, session.aws_secret_key, r);
      result += (regions.length > 1 ? `<b>📍 ${r}:</b>\n` : '') + res + (regions.length > 1 ? '\n\n─────────────\n\n' : '');
    }
    if (result.length > 3500) await sendDocument(chatId, result.replace(/<[^>]*>/g, ''), `result_${region}_${Date.now()}.txt`);
    else await sendMessage(chatId, result);
    await upsertSession(uid, { state: 'aws_menu' }); await sendMessage(chatId, `Menu AWS:`, AWS_MENU);
    return;
  }
  if (data.startsWith('batchregion_')) {
    const region = data.replace('batchregion_', '');
    const accounts = tmp.accounts || [];
    if (!accounts.length) { await sendMessage(chatId, '❌ Tidak ada akun.'); await upsertSession(uid, { state: 'aws_menu', temp_data: '' }); await sendMessage(chatId, `Menu AWS:`, AWS_MENU); return; }
    await upsertSession(uid, { state: 'checking' });
    await sendMessage(chatId, `⏳ Batch check <b>${accounts.length} akun</b>...`);
    const result = await batchCheck(accounts, tmp.batch_type || 'vcpu', region);
    if (result.length > 3000) await sendDocument(chatId, result, `batch_${tmp.batch_type}_${Date.now()}.txt`, `📋 Batch (${accounts.length} akun)`);
    else await sendMessage(chatId, result);
    await upsertSession(uid, { state: 'aws_menu', temp_data: '' }); await sendMessage(chatId, `Menu AWS:`, AWS_MENU);
    return;
  }
  if (data.startsWith('ec2type_')) {
    const instanceType = data.replace('ec2type_', '');
    await upsertSession(uid, { state: 'awaiting_ec2_ami', temp_data: JSON.stringify({ instance_type: instanceType }) });
    await sendMessage(chatId, `✅ Type: <b>${instanceType}</b>\n\nMasukkan AMI ID:\n• us-east-1: <code>ami-0c02fb55956c7d316</code>\n• ap-southeast-1: <code>ami-0c802847a506d0694</code>`);
    return;
  }

  // Linode
  if (data === 'linode_create_start') {
    if (!tmp.linode_token) { await upsertSession(uid, { state: 'awaiting_linode_token' }); await sendMessage(chatId, `🟢 Masukkan <b>Linode API Token</b>:\n\n<i>Linode → Profile → API Tokens</i>`); }
    else {
      try {
        const regions = (await linodeListRegions(tmp.linode_token)).slice(0, 16);
        const buttons = [];
        for (let i = 0; i < regions.length; i += 2) {
          const row = [{ text: regions[i].label, callback_data: `linoderegion_${regions[i].id}` }];
          if (regions[i+1]) row.push({ text: regions[i+1].label, callback_data: `linoderegion_${regions[i+1].id}` });
          buttons.push(row);
        }
        buttons.push([{ text: '🔙 Menu Linode', callback_data: 'back_linode' }]);
        await upsertSession(uid, { state: 'linode_pick_region' });
        await sendMessage(chatId, `Pilih region Linode:`, { inline_keyboard: buttons });
      } catch { await upsertSession(uid, { state: 'awaiting_linode_token' }); await sendMessage(chatId, `🔐 Token expired. Masukkan Linode API Token lagi:`); }
    }
    return;
  }
  if (data.startsWith('linoderegion_')) {
    const region = data.replace('linoderegion_', '');
    tmp.linode_region = region;
    try {
      const types = (await linodeListTypes(tmp.linode_token)).slice(0, 12);
      await upsertSession(uid, { state: 'linode_pick_type', temp_data: JSON.stringify(tmp) });
      const buttons = [];
      for (let i = 0; i < types.length; i += 2) {
        const row = [{ text: `${types[i].label} (${types[i].memory}, ${types[i].vcpus}vCPU, ${types[i].price})`, callback_data: `linodetype_${types[i].id}` }];
        if (types[i+1]) row.push({ text: `${types[i+1].label} (${types[i+1].memory}, ${types[i+1].vcpus}vCPU, ${types[i+1].price})`, callback_data: `linodetype_${types[i+1].id}` });
        buttons.push(row);
      }
      buttons.push([{ text: '🔙 Menu Linode', callback_data: 'back_linode' }]);
      await sendMessage(chatId, `✅ Region: <b>${region}</b>\n\nPilih tipe:`, { inline_keyboard: buttons });
    } catch (e) { await sendMessage(chatId, `❌ Error: ${e.message}`); }
    return;
  }
  if (data.startsWith('linodetype_')) {
    const type = data.replace('linodetype_', '');
    tmp.linode_type = type;
    try {
      const images = (await linodeListImages(tmp.linode_token)).slice(0, 10);
      await upsertSession(uid, { state: 'linode_pick_image', temp_data: JSON.stringify(tmp) });
      const buttons = images.map(img => [{ text: img.label, callback_data: `linodeimage_${img.id}` }]);
      buttons.push([{ text: '🔙 Menu Linode', callback_data: 'back_linode' }]);
      await sendMessage(chatId, `✅ Type: <b>${type}</b>\n\nPilih OS:`, { inline_keyboard: buttons });
    } catch (e) { await sendMessage(chatId, `❌ Error: ${e.message}`); }
    return;
  }
  if (data.startsWith('linodeimage_')) {
    const image = data.replace('linodeimage_', '');
    tmp.linode_image = image;
    await upsertSession(uid, { state: 'awaiting_linode_label', temp_data: JSON.stringify(tmp) });
    await sendMessage(chatId, `✅ Image: <b>${image}</b>\n\nMasukkan label instance:\n("-" untuk otomatis)`);
    return;
  }

  // DigitalOcean
  if (data === 'do_list') {
    await sendMessage(chatId, `⏳ Mengambil daftar droplets...`);
    try { const result = await doListDroplets(tmp.do_token); await sendMessage(chatId, result); }
    catch (e) { await sendMessage(chatId, `❌ Error: ${e.message}`); }
    await sendMessage(chatId, `Menu DO:`, DO_MENU);
    return;
  }
  if (data === 'do_create_start') {
    await upsertSession(uid, { state: 'awaiting_do_droplet_name', temp_data: JSON.stringify(tmp) });
    await sendMessage(chatId, `🔵 Masukkan <b>nama droplet</b>:\n("-" untuk otomatis)`);
    return;
  }
  if (data.startsWith('doregion_')) {
    const region = data.replace('doregion_', '');
    tmp.do_region = region;
    try {
      const sizes = (await doListSizes(tmp.do_token)).slice(0, 12);
      await upsertSession(uid, { state: 'do_pick_size', temp_data: JSON.stringify(tmp) });
      const buttons = [];
      for (let i = 0; i < sizes.length; i += 2) {
        const row = [{ text: `${sizes[i].slug} (${sizes[i].memory}, ${sizes[i].vcpus}vCPU, ${sizes[i].price})`, callback_data: `dosize_${sizes[i].slug}` }];
        if (sizes[i+1]) row.push({ text: `${sizes[i+1].slug} (${sizes[i+1].memory}, ${sizes[i+1].vcpus}vCPU, ${sizes[i+1].price})`, callback_data: `dosize_${sizes[i+1].slug}` });
        buttons.push(row);
      }
      buttons.push([{ text: '🔙 Menu DO', callback_data: 'back_do' }]);
      await sendMessage(chatId, `✅ Region: <b>${region}</b>\n\nPilih ukuran:`, { inline_keyboard: buttons });
    } catch (e) { await sendMessage(chatId, `❌ Error: ${e.message}`); }
    return;
  }
  if (data.startsWith('dosize_')) {
    const size = data.replace('dosize_', '');
    tmp.do_size = size;
    await upsertSession(uid, { state: 'do_pick_image', temp_data: JSON.stringify(tmp) });
    const images = [{ slug: 'ubuntu-22-04-x64', name: 'Ubuntu 22.04 LTS' },{ slug: 'ubuntu-20-04-x64', name: 'Ubuntu 20.04 LTS' },{ slug: 'debian-12-x64', name: 'Debian 12' },{ slug: 'debian-11-x64', name: 'Debian 11' },{ slug: 'centos-stream-9-x64', name: 'CentOS Stream 9' },{ slug: 'almalinux-9-x64', name: 'AlmaLinux 9' },{ slug: 'rockylinux-9-x64', name: 'Rocky Linux 9' }];
    const buttons = images.map(img => [{ text: img.name, callback_data: `doimage_${img.slug}` }]);
    buttons.push([{ text: '🔙 Menu DO', callback_data: 'back_do' }]);
    await sendMessage(chatId, `✅ Size: <b>${size}</b>\n\nPilih OS:`, { inline_keyboard: buttons });
    return;
  }
  if (data.startsWith('doimage_')) {
    const image = data.replace('doimage_', '');
    await sendMessage(chatId, `⏳ Membuat droplet...`);
    try {
      const result = await doCreateDroplet({ token: tmp.do_token, name: tmp.do_droplet_name, region: tmp.do_region, size: tmp.do_size, image });
      await sendMessage(chatId, result);
    } catch (e) { await sendMessage(chatId, `❌ Gagal: ${e.message}`); }
    await upsertSession(uid, { state: 'do_menu', temp_data: JSON.stringify({ do_token: tmp.do_token }) });
    await sendMessage(chatId, `Menu DO:`, DO_MENU);
    return;
  }
}

// ========== Vercel Handler ==========
module.exports = async (req, res) => {
  // Setup webhook via GET /setup
  if (req.method === 'GET' && req.url?.includes('/setup')) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const webhookUrl = `https://${host}/webhook`;
    const result = await setWebhook(webhookUrl);
    return res.status(200).json({ ok: true, webhook: webhookUrl, result });
  }

  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, status: 'Cloud Checker Bot is running!' });
  }

  // Telegram webhook
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      if (body.message) await handleMessage(body.message);
      else if (body.callback_query) await handleCallback(body.callback_query);
    } catch (e) {
      console.error('Handler error:', e);
    }
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
