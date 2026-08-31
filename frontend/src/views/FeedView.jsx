import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { listFeedPosts, createFeedPost, togglePinPost, deleteFeedPost } from '../services/api';
import {
  Megaphone,
  Pin,
  Plus,
  Trash2,
  Calendar,
  User,
  Shield,
  Award,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X
} from 'lucide-react';

export default function FeedView({ onOpenAuth }) {
  const { user, isAuthenticated, role } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Post form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState(role === 'CANDIDATE' ? 'CAMPAIGN' : 'ANNOUNCEMENT');
  const [candidatePosition, setCandidatePosition] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [isPinned, setIsPinned] = useState(false);

  const canPost = isAuthenticated && ['ADMINISTRATOR', 'VALIDATOR', 'CANDIDATE'].includes(role);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await listFeedPosts(filterType, '', search);
      const items = res?.data?.items || (Array.isArray(res?.data) ? res.data : []);
      setPosts(items);
    } catch (err) {
      console.error('Failed to load feed posts:', err);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [filterType, search]);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('content', content.trim());
      formData.append('postType', role === 'CANDIDATE' ? 'CAMPAIGN' : postType);
      if (role === 'CANDIDATE' && candidatePosition) {
        formData.append('candidatePosition', candidatePosition.trim());
      }
      if (role === 'ADMINISTRATOR') {
        formData.append('isPinned', isPinned);
      }
      if (imageFile) {
        formData.append('image', imageFile);
      }

      await createFeedPost(formData);

      setSuccess('Post published to feed successfully.');
      setTitle('');
      setContent('');
      setImageFile(null);
      setIsPinned(false);
      setShowModal(false);
      fetchPosts();
    } catch (err) {
      setError(err.message || 'Failed to publish post.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePin = async (id) => {
    try {
      await togglePinPost(id);
      fetchPosts();
    } catch (err) {
      alert(err.message || 'Failed to toggle pin status.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      await deleteFeedPost(id);
      fetchPosts();
    } catch (err) {
      alert(err.message || 'Failed to delete post.');
    }
  };

  const getRoleBadge = (postRole, postType) => {
    if (postRole === 'ADMINISTRATOR') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950/80 text-amber-400 border border-amber-800">
          <Shield className="w-3 h-3" />
          Official Admin Notice
        </span>
      );
    }
    if (postRole === 'VALIDATOR') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-950/80 text-blue-400 border border-blue-800">
          <Shield className="w-3 h-3" />
          Validator Desk Update
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-950/80 text-purple-400 border border-purple-800">
        <Award className="w-3 h-3" />
        Candidate Campaign
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner / Feed Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800">
              <Megaphone className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Departmental Election Feed & Trends</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Real-time official announcements, candidate manifestos, and verified election updates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canPost ? (
            <button
              onClick={() => {
                setPostType(role === 'CANDIDATE' ? 'CAMPAIGN' : 'ANNOUNCEMENT');
                setShowModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/20 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {role === 'CANDIDATE' ? 'Create Campaign Post' : 'Post Announcement'}
            </button>
          ) : !isAuthenticated ? (
            <button
              onClick={() => onOpenAuth('login')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold border border-slate-700 transition"
            >
              Sign In to Participate
            </button>
          ) : null}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
            <button
              onClick={() => setFilterType('')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterType === '' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              All Posts
            </button>
            <button
              onClick={() => setFilterType('ANNOUNCEMENT')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterType === 'ANNOUNCEMENT' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Announcements
            </button>
            <button
              onClick={() => setFilterType('UPDATE')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterType === 'UPDATE' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Updates
            </button>
            <button
              onClick={() => setFilterType('CAMPAIGN')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterType === 'CAMPAIGN' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Campaigns
            </button>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search feed..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>
      </div>

      {/* Feed Stream */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-sm">Loading feed stream...</p>
        </div>
      ) : !Array.isArray(posts) || posts.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800 p-8">
          <Megaphone className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No Feed Posts Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            There are currently no announcements or campaign posts matching your search criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {(Array.isArray(posts) ? posts : []).map((post) => {
            const isOwner = user?.id === post.author_id;
            const isAdmin = role === 'ADMINISTRATOR';

            return (
              <div
                key={post.id}
                className={`relative rounded-2xl border p-5 sm:p-6 transition shadow-lg ${
                  post.is_pinned
                    ? 'bg-slate-900/90 border-amber-600/50 shadow-amber-950/20'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Pinned Ribbon */}
                {post.is_pinned && (
                  <div className="absolute top-0 right-8 -translate-y-1/2 flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500 text-slate-950 shadow">
                    <Pin className="w-3 h-3 fill-current" />
                    Pinned Post
                  </div>
                )}

                {/* Post Header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold overflow-hidden shrink-0">
                      {post.candidate_photo_url ? (
                        <img
                          src={post.candidate_photo_url}
                          alt={post.author_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-slate-400" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-white">{post.author_name}</h4>
                        {getRoleBadge(post.author_role, post.post_type)}
                        {post.candidate_position && (
                          <span className="text-[11px] font-semibold text-purple-300 bg-purple-950/60 border border-purple-800/80 px-2 py-0.2 rounded-full">
                            Running for {post.candidate_position}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(post.published_at || post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions (Admin Pin / Delete) */}
                  <div className="flex items-center gap-1.5">
                    {isAdmin && (
                      <button
                        onClick={() => handleTogglePin(post.id)}
                        title={post.is_pinned ? 'Unpin post' : 'Pin post to top'}
                        className={`p-1.5 rounded-lg border text-xs transition ${
                          post.is_pinned
                            ? 'bg-amber-950/80 text-amber-400 border-amber-800 hover:bg-amber-900'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {(isOwner || isAdmin) && (
                      <button
                        onClick={() => handleDelete(post.id)}
                        title="Delete Post"
                        className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Post Title & Content */}
                <h3 className="text-base sm:text-lg font-bold text-white mb-2 leading-snug">
                  {post.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 whitespace-pre-line leading-relaxed mb-3">
                  {post.content}
                </p>

                {/* Attached Image / Campaign Photo */}
                {post.image_url && (
                  <div 
                    onClick={() => setPreviewImage(post.image_url)}
                    className="mt-3 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/80 flex items-center justify-center p-1.5 cursor-pointer group hover:border-emerald-500/50 transition"
                    title="Click to view full image"
                  >
                    <img
                      src={post.image_url}
                      alt={post.title}
                      className="w-full max-h-[500px] object-contain rounded-xl group-hover:scale-[1.01] transition"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* FULL IMAGE LIGHTBOX MODAL */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 p-2 rounded-full bg-slate-850 text-white hover:bg-slate-750 transition"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewImage}
              alt="Feed Preview"
              className="max-h-[85vh] max-w-full object-contain rounded-2xl border border-slate-800 shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* CREATE POST MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800">
                  <Megaphone className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">
                  {role === 'CANDIDATE' ? 'Publish Campaign Message' : 'Create Official Feed Notice'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Post Type Selector (Admin/Validator Only) */}
              {role !== 'CANDIDATE' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Post Category</label>
                  <select
                    value={postType}
                    onChange={(e) => setPostType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                  >
                    <option value="ANNOUNCEMENT">Official Announcement (Schedules, Rules, Results)</option>
                    <option value="UPDATE">Verification / Notice Update</option>
                  </select>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/60 text-purple-300 text-xs">
                  <p className="font-semibold">Candidate Campaign Post</p>
                  <p className="text-[11px] text-purple-400/80 mt-0.5">
                    Security Rule §17: Candidates are restricted to campaign posts and cannot impersonate administrator notices.
                  </p>
                </div>
              )}

              {role === 'CANDIDATE' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Contesting Position Title</label>
                  <input
                    type="text"
                    placeholder="e.g. President, Vice President, Software Director"
                    value={candidatePosition}
                    onChange={(e) => setCandidatePosition(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Post Headline / Title</label>
                <input
                  type="text"
                  required
                  placeholder="Enter a descriptive title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Post Content / Message</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Write your announcement, manifesto update, or voting instructions..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Attach Image / Picture (Optional JPG, PNG, WEBP)
                </label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={(e) => setImageFile(e.target.files[0] || null)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-400 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-950 file:text-emerald-300 hover:file:bg-emerald-900 transition"
                />
              </div>

              {role === 'ADMINISTRATOR' && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="pinCheckbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-950"
                  />
                  <label htmlFor="pinCheckbox" className="text-xs text-slate-300 cursor-pointer font-medium">
                    Pin this post to the top of the feed
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? 'Publishing...' : 'Publish Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
