import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getStoredUser,
  setStoredAuth,
  clearStoredAuth,
  loginUser,
  verifyOtp,
  registerUser,
  getCurrentUser,
  logoutUser
} from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        if (localStorage.getItem('sems_access_token')) {
          const res = await getCurrentUser();
          if (res?.data?.user) {
            setUser(res.data.user);
            localStorage.setItem('sems_user', JSON.stringify(res.data.user));
          }
        }
      } catch (err) {
        console.warn('Could not restore auth session:', err.message);
        clearStoredAuth();
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const login = async (email, password) => {
    const res = await loginUser(email, password);
    const token = res?.data?.tokens?.accessToken || res?.data?.accessToken;
    const refreshToken = res?.data?.tokens?.refreshToken || res?.data?.refreshToken;
    const userData = res?.data?.user;
    if (token && userData) {
      setStoredAuth(token, refreshToken, userData);
      setUser(userData);
    }
    return res;
  };

  const submitOtp = async (email, otp) => {
    const res = await verifyOtp(email, otp);
    const token = res?.data?.tokens?.accessToken || res?.data?.accessToken;
    const refreshToken = res?.data?.tokens?.refreshToken || res?.data?.refreshToken;
    const userData = res?.data?.user;
    if (token && userData) {
      setStoredAuth(token, refreshToken, userData);
      setUser(userData);
    }
    return res;
  };

  const register = async (userData) => {
    const res = await registerUser(userData);
    const token = res?.data?.tokens?.accessToken || res?.data?.accessToken;
    const refreshToken = res?.data?.tokens?.refreshToken || res?.data?.refreshToken;
    const userObj = res?.data?.user;
    if (token && userObj) {
      setStoredAuth(token, refreshToken, userObj);
      setUser(userObj);
    }
    return res;
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await getCurrentUser();
      if (res?.data?.user) {
        setUser(res.data.user);
        localStorage.setItem('sems_user', JSON.stringify(res.data.user));
      }
    } catch (err) {
      console.warn('Failed to refresh user profile:', err);
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    role: user?.role || 'GUEST',
    isVerified: Boolean(user?.is_verified || user?.isVerified),
    verificationStatus: user?.verification_status || user?.verificationStatus || 'NONE',
    login,
    submitOtp,
    register,
    logout,
    refreshUser,
    setUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
