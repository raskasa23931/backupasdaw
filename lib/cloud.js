const fetch = require('node-fetch');

// ========== LINODE ==========
async function linodeListRegions(token) {
  const res = await fetch('https://api.linode.com/v4/regions', { headers: { 'Authorization': `Bearer ${token}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.data || []).map(r => ({ id: r.id, label: r.label }));
}

async function linodeListTypes(token) {
  const res = await fetch('https://api.linode.com/v4/linode/types', { headers: { 'Authorization': `Bearer ${token}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.data || []).slice(0, 20).map(t => ({ id: t.id, label: t.label, vcpus: t.vcpus, memory: Math.round(t.memory/1024)+'GB', price: `$${t.price?.monthly}/mo` }));
}

async function linodeListImages(token) {
  const res = await fetch('https://api.linode.com/v4/images?page_size=100', { headers: { 'Authorization': `Bearer ${token}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const popular = ['linode/debian12','linode/ubuntu22.04','linode/ubuntu20.04','linode/centos-stream9','linode/almalinux9','linode/rocky9','linode/debian11'];
  return (data.data || []).filter(img => popular.includes(img.id) || img.label?.toLowerCase().includes('ubuntu') || img.label?.toLowerCase().includes('debian')).slice(0, 12).map(img => ({ id: img.id, label: img.label }));
}

async function linodeCreate({ token, region, type, image, label, root_pass }) {
  const payload = { region, type, image, root_pass, booted: true };
  if (label && label !== '-') payload.label = label;
  const res = await fetch('https://api.linode.com/v4/linode/instances', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) { const msg = data.errors?.map(e => e.reason).join(', ') || `HTTP ${res.status}`; throw new Error(msg); }
  return `✅ <b>Linode Instance Berhasil Dibuat!</b>\n\n🖥 ID: <code>${data.id}</code>\n📛 Label: <b>${data.label}</b>\n📍 Region: <b>${data.region}</b>\n⚙️ Type: <b>${data.type}</b>\n🖼 Image: <b>${image}</b>\n📊 Status: <b>${data.status}</b>\n🌐 IP: <code>${data.ipv4?.[0] || 'Pending...'}</code>\n\n⚠️ Jangan lupa hapus instance jika tidak dipakai!`;
}

// ========== DIGITALOCEAN ==========
async function doListDroplets(token) {
  const res = await fetch('https://api.digitalocean.com/v2/droplets?per_page=50', { headers: { 'Authorization': `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  const droplets = data.droplets || [];
  if (!droplets.length) return `🔵 <b>DigitalOcean Droplets</b>\n\nBelum ada droplet aktif.`;
  let result = `🔵 <b>DigitalOcean Droplets (${droplets.length})</b>\n\n`;
  for (const d of droplets) {
    const ip = d.networks?.v4?.[0]?.ip_address || 'N/A';
    const s = d.status === 'active' ? '🟢' : d.status === 'off' ? '🔴' : '🟡';
    result += `${s} <b>${d.name}</b>\n  ID: <code>${d.id}</code> | Region: <b>${d.region?.slug}</b> | Size: <b>${d.size_slug}</b>\n  IP: <code>${ip}</code> | Status: <b>${d.status}</b>\n\n`;
  }
  return result;
}

async function doListRegions(token) {
  const res = await fetch('https://api.digitalocean.com/v2/regions', { headers: { 'Authorization': `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return (data.regions || []).filter(r => r.available).map(r => ({ slug: r.slug, name: r.name }));
}

async function doListSizes(token) {
  const res = await fetch('https://api.digitalocean.com/v2/sizes', { headers: { 'Authorization': `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return (data.sizes || []).filter(s => s.available && s.price_monthly <= 50).slice(0, 12).map(s => ({ slug: s.slug, vcpus: s.vcpus, memory: Math.round(s.memory/1024)+'GB', price: `$${s.price_monthly}/mo` }));
}

async function doCreateDroplet({ token, name, region, size, image }) {
  const dropletName = (!name || name === '-') ? `droplet-${Date.now()}` : name;
  const res = await fetch('https://api.digitalocean.com/v2/droplets', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: dropletName, region, size, image }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  const d = data.droplet;
  return `✅ <b>DigitalOcean Droplet Berhasil Dibuat!</b>\n\n🖥 ID: <code>${d.id}</code>\n📛 Name: <b>${d.name}</b>\n📍 Region: <b>${d.region?.slug}</b>\n⚙️ Size: <b>${d.size_slug}</b>\n🖼 Image: <b>${d.image?.distribution} ${d.image?.name}</b>\n📊 Status: <b>${d.status}</b>\n\n⏳ IP tersedia dalam beberapa menit.\n⚠️ Jangan lupa hapus jika tidak dipakai!`;
}

module.exports = { linodeListRegions, linodeListTypes, linodeListImages, linodeCreate, doListDroplets, doListRegions, doListSizes, doCreateDroplet };
