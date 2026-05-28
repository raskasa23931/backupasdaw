const fetch = require('node-fetch');
const crypto = require('crypto');

// AWS Signature v4
function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}
function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}
function getSigningKey(secretKey, dateStamp, region, service) {
  const kDate = hmacSha256('AWS4' + secretKey, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

async function awsRequest({ accessKey, secretKey, region, service, method, host, path, query = '', body = '', extraHeaders = {} }) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const canonicalHeaders = `content-type:application/x-amz-json-1.1\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = [method, path, query, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`;
  const signingKey = getSigningKey(secretKey, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const url = `https://${host}${path}${query ? '?' + query : ''}`;
  return fetch(url, {
    method,
    headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Date': amzDate, 'Authorization': authHeader, ...extraHeaders },
    body: body || undefined,
  });
}

async function checkVcpuQuotaHTML(accessKey, secretKey, region) {
  try {
    const host = `service-quotas.${region}.amazonaws.com`;
    const body = JSON.stringify({ ServiceCode: 'ec2', MaxResults: 100 });
    const resp = await awsRequest({ accessKey, secretKey, region, service: 'servicequotas', method: 'POST', host, path: '/listServiceQuotas', body, extraHeaders: { 'X-Amz-Target': 'ServiceQuotasV20190624.ListServiceQuotas' } });
    if (!resp.ok) { const t = await resp.text(); return `❌ Error: ${resp.status} - ${t.slice(0, 200)}`; }
    const data = await resp.json();
    const quotas = (data.Quotas || []).filter(q => q.QuotaName?.toLowerCase().includes('vcpu') || q.QuotaName?.toLowerCase().includes('running on-demand'));
    if (!quotas.length) return `ℹ️ Tidak ada quota vCPU di region <b>${region}</b>`;
    let result = `📊 <b>vCPU Quotas - ${region}</b>\n\n`;
    for (const q of quotas) result += `• <b>${q.QuotaName}</b>\n  Limit: <code>${q.Value}</code> vCPUs | Adjustable: ${q.Adjustable ? '✅' : '❌'}\n\n`;
    return result;
  } catch (e) { return `❌ Error: ${e.message}`; }
}

async function checkVcpuQuotaPlain(accessKey, secretKey, region) {
  try {
    const host = `service-quotas.${region}.amazonaws.com`;
    const body = JSON.stringify({ ServiceCode: 'ec2', MaxResults: 100 });
    const resp = await awsRequest({ accessKey, secretKey, region, service: 'servicequotas', method: 'POST', host, path: '/listServiceQuotas', body, extraHeaders: { 'X-Amz-Target': 'ServiceQuotasV20190624.ListServiceQuotas' } });
    if (!resp.ok) { const t = await resp.text(); return `ERROR: ${resp.status} - ${t.slice(0, 200)}`; }
    const data = await resp.json();
    const quotas = (data.Quotas || []).filter(q => q.QuotaName?.toLowerCase().includes('vcpu') || q.QuotaName?.toLowerCase().includes('running on-demand'));
    if (!quotas.length) return `No vCPU quota found in ${region}`;
    let result = `vCPU Quotas - ${region}\n\n`;
    for (const q of quotas) result += `• ${q.QuotaName}\n  Limit: ${q.Value} vCPUs | Adjustable: ${q.Adjustable ? 'Yes' : 'No'}\n\n`;
    return result;
  } catch (e) { return `ERROR: ${e.message}`; }
}

async function checkAIServicesHTML(accessKey, secretKey, region) {
  try {
    const resp = await awsRequest({ accessKey, secretKey, region, service: 'bedrock', method: 'GET', host: `bedrock.${region}.amazonaws.com`, path: '/foundation-models', body: '', extraHeaders: { 'Content-Type': 'application/json' } });
    let result = `🤖 <b>AI Services - ${region}</b>\n\n`;
    if (!resp.ok) {
      if (resp.status === 403 || resp.status === 401) result += `❌ <b>Amazon Bedrock:</b> Tidak punya akses\n`;
      else if (resp.status === 404 || resp.status === 400) result += `⚠️ <b>Amazon Bedrock:</b> Tidak tersedia di region ini\n`;
      else result += `❌ <b>Amazon Bedrock:</b> Error ${resp.status}\n`;
    } else {
      const data = await resp.json();
      const models = data.modelSummaries || [];
      if (!models.length) { result += `⚠️ Amazon Bedrock tersedia tapi tidak ada model\n`; }
      else {
        result += `✅ <b>Amazon Bedrock:</b> ${models.length} model tersedia\n\n`;
        const providers = {};
        for (const m of models) { if (!providers[m.providerName]) providers[m.providerName] = []; providers[m.providerName].push(m.modelName); }
        for (const [p, names] of Object.entries(providers)) {
          const emoji = p === 'Anthropic' ? '🧠' : p === 'Amazon' ? '📦' : p === 'Meta' ? '🦙' : '🤖';
          result += `${emoji} <b>${p}:</b>\n`;
          for (const n of names.slice(0, 5)) result += `  • ${n}\n`;
          if (names.length > 5) result += `  • ...+${names.length - 5} lainnya\n`;
          result += '\n';
        }
      }
    }
    const smResp = await awsRequest({ accessKey, secretKey, region, service: 'sagemaker', method: 'POST', host: `api.sagemaker.${region}.amazonaws.com`, path: '/', body: JSON.stringify({}), extraHeaders: { 'X-Amz-Target': 'SageMaker.ListEndpoints', 'Content-Type': 'application/x-amz-json-1.1' } });
    result += smResp.ok || smResp.status === 403 ? `✅ <b>Amazon SageMaker:</b> Tersedia\n` : `⚠️ <b>Amazon SageMaker:</b> Tidak tersedia\n`;
    const rekResp = await awsRequest({ accessKey, secretKey, region, service: 'rekognition', method: 'POST', host: `rekognition.${region}.amazonaws.com`, path: '/', body: JSON.stringify({}), extraHeaders: { 'X-Amz-Target': 'RekognitionService.ListCollections', 'Content-Type': 'application/x-amz-json-1.1' } });
    result += rekResp.ok || rekResp.status === 403 ? `✅ <b>Amazon Rekognition:</b> Tersedia\n` : `⚠️ <b>Amazon Rekognition:</b> Tidak tersedia\n`;
    return result;
  } catch (e) { return `❌ Error: ${e.message}`; }
}

async function checkAIServicesPlain(accessKey, secretKey, region) {
  const html = await checkAIServicesHTML(accessKey, secretKey, region);
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&');
}

async function createEC2Instance(accessKey, secretKey, region, instanceType, amiId) {
  try {
    const params = new URLSearchParams({ Action: 'RunInstances', Version: '2016-11-15', ImageId: amiId, InstanceType: instanceType, MinCount: '1', MaxCount: '1' });
    const resp = await awsRequest({ accessKey, secretKey, region, service: 'ec2', method: 'POST', host: `ec2.${region}.amazonaws.com`, path: '/', body: params.toString(), extraHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const text = await resp.text();
    if (!resp.ok) {
      const code = (text.match(/<Code>(.*?)<\/Code>/) || [])[1] || resp.status;
      const msg = (text.match(/<Message>(.*?)<\/Message>/) || [])[1] || text.slice(0, 200);
      return `❌ Gagal: <code>${code}</code>: ${msg}`;
    }
    const instanceId = (text.match(/<instanceId>(.*?)<\/instanceId>/) || [])[1] || 'Unknown';
    const state = (text.match(/<name>(.*?)<\/name>/) || [])[1] || 'pending';
    return `✅ <b>EC2 Berhasil Dibuat!</b>\n\n🖥 ID: <code>${instanceId}</code>\n📍 Region: <b>${region}</b>\n⚙️ Type: <b>${instanceType}</b>\n🖼 AMI: <code>${amiId}</code>\n📊 State: <b>${state}</b>\n\n⚠️ Jangan lupa terminate jika tidak dipakai!`;
  } catch (e) { return `❌ Error: ${e.message}`; }
}

async function batchCheck(accounts, checkType, region) {
  const ALL_REGIONS = ['us-east-1','us-west-2','ap-southeast-1','ap-northeast-1','eu-west-1','eu-central-1','ap-southeast-3','ap-south-1'];
  const regionsToCheck = region === 'all' ? ALL_REGIONS : [region];
  const lines = [];
  let success = 0, failed = 0;
  lines.push(`BATCH CHECK RESULT - ${checkType.toUpperCase()}`);
  lines.push(`Total: ${accounts.length} akun | Region: ${region === 'all' ? 'All Regions' : region}`);
  lines.push(`Date: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`);
  lines.push('='.repeat(60));
  lines.push('');
  for (let i = 0; i < accounts.length; i++) {
    const line = accounts[i].trim();
    if (!line) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) { lines.push(`[${i+1}] SKIP: Format tidak valid`); lines.push('-'.repeat(60)); failed++; continue; }
    const ak = line.slice(0, colonIdx).trim();
    const sk = line.slice(colonIdx + 1).trim();
    lines.push(`[${i+1}] Account: ${ak.slice(0,8)}...${ak.slice(-4)}`);
    try {
      for (const r of regionsToCheck) {
        lines.push(`  >> Region: ${r}`);
        const res = checkType === 'vcpu' ? await checkVcpuQuotaPlain(ak, sk, r) : await checkAIServicesPlain(ak, sk, r);
        lines.push(res.split('\n').map(l => '  ' + l).join('\n'));
        lines.push('');
      }
      success++;
    } catch (e) { lines.push(`  ERROR: ${e.message}`); failed++; }
    lines.push('-'.repeat(60));
    lines.push('');
  }
  lines.push('='.repeat(60));
  lines.push(`SUMMARY: ${success} berhasil, ${failed} gagal`);
  return lines.join('\n');
}

module.exports = { checkVcpuQuotaHTML, checkAIServicesHTML, createEC2Instance, batchCheck };
