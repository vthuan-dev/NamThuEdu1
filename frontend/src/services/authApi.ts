/**
 * Authentication API Service
 * 
 * Handles user authentication operations including login, register, and profile
 */

import { api } from './api';
import { AgeGroup } from '../utils/ageDetection';
import { ThemePreference } from '../themes/types';
import { clearAuthData } from '../utils/authStorage';

export interface RegisterFormData {
  name: string;
  phone: string;
  email?: string;
  password: string;
  password_confirmation: string;
}

export interface LoginFormData {
  phone: string;
  password: string;
}

export interface UserProfile {
  id: number;
  name: string;
  phone: string;
  email?: string;
  age: number | null;
  role: string;
  age_group: AgeGroup;
  date_of_birth?: string;
  theme_preference: ThemePreference;
  theme_updated_at?: string;
  class_id?: number | null;
}

export interface AuthResponse {
  status: string;
  data: {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    user: UserProfile;
  };
}

export interface ProfileResponse {
  status: string;
  data: UserProfile;
}

/**
 * Register new user
 */
export async function register(formData: RegisterFormData): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/register', formData);
  return response.data;
}

/**
 * Login user
 */
export async function login(formData: LoginFormData): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/login', formData);
  return response.data;
}

/**
 * Get user profile
 */
export async function getProfile(): Promise<ProfileResponse> {
  const response = await api.get<ProfileResponse>('/user/profile');
  return response.data;
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  try {
    await api.post('/logout');
  } catch {
    // token invalid/expired: still clear local auth state on client
  }
  // Clear auth from BOTH localStorage and sessionStorage.
  // Token may live in sessionStorage when "remember me" is off, so removing
  // only from localStorage would leave a valid token and bounce the user back.
  clearAuthData();
}
