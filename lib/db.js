const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'cloudchecker';

async function getDb() {
  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  await client.connect();
  return { db: client.db(DB_NAME), client };
}

async function getSession(telegramUserId) {
  const { db, client } = await getDb();
  try {
    return await db.collection('sessions').findOne({ telegram_user_id: telegramUserId });
  } finally { await client.close(); }
}

async function upsertSession(telegramUserId, updates) {
  const { db, client } = await getDb();
  try {
    await db.collection('sessions').updateOne(
      { telegram_user_id: telegramUserId },
      { $set: { telegram_user_id: telegramUserId, ...updates, updated_at: new Date() } },
      { upsert: true }
    );
  } finally { await client.close(); }
}

async function getLicenseKeys(filter = {}) {
  const { db, client } = await getDb();
  try {
    return await db.collection('license_keys').find(filter).toArray();
  } finally { await client.close(); }
}

async function listLicenseKeys() {
  const { db, client } = await getDb();
  try {
    return await db.collection('license_keys').find({}).sort({ created_at: -1 }).toArray();
  } finally { await client.close(); }
}

async function createLicenseKey(record) {
  const { db, client } = await getDb();
  try {
    const doc = { ...record, created_at: new Date(), updated_at: new Date() };
    const result = await db.collection('license_keys').insertOne(doc);
    return { ...doc, id: result.insertedId.toString() };
  } finally { await client.close(); }
}

async function updateLicenseKey(id, updates) {
  const { db, client } = await getDb();
  try {
    await db.collection('license_keys').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updated_at: new Date() } }
    );
  } finally { await client.close(); }
}

async function deleteLicenseKey(id) {
  const { db, client } = await getDb();
  try {
    await db.collection('license_keys').deleteOne({ _id: new ObjectId(id) });
  } finally { await client.close(); }
}

module.exports = { getSession, upsertSession, getLicenseKeys, listLicenseKeys, createLicenseKey, updateLicenseKey, deleteLicenseKey };
