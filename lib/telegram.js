const fetch = require('node-fetch');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const BASE = `https://api.telegram.org/bot${TOKEN}`;

async function sendMessage(chatId, text, replyMarkup) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function sendDocument(chatId, content, filename, caption) {
  const FormData = require('form-data');
  const fd = new FormData();
  fd.append('chat_id', String(chatId));
  fd.append('document', Buffer.from(content, 'utf-8'), { filename, contentType: 'text/plain' });
  if (caption) fd.append('caption', caption);
  fd.append('parse_mode', 'HTML');
  await fetch(`${BASE}/sendDocument`, { method: 'POST', body: fd });
}

async function getFile(fileId) {
  const res = await fetch(`${BASE}/getFile?file_id=${fileId}`);
  const data = await res.json();
  if (!data.ok) return null;
  return `https://api.telegram.org/file/bot${TOKEN}/${data.result.file_path}`;
}

async function answerCallback(id) {
  await fetch(`${BASE}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: id }),
  });
}

async function setWebhook(url) {
  const res = await fetch(`${BASE}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, allowed_updates: ['message', 'callback_query'] }),
  });
  return res.json();
}

module.exports = { sendMessage, sendDocument, getFile, answerCallback, setWebhook };
