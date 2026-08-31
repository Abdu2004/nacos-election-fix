import React, { useState, useEffect } from 'react';
import ValidatorPortalView from './ValidatorPortalView';
import {
  listElections,
  createElection,
  deleteElectionAdmin,
  listAllPositions,
  openElection,
  closeElection,
  calculateResults,
  publishResults,
  generateCandidateCodes,
  listCandidateCodes,
  revokeCandidateCode,
  listAuditLogs,
  getAuditSummary,
  exportAuditLogs,
  listAllUsersAdmin,
  createUserAdmin,
  deleteUserAdmin,
  updateUserRole,
  updateUserStatus
} from '../services/api';
import {
  Settings,
  Vote,
  KeyRound,
  FileText,
  Plus,
  Play,
  Square,
  BarChart3,
  Globe,
  Download,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Clock,
  Shield,
  Search,
  Check,
  UserPlus,
  Users,
  Trash2,
  UserCheck,
  Filter,
  ShieldAlert,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function AdminPortalView() {
  const [activeTab, setActiveTab] = useState('elections'); // 'elections', 'users', 'verification', 'codes', 'audit'
  const [elections, setElections] = useState([]);
  const [masterPositions, setMasterPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Election Creation Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [selectedPosIds, setSelectedPosIds] = useState([]);
  const [creating, setCreating] = useState(false);

  // User Management State
  const [usersList, setUsersList] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersRoleFilter, setUsersRoleFilter] = useState('');
  const [usersStatusFilter, setUsersStatusFilter] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  // Create User Modal (Any Role: Voter, Validator, Candidate, Administrator)
  const [showUserModal, setShowUserModal] = useState(false);
  const [userFullName, setUserFullName] = useState('');
  const [userAdmission, setUserAdmission] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState('VOTER');
  const [creatingUser, setCreatingUser] = useState(false);

  // Candidate Code Management State
  const [codes, setCodes] = useState([]);
  const [codeElectionId, setCodeElectionId] = useState('');
  const [codeCount, setCodeCount] = useState(1);
  const [codeRecipientEmail, setCodeRecipientEmail] = useState('');
  const [generatingCodes, setGeneratingCodes] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditSummary, setAuditSummary] = useState(null);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [elecRes, posRes] = await Promise.all([
        listElections(),
        listAllPositions()
      ]);
      const elecList = elecRes?.data?.items || (Array.isArray(elecRes?.data) ? elecRes.data : []);
      setElections(elecList);
      setMasterPositions(posRes?.data?.positions || posRes?.data?.items || (Array.isArray(posRes?.data) ? posRes.data : []));
      if (elecList.length > 0 && !codeElectionId) {
        setCodeElectionId(elecList[0].id);
      }
    } catch (err) {
      setError('Failed to load admin data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'codes' && codeElectionId) {
      fetchCodes();
    } else if (activeTab === 'audit') {
      fetchAudit();
    }
  }, [activeTab, usersPage, usersRoleFilter, usersStatusFilter, codeElectionId, auditActionFilter]);

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await listAllUsersAdmin({
        page: usersPage,
        limit: 15,
        role: usersRoleFilter,
        status: usersStatusFilter,
        search: usersSearch
      });
      setUsersList(res?.data?.items || []);
      setUsersTotal(res?.data?.pagination?.totalItems || 0);
    } catch (err) {
      console.warn(err);
      setUsersList([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchCodes = async () => {
    try {
      const res = await listCandidateCodes(codeElectionId);
      const codeList = res?.data?.codes || res?.data?.items || (Array.isArray(res?.data) ? res.data : []);
      setCodes(codeList);
    } catch (err) {
      console.warn(err);
      setCodes([]);
    }
  };

  const fetchAudit = async () => {
    try {
      const [logsRes, sumRes] = await Promise.all([
        listAuditLogs({ action: auditActionFilter, search: auditSearch }),
        getAuditSummary()
      ]);
      const logsList = logsRes?.data?.items || (Array.isArray(logsRes?.data) ? logsRes.data : []);
      setAuditLogs(logsList);
      setAuditSummary(sumRes?.data || null);
    } catch (err) {
      console.warn(err);
      setAuditLogs([]);
    }
  };

  const handleCreateElection = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      await createElection({
        title: newTitle,
        description: newDesc,
        startDate: newStart,
        endDate: newEnd,
        positionIds: selectedPosIds
      });

      setSuccess('New election initialized in UPCOMING status.');
      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      setSelectedPosIds([]);
      loadAll();
    } catch (err) {
      setError(err.message || 'Failed to create election.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteElection = async (id, title) => {
    if (!confirm(`Are you sure you want to permanently DELETE election '${title}'? This will delete all associated positions, codes, ballots, and results.`)) {
      return;
    }
    try {
      await deleteElectionAdmin(id);
      setSuccess(`Election '${title}' has been deleted.`);
      loadAll();
    } catch (err) {
      alert(err.message || 'Failed to delete election.');
    }
  };

  const handleOpenElection = async (id) => {
    if (!confirm('Are you sure you want to open this election for live voting?')) return;
    try {
      await openElection(id);
      setSuccess('Election is now OPEN for voting.');
      loadAll();
    } catch (err) {
      alert(err.message || 'Failed to open election.');
    }
  };

  const handleCloseElection = async (id) => {
    if (!confirm('Are you sure you want to CLOSE voting for this election?')) return;
    try {
      await closeElection(id);
      setSuccess('Election is now CLOSED.');
      loadAll();
    } catch (err) {
      alert(err.message || 'Failed to close election.');
    }
  };

  const handleCalculate = async (id) => {
    try {
      await calculateResults(id);
      setSuccess('Results tabulated successfully into the database.');
      loadAll();
    } catch (err) {
      alert(err.message || 'Failed to calculate results.');
    }
  };

  const handlePublish = async (id) => {
    if (!confirm('CRITICAL ACTION: Publish official election results to the public? This action cannot be reverted.')) return;
    try {
      await publishResults(id);
      setSuccess('Election results have been officially PUBLISHED and are now accessible to the public.');
      loadAll();
    } catch (err) {
      alert(err.message || 'Failed to publish results.');
    }
  };

  // User Handlers
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setCreatingUser(true);
    try {
      await createUserAdmin({
        fullName: userFullName,
        admissionNumber: userAdmission,
        email: userEmail,
        password: userPassword,
        role: userRole,
        isVerified: true
      });
      setSuccess(`User account created successfully with role ${userRole}.`);
      setShowUserModal(false);
      setUserFullName('');
      setUserAdmission('');
      setUserEmail('');
      setUserPassword('');
      setUserRole('VOTER');
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to create user account.');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (id, name, email) => {
    if (!confirm(`Are you sure you want to delete user '${name}' (${email})? All associated ballots, applications, and documents will be deleted.`)) {
      return;
    }
    try {
      await deleteUserAdmin(id);
      setSuccess(`User account for ${name} successfully deleted.`);
      fetchUsers();
    } catch (err) {
      alert(err.message || 'Failed to delete user account.');
    }
  };

  const handleRoleChange = async (id, newRole) => {
    try {
      await updateUserRole(id, newRole);
      setSuccess(`User role updated to ${newRole}.`);
      fetchUsers();
    } catch (err) {
      alert(err.message || 'Failed to update user role.');
    }
  };

  const handleStatusChange = async (id, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await updateUserStatus(id, newStatus);
      setSuccess(`User status updated to ${newStatus}.`);
      fetchUsers();
    } catch (err) {
      alert(err.message || 'Failed to update user status.');
    }
  };

  const handleGenerateCodes = async (e) => {
    e.preventDefault();
    setGeneratingCodes(true);
    try {
      await generateCandidateCodes(codeElectionId, codeCount, codeRecipientEmail);
      setSuccess(`Generated ${codeCount} candidate code(s).`);
      setCodeRecipientEmail('');
      fetchCodes();
    } catch (err) {
      alert(err.message || 'Failed to generate candidate code.');
    } finally {
      setGeneratingCodes(false);
    }
  };

  const handleRevokeCode = async (codeId) => {
    if (!confirm('Are you sure you want to revoke this candidate code?')) return;
    try {
      await revokeCandidateCode(codeId);
      setSuccess('Candidate code revoked.');
      fetchCodes();
    } catch (err) {
      alert(err.message || 'Failed to revoke code.');
    }
  };

  const handleExportAudit = (format) => {
    window.open(`/api/v1/audit-logs/export?format=${format}`, '_blank');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-950 text-amber-400 border border-amber-800">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">Administrator Command Console</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Manage elections, user directories, verification desks, candidate codes, and audit logs.
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center flex-wrap gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('elections')}
            className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'elections' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Vote className="w-3.5 h-3.5" /> Elections
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'users' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Users
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'verification' ? 'bg-teal-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" /> Verification Desk
          </button>
          <button
            onClick={() => setActiveTab('codes')}
            className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'codes' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" /> Candidate Codes
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'audit' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" /> Audit Logs
          </button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: ELECTIONS HUB */}
      {activeTab === 'elections' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-300">
              Election Lifecycle Management ({elections.length})
            </h3>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Create New Election
            </button>
          </div>

          <div className="space-y-4">
            {elections.map((elec) => (
              <div key={elec.id} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        elec.status === 'OPEN' ? 'bg-emerald-500 text-slate-950' :
                        elec.status === 'UPCOMING' ? 'bg-blue-950 text-blue-400 border border-blue-800' :
                        elec.status === 'CLOSED' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                        'bg-purple-950 text-purple-300 border border-purple-800'
                      }`}>
                        {elec.status}
                      </span>
                      <h4 className="text-base font-bold text-white">{elec.title}</h4>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{elec.description}</p>
                  </div>

                  {/* Lifecycle Controls & Delete */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {elec.status === 'UPCOMING' && (
                      <button
                        onClick={() => handleOpenElection(elec.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" /> Open Voting
                      </button>
                    )}

                    {elec.status === 'OPEN' && (
                      <button
                        onClick={() => handleCloseElection(elec.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center gap-1"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" /> Close Voting
                      </button>
                    )}

                    {elec.status === 'CLOSED' && (
                      <>
                        <button
                          onClick={() => handleCalculate(elec.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1"
                        >
                          <BarChart3 className="w-3.5 h-3.5" /> Tabulate Votes
                        </button>
                        <button
                          onClick={() => handlePublish(elec.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/20 transition flex items-center gap-1"
                        >
                          <Globe className="w-3.5 h-3.5" /> Publish Official Results
                        </button>
                      </>
                    )}

                    {elec.status === 'RESULTS_PUBLISHED' && (
                      <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Results Live & Public
                      </span>
                    )}

                    {/* Delete Election Button */}
                    <button
                      onClick={() => handleDeleteElection(elec.id, elec.title)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-700 text-xs font-bold transition flex items-center gap-1"
                      title="Delete Election"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: USER DIRECTORY & MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-300">
                User & Role Management ({usersTotal})
              </h3>
              <p className="text-xs text-slate-400">Add, search, inspect, promote, or delete system users.</p>
            </div>
            <button
              onClick={() => setShowUserModal(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" /> Add New User
            </button>
          </div>

          {/* Search & Filters */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by name, Gmail, or admission number..."
                value={usersSearch}
                onChange={(e) => setUsersSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={usersRoleFilter}
              onChange={(e) => { setUsersRoleFilter(e.target.value); setUsersPage(1); }}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Roles</option>
              <option value="VOTER">Voters</option>
              <option value="VALIDATOR">Validators</option>
              <option value="CANDIDATE">Candidates</option>
              <option value="ADMINISTRATOR">Administrators</option>
            </select>

            <select
              value={usersStatusFilter}
              onChange={(e) => { setUsersStatusFilter(e.target.value); setUsersPage(1); }}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DEACTIVATED">Deactivated</option>
            </select>

            <button
              onClick={fetchUsers}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Filter
            </button>
          </div>

          {/* Users Table */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            {usersLoading ? (
              <div className="py-12 flex justify-center text-xs text-slate-400 gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-500" /> Loading user directory...
              </div>
            ) : usersList.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-8">No users found matching your filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                      <th className="py-2.5">User</th>
                      <th className="py-2.5">Admission No</th>
                      <th className="py-2.5">Role</th>
                      <th className="py-2.5">Verification</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {usersList.map((u) => (
                      <tr key={u.id}>
                        <td className="py-3">
                          <div className="font-bold text-white">{u.full_name}</div>
                          <div className="text-[11px] text-slate-400">{u.email}</div>
                        </td>
                        <td className="py-3 font-mono text-slate-300">{u.admission_number}</td>
                        <td className="py-3">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-blue-500 font-semibold"
                          >
                            <option value="VOTER">VOTER</option>
                            <option value="VALIDATOR">VALIDATOR</option>
                            <option value="CANDIDATE">CANDIDATE</option>
                            <option value="ADMINISTRATOR">ADMINISTRATOR</option>
                          </select>
                        </td>
                        <td className="py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            u.is_verified || u.verification_status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                            u.verification_status === 'PENDING' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                            'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {u.is_verified ? 'APPROVED' : (u.verification_status || 'UNVERIFIED')}
                          </span>
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => handleStatusChange(u.id, u.status)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition ${
                              u.status === 'ACTIVE'
                                ? 'bg-emerald-950 text-emerald-400 hover:bg-rose-950 hover:text-rose-400'
                                : 'bg-rose-950 text-rose-400 hover:bg-emerald-950 hover:text-emerald-400'
                            }`}
                            title="Click to toggle status"
                          >
                            {u.status}
                          </button>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleDeleteUser(u.id, u.full_name, u.email)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-800 transition"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {usersTotal > 15 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
                <span>Showing page {usersPage} (Total: {usersTotal})</span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={usersPage <= 1}
                    onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg bg-slate-800 disabled:opacity-30 hover:bg-slate-700 text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={usersPage * 15 >= usersTotal}
                    onClick={() => setUsersPage(p => p + 1)}
                    className="p-1.5 rounded-lg bg-slate-800 disabled:opacity-30 hover:bg-slate-700 text-white"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: VERIFICATION DESK */}
      {activeTab === 'verification' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-teal-950/40 border border-teal-800 text-teal-300 text-xs flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-teal-400" />
            <span>Administrator Access: You can directly review and validate voter identity documents and candidate credentials here.</span>
          </div>
          <ValidatorPortalView />
        </div>
      )}

      {/* TAB 4: CANDIDATE CODES */}
      {activeTab === 'codes' && (
        <div className="space-y-6">
          <form onSubmit={handleGenerateCodes} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-400" />
              Generate Candidate Clearance Codes
            </h4>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Election</label>
                <select
                  value={codeElectionId}
                  onChange={(e) => setCodeElectionId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  {elections.map((elec) => (
                    <option key={elec.id} value={elec.id}>{elec.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Number of Codes</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={codeCount}
                  onChange={(e) => setCodeCount(parseInt(e.target.value || '1', 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assign to Gmail (Optional)</label>
                <input
                  type="email"
                  placeholder="candidate@gmail.com"
                  value={codeRecipientEmail}
                  onChange={(e) => setCodeRecipientEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={generatingCodes}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {generatingCodes ? 'Generating...' : 'Generate Secure Code(s)'}
            </button>
          </form>

          {/* Codes Table */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active & Issued Candidate Codes ({codes.length})
            </h4>

            {codes.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No candidate codes generated for this election.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                      <th className="py-2.5">Code</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5">Issued To</th>
                      <th className="py-2.5">Created</th>
                      <th className="py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {codes.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2.5 font-mono text-purple-300 font-bold">{c.code}</td>
                        <td className="py-2.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            c.status === 'UNUSED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                            c.status === 'USED' ? 'bg-blue-950 text-blue-400 border border-blue-800' :
                            'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-400">{c.issued_to_email || 'Unassigned'}</td>
                        <td className="py-2.5 text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
                        <td className="py-2.5 text-right">
                          {c.status === 'UNUSED' && (
                            <button
                              onClick={() => handleRevokeCode(c.id)}
                              className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          {/* Summary Stats */}
          {auditSummary && (
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500">Total System Audit Events</span>
                <p className="text-2xl font-black text-white mt-1">{auditSummary.totalLogs || 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500">Security Alerts Count</span>
                <p className="text-2xl font-black text-rose-400 mt-1">{auditSummary.securityAlertsCount || 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Export Audit Ledger</span>
                  <p className="text-xs text-slate-400 mt-1">Download official CSV or JSON</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleExportAudit('csv')}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition"
                    title="Export CSV"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => handleExportAudit('json')}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition"
                    title="Export JSON"
                  >
                    JSON
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Audit Logs Table */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Immutable Audit Log Stream ({auditLogs.length})
              </h4>
              <input
                type="text"
                placeholder="Search audit actions, emails..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 w-full sm:w-64"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                    <th className="py-2.5">Timestamp</th>
                    <th className="py-2.5">Action</th>
                    <th className="py-2.5">User</th>
                    <th className="py-2.5">Role</th>
                    <th className="py-2.5">Entity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 text-slate-500 text-[11px] whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 font-mono text-emerald-400 font-semibold">{log.action}</td>
                      <td className="py-2.5 text-slate-300">{log.user_email || 'System'}</td>
                      <td className="py-2.5">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 bg-slate-950 px-1.5 py-0.2 rounded border border-slate-800">
                          {log.user_role || 'SYSTEM'}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-400">{log.entity_type || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE ELECTION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
              <h3 className="text-base font-bold text-white">Create New Election Event</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateElection} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Election Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Student Union Government General Election 2026"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Election details, voting instructions, guidelines..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Voting Start Date</label>
                  <input
                    type="datetime-local"
                    required
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Voting End Date</label>
                  <input
                    type="datetime-local"
                    required
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Assign Contested Positions ({selectedPosIds.length} Selected)
                </label>
                <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-xl p-3 bg-slate-950 space-y-1.5">
                  {masterPositions.map((pos) => {
                    const isChecked = selectedPosIds.includes(pos.id);
                    return (
                      <label key={pos.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:text-white">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedPosIds(selectedPosIds.filter(id => id !== pos.id));
                            } else {
                              setSelectedPosIds([...selectedPosIds, pos.id]);
                            }
                          }}
                          className="rounded border-slate-700 text-emerald-500 bg-slate-900"
                        />
                        <span>{pos.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20"
                >
                  {creating ? 'Creating...' : 'Create Election Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
              <h3 className="text-base font-bold text-white">Create New System User</h3>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">User Role</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="VOTER">VOTER (Student Voter)</option>
                  <option value="VALIDATOR">VALIDATOR (Verification Staff)</option>
                  <option value="CANDIDATE">CANDIDATE (Contestant)</option>
                  <option value="ADMINISTRATOR">ADMINISTRATOR (System Admin)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maryam Abubakar"
                  value={userFullName}
                  onChange={e => setUserFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Admission / Staff Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ADM/2026/045"
                  value={userAdmission}
                  onChange={e => setUserAdmission(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Registered Gmail</label>
                <input
                  type="email"
                  required
                  placeholder="user@gmail.com"
                  value={userEmail}
                  onChange={e => setUserEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={userPassword}
                  onChange={e => setUserPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20"
                >
                  {creatingUser ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
