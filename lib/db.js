const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'cloudchecker';

let client = null;

async function getDb() {
  if (!client) {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
  }
  return client.db(DB_NAME);
}

// ========== BotSession ==========
async function getSession(telegramUserId) {
  try {
    const db = await getDb();
    return await db.collection('sessions').findOne({ telegram_user_id: telegramUserId });
  } catch (e) {
    console.error('getSession error:', e.message);
    return null;
  }
}

async function upsertSession(telegramUserId, updates) {
  try {
    const db = await getDb();
    await db.collection('sessions').updateOne(
      { telegram_user_id: telegramUserId },
      { $set: { telegram_user_id: telegramUserId, ...updates, updated_at: new Date() } },
      { upsert: true }
    );
  } catch (e) {
    console.error('upsertSession error:', e.message);
  }
}

// ========== LicenseKey ==========
async function getLicenseKeys(filter = {}) {
  try {
    const db = await getDb();
    return await db.collection('license_keys').find(filter).toArray();
  } catch (e) {
    console.error('getLicenseKeys error:', e.message);
    return [];
  }
}

async function listLicenseKeys() {
  try {
    const db = await getDb();
    return await db.collection('license_keys').find({}).sort({ created_at: -1 }).toArray();
  } catch (e) {
    console.error('listLicenseKeys error:', e.message);
    return [];
  }
}

async function createLicenseKey(record) {
  try {
    const db = await getDb();
    const doc = { ...record, created_at: new Date(), updated_at: new Date() };
    const result = await db.collection('license_keys').insertOne(doc);
    return { ...doc, id: result.insertedId.toString() };
  } catch (e) {
    console.error('createLicenseKey error:', e.message);
    throw e;
  }
}

async function updateLicenseKey(id, updates) {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    await db.collection('license_keys').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updated_at: new Date() } }
    );
  } catch (e) {
    console.error('updateLicenseKey error:', e.message);
  }
}

async function deleteLicenseKey(id) {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    await db.collection('license_keys').deleteOne({ _id: new ObjectId(id) });
  } catch (e) {
    console.error('deleteLicenseKey error:', e.message);
  }
}

module.exports = { getSession, upsertSession, getLicenseKeys, listLicenseKeys, createLicenseKey, updateLicenseKey, deleteLicenseKey };
