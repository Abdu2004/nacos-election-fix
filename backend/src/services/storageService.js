const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');
const config = require('../config/env');

let supabase = null;
function getClient() {
  if (!supabase) {
    if (!config.supabase.url || !config.supabase.serviceKey) {
      throw new Error(
        'Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
      );
    }
    supabase = createClient(config.supabase.url, config.supabase.serviceKey);
  }
  return supabase;
}

const BUCKET = config.supabase.bucket;

/**
 * Generate a random, collision-safe filename that preserves the original extension.
 */
function generateSecureFilename(originalname) {
  const ext = path.extname(originalname).toLowerCase();
  return `${crypto.randomUUID()}-${Date.now()}${ext}`;
}

/**
 * Upload an in-memory file buffer to a folder inside the Supabase Storage bucket.
 * Returns just the generated filename (not the full storage path) so it can be
 * stored in the DB and safely reused as a URL param, same shape as the old
 * local-disk filenames.
 */
async function uploadFile(folder, buffer, originalname, mimetype) {
  const filename = generateSecureFilename(originalname);
  const storagePath = `${folder}/${filename}`;

  const { error } = await getClient()
    .storage.from(BUCKET)
    .upload(storagePath, buffer, { contentType: mimetype, upsert: false });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  return filename;
}

/**
 * Download a file's bytes back out of Storage, given the folder it was uploaded
 * to and the filename returned by uploadFile. Used to stream files back to
 * clients through our own API instead of exposing Supabase URLs directly.
 */
async function downloadFile(folder, filename) {
  // Guard against path traversal since this filename can come from a URL param
  if (!filename || filename.includes('/') || filename.includes('..')) {
    return null;
  }

  const storagePath = `${folder}/${filename}`;

  const { data, error } = await getClient().storage.from(BUCKET).download(storagePath);

  if (error) {
    return null;
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = {
  uploadFile,
  downloadFile
};
