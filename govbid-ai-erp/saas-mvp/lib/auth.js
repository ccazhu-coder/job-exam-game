import { supabase } from './supabaseClient';

export async function signInWithEmail(email, password) {
  if (!supabase) return { error: { message: 'Supabase 尚未設定環境變數' } };
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  if (!supabase) return { error: { message: 'Supabase 尚未設定環境變數' } };
  return await supabase.auth.signOut();
}

export async function getCurrentUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}
