const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const config = require('../config/env');

// Base upload directories
const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');
const VERIFICATION_DOCS_DIR = path.join(UPLOAD_ROOT, 'verification_documents');
const CANDIDATE_PHOTOS_DIR = path.join(UPLOAD_ROOT, 'candidate_photos');
const CANDIDATE_CREDENTIALS_DIR = path.join(UPLOAD_ROOT, 'candidate_credentials');
const FEED_IMAGES_DIR = path.join(UPLOAD_ROOT, 'feed_images');

// Ensure directories exist
[VERIFICATION_DOCS_DIR, CANDIDATE_PHOTOS_DIR, CANDIDATE_CREDENTIALS_DIR, FEED_IMAGES_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

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

// Helper for generating sanitized secure random filenames
function generateSecureFilename(originalname) {
  const ext = path.extname(originalname).toLowerCase();
  return `${crypto.randomUUID()}-${Date.now()}${ext}`;
}

// 1. Storage Configuration for Voter Verification
const verificationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, VERIFICATION_DOCS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, generateSecureFilename(file.originalname));
  }
});

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
  storage: verificationStorage,
  fileFilter: verificationFileFilter,
  limits: {
    fileSize: (config.upload.maxSizeMB || 5) * 1024 * 1024 // 5MB limit
  }
});

// 2. Storage & Filter for Candidate Assets (Photo & Credentials)
const candidateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'photo') {
      cb(null, CANDIDATE_PHOTOS_DIR);
    } else if (file.fieldname === 'credentials') {
      cb(null, CANDIDATE_CREDENTIALS_DIR);
    } else {
      cb(new AppError(`Unexpected field '${file.fieldname}' in upload request.`, 400, 'UNEXPECTED_FIELD'));
    }
  },
  filename: (req, file, cb) => {
    cb(null, generateSecureFilename(file.originalname));
  }
});

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
  storage: candidateStorage,
  fileFilter: candidateFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// 3. Storage & Filter for Feed Post Images
const feedStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, FEED_IMAGES_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, generateSecureFilename(file.originalname));
  }
});

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
  storage: feedStorage,
  fileFilter: feedFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

module.exports = {
  uploadVerificationDoc,
  uploadCandidateAssets,
  uploadFeedImage,
  VERIFICATION_DOCS_DIR,
  CANDIDATE_PHOTOS_DIR,
  CANDIDATE_CREDENTIALS_DIR,
  FEED_IMAGES_DIR,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_IMAGE_EXTENSIONS
};
