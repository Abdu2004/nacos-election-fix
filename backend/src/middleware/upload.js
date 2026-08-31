const multer = require('multer');
const path = require('path');
const AppError = require('../utils/AppError');
const config = require('../config/env');

// Folder names inside the Supabase Storage bucket (see storageService.js).
// These replace the old local-disk folder constants.
const VERIFICATION_DOCS_FOLDER = 'verification_documents';
const CANDIDATE_PHOTOS_FOLDER = 'candidate_photos';
const CANDIDATE_CREDENTIALS_FOLDER = 'candidate_credentials';
const FEED_IMAGES_FOLDER = 'feed_images';

// Files are kept in memory only long enough to be forwarded to Supabase
// Storage — nothing is written to local disk, which is required on Vercel
// since its filesystem is read-only outside of /tmp.
const memoryStorage = multer.memoryStorage();

// Allowed file types
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.pdf'
]);

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp'
]);

// 1. Verification document uploads
const verificationFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new AppError(
      'Invalid file format. Only JPEG, PNG, WEBP images and PDF documents are permitted for student verification.',
      400,
      'INVALID_FILE_TYPE'
    ), false);
  }

  cb(null, true);
};

const uploadVerificationDoc = multer({
  storage: memoryStorage,
  fileFilter: verificationFileFilter,
  limits: {
    fileSize: (config.upload.maxSizeMB || 5) * 1024 * 1024
  }
});

// 2. Candidate assets (photo & credentials)
const candidateFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (file.fieldname === 'photo') {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype) || !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      return cb(new AppError(
        'Invalid photo format. Candidate headshots must be JPEG, PNG, or WEBP images.',
        400,
        'INVALID_PHOTO_FORMAT'
      ), false);
    }
  } else if (file.fieldname === 'credentials') {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new AppError(
        'Invalid credentials document format. Permitted formats are JPEG, PNG, WEBP, and PDF.',
        400,
        'INVALID_CREDENTIALS_FORMAT'
      ), false);
    }
  } else {
    return cb(new AppError(`Unexpected file field '${file.fieldname}'.`, 400, 'UNEXPECTED_FIELD'), false);
  }

  cb(null, true);
};

const uploadCandidateAssets = multer({
  storage: memoryStorage,
  fileFilter: candidateFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

// 3. Feed post images
const feedFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype) || !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return cb(new AppError(
      'Invalid feed image format. Images must be JPEG, PNG, or WEBP.',
      400,
      'INVALID_IMAGE_FORMAT'
    ), false);
  }
  cb(null, true);
};

const uploadFeedImage = multer({
  storage: memoryStorage,
  fileFilter: feedFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

module.exports = {
  uploadVerificationDoc,
  uploadCandidateAssets,
  uploadFeedImage,
  VERIFICATION_DOCS_FOLDER,
  CANDIDATE_PHOTOS_FOLDER,
  CANDIDATE_CREDENTIALS_FOLDER,
  FEED_IMAGES_FOLDER,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_IMAGE_EXTENSIONS
};
