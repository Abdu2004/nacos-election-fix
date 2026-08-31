const { query } = require('../config/db');
const AppError = require('../utils/AppError');
const { sendSuccess, sendCreated, sendPaginated } = require('../utils/response');
const AuditService = require('../services/auditService');
const NotificationService = require('../services/notificationService');
const storageService = require('../services/storageService');
const { FEED_IMAGES_FOLDER } = require('../middleware/upload');

// ==============================================================================
// 1. CREATE FEED POST (Administrator, Validator, Candidate)
// ==============================================================================

/**
 * Create a new feed post.
 * POST /api/v1/feed
 *
 * Enforces role-based permissions and anti-impersonation rules (§17):
 *  - CANDIDATE: Can only post post_type = 'CAMPAIGN'
 *  - VALIDATOR: Can post post_type = 'UPDATE' or 'ANNOUNCEMENT'
 *  - ADMINISTRATOR: Can post any type and can pin posts
 */
async function createPost(req, res, next) {
  const user = req.user;
  const { title, content, postType, imageUrl, candidatePosition, isPinned = false } = req.body;

  if (!title || !title.trim()) {
    return next(new AppError('Post title is required.', 400, 'TITLE_REQUIRED'));
  }

  if (!content || !content.trim()) {
    return next(new AppError('Post content is required.', 400, 'CONTENT_REQUIRED'));
  }

  const validPostTypes = ['CAMPAIGN', 'ANNOUNCEMENT', 'UPDATE'];
  const normalizedType = postType ? postType.toUpperCase() : (user.role === 'CANDIDATE' ? 'CAMPAIGN' : 'UPDATE');

  if (!validPostTypes.includes(normalizedType)) {
    return next(new AppError(`Invalid post type '${postType}'. Allowed: ${validPostTypes.join(', ')}.`, 400, 'INVALID_POST_TYPE'));
  }

  // --- ANTI-IMPERSONATION RULE (§17) ---
  // Candidates must not impersonate official Administrator or Validator announcements.
  if (user.role === 'CANDIDATE' && normalizedType !== 'CAMPAIGN') {
    return next(new AppError(
      'ANTI-IMPERSONATION SECURITY VIOLATION: Candidates are only permitted to publish CAMPAIGN posts and cannot create official announcements or system updates.',
      403,
      'IMPERSONATION_PROHIBITED'
    ));
  }

  let finalImageUrl = imageUrl || null;
  if (req.file) {
    const storedFilename = await storageService.uploadFile(
      FEED_IMAGES_FOLDER,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    finalImageUrl = `/api/v1/feed/images/${storedFilename}`;
  }

  // Only Administrator can pin posts
  const pinStatus = user.role === 'ADMINISTRATOR' ? Boolean(isPinned) : false;

  const insertSql = `
    INSERT INTO posts (
      author_id, author_role, post_type, title, content, image_url, candidate_position, is_pinned, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PUBLISHED')
    RETURNING *;
  `;

  const postRes = await query(insertSql, [
    user.id,
    user.role,
    normalizedType,
    title.trim(),
    content.trim(),
    finalImageUrl,
    candidatePosition || null,
    pinStatus
  ]);

  const post = postRes.rows[0];

  // Audit official announcements and validator notices
  if (user.role === 'ADMINISTRATOR' || user.role === 'VALIDATOR') {
    await AuditService.log({
      action: 'FEED_POST_CREATED',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      entityType: 'post',
      entityId: post.id,
      details: { title: post.title, postType: normalizedType, isPinned: pinStatus },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }

  // Broadcast in-app notification to all users
  await NotificationService.broadcastNotification({
    type: 'ANNOUNCEMENT',
    title: normalizedType === 'CAMPAIGN' ? `Campaign Update: ${post.title}` : `New Notice: ${post.title}`,
    message: post.content.length > 120 ? `${post.content.slice(0, 117)}...` : post.content,
    link: '/feed'
  });

  return sendCreated(res, { post }, 'Post published to feed successfully.');
}

// ==============================================================================
// 2. LIST FEED POSTS (Public Access)
// ==============================================================================

/**
 * List published feed posts with filtering and pagination.
 * GET /api/v1/feed
 */
async function listPosts(req, res, next) {
  const { postType, authorRole, search } = req.query;
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
  const offset = (page - 1) * limit;

  const conditions = ["p.status = 'PUBLISHED'"];
  const params = [];

  if (postType) {
    params.push(postType.toUpperCase());
    conditions.push(`p.post_type = $${params.length}`);
  }

  if (authorRole) {
    params.push(authorRole.toUpperCase());
    conditions.push(`p.author_role = $${params.length}`);
  }

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(`(LOWER(p.title) LIKE $${params.length} OR LOWER(p.content) LIKE $${params.length})`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countSql = `SELECT COUNT(*) as total FROM posts p ${whereClause};`;
  const countRes = await query(countSql, params);
  const totalCount = parseInt(countRes.rows[0].total, 10);

  const dataParams = [...params, limit, offset];
  const dataSql = `
    SELECT 
      p.id,
      p.author_id,
      p.author_role,
      p.post_type,
      p.title,
      p.content,
      p.image_url,
      p.candidate_position,
      p.is_pinned,
      p.published_at,
      p.created_at,
      u.full_name as author_name,
      u.email as author_email,
      cand.photo_url as candidate_photo_url
    FROM posts p
    INNER JOIN users u ON p.author_id = u.id
    LEFT JOIN candidates cand ON p.author_id = cand.user_id AND cand.status = 'APPROVED'
    ${whereClause}
    ORDER BY p.is_pinned DESC, p.published_at DESC
    LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length};
  `;

  const postsRes = await query(dataSql, dataParams);

  return sendPaginated(res, postsRes.rows, totalCount, page, limit, 'Feed posts retrieved successfully.');
}

// ==============================================================================
// 3. GET SINGLE POST (Public Access)
// ==============================================================================

/**
 * Get single feed post details.
 * GET /api/v1/feed/:id
 */
async function getPostById(req, res, next) {
  const { id } = req.params;

  const sql = `
    SELECT 
      p.*,
      u.full_name as author_name,
      u.email as author_email,
      cand.photo_url as candidate_photo_url
    FROM posts p
    INNER JOIN users u ON p.author_id = u.id
    LEFT JOIN candidates cand ON p.author_id = cand.user_id AND cand.status = 'APPROVED'
    WHERE p.id = $1 AND p.status = 'PUBLISHED';
  `;

  const postRes = await query(sql, [id]);
  if (postRes.rows.length === 0) {
    return next(new AppError('Post not found.', 404, 'POST_NOT_FOUND'));
  }

  return sendSuccess(res, { post: postRes.rows[0] }, 'Post details retrieved.');
}

// ==============================================================================
// 4. UPDATE POST (Author or Administrator)
// ==============================================================================

/**
 * Update an existing post.
 * PATCH /api/v1/feed/:id
 */
async function updatePost(req, res, next) {
  const { id } = req.params;
  const { title, content, imageUrl, candidatePosition } = req.body;
  const user = req.user;

  const postRes = await query('SELECT * FROM posts WHERE id = $1', [id]);
  if (postRes.rows.length === 0) {
    return next(new AppError('Post not found.', 404, 'POST_NOT_FOUND'));
  }

  const post = postRes.rows[0];

  // RBAC & IDOR: Must be the author OR Administrator
  const isAuthor = user.id === post.author_id;
  const isAdmin = user.role === 'ADMINISTRATOR';

  if (!isAuthor && !isAdmin) {
    return next(new AppError('You do not have permission to edit this post.', 403, 'FORBIDDEN_POST_EDIT'));
  }

  const newTitle = title ? title.trim() : post.title;
  const newContent = content ? content.trim() : post.content;
  const newImage = imageUrl !== undefined ? imageUrl : post.image_url;
  const newPos = candidatePosition !== undefined ? candidatePosition : post.candidate_position;

  const updatedRes = await query(`
    UPDATE posts 
    SET title = $1, content = $2, image_url = $3, candidate_position = $4, updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *;
  `, [newTitle, newContent, newImage, newPos, id]);

  return sendSuccess(res, { post: updatedRes.rows[0] }, 'Post updated successfully.');
}

// ==============================================================================
// 5. DELETE POST (Author or Administrator)
// ==============================================================================

/**
 * Delete a post (hard delete or archive).
 * DELETE /api/v1/feed/:id
 */
async function deletePost(req, res, next) {
  const { id } = req.params;
  const user = req.user;

  const postRes = await query('SELECT id, author_id, title FROM posts WHERE id = $1', [id]);
  if (postRes.rows.length === 0) {
    return next(new AppError('Post not found.', 404, 'POST_NOT_FOUND'));
  }

  const post = postRes.rows[0];

  // RBAC & IDOR: Must be author or Administrator
  const isAuthor = user.id === post.author_id;
  const isAdmin = user.role === 'ADMINISTRATOR';

  if (!isAuthor && !isAdmin) {
    return next(new AppError('You do not have permission to delete this post.', 403, 'FORBIDDEN_POST_DELETE'));
  }

  await query('DELETE FROM posts WHERE id = $1', [id]);

  await AuditService.log({
    action: 'FEED_POST_DELETED',
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    entityType: 'post',
    entityId: id,
    details: { title: post.title, deletedBy: user.email },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendSuccess(res, { id }, 'Post deleted successfully.');
}

// ==============================================================================
// 6. TOGGLE PIN STATUS (Administrator Only)
// ==============================================================================

/**
 * Toggle pinned status for a post.
 * PATCH /api/v1/feed/:id/pin
 */
async function togglePinPost(req, res, next) {
  const { id } = req.params;

  const postRes = await query('SELECT id, is_pinned, title FROM posts WHERE id = $1', [id]);
  if (postRes.rows.length === 0) {
    return next(new AppError('Post not found.', 404, 'POST_NOT_FOUND'));
  }

  const post = postRes.rows[0];
  const newPinStatus = !post.is_pinned;

  const updatedRes = await query(
    'UPDATE posts SET is_pinned = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;',
    [newPinStatus, id]
  );

  return sendSuccess(res, {
    id,
    isPinned: newPinStatus,
    post: updatedRes.rows[0]
  }, `Post ${newPinStatus ? 'pinned to top' : 'unpinned from top'} successfully.`);
}

/**
 * Serve uploaded feed image securely
 * GET /api/v1/feed/images/:filename
 */
async function serveFeedImage(req, res, next) {
  const { filename } = req.params;

  const fileBuffer = await storageService.downloadFile(FEED_IMAGES_FOLDER, filename);

  if (!fileBuffer) {
    return next(new AppError('Feed image not found.', 404, 'IMAGE_NOT_FOUND'));
  }

  return res.send(fileBuffer);
}

module.exports = {
  createPost,
  listPosts,
  getPostById,
  updatePost,
  deletePost,
  togglePinPost,
  serveFeedImage
};
