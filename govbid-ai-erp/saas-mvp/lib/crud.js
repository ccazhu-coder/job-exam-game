import { supabase } from './supabaseClient';

export async function listRows(table) {
  if (!supabase) return { data: [], error: { message: 'Supabase 尚未設定' } };
  return await supabase.from(table).select('*').order('created_at', { ascending: false });
}

export async function createRow(table, payload) {
  if (!supabase) return { data: null, error: { message: 'Supabase 尚未設定' } };
  return await supabase.from(table).insert(payload).select().single();
}

export async function updateRow(table, id, payload) {
  if (!supabase) return { data: null, error: { message: 'Supabase 尚未設定' } };
  return await supabase.from(table).update(payload).eq('id', id).select().single();
}

export async function deleteRow(table, id) {
  if (!supabase) return { error: { message: 'Supabase 尚未設定' } };
  return await supabase.from(table).delete().eq('id', id);
}
