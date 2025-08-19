// Lightweight audit logging helper for Meals, Bazar, Deposits.
// Writes to public.audit_logs if present; fails silently if table is missing.
import { supabase } from './supabaseClient';

/**
 * Log a CRUD action to the audit_logs table. Safe to call even if table doesn't exist.
 * @param {Object} p
 * @param {'meals'|'bazar'|'deposits'} p.table - The table name affected
 * @param {'create'|'update'|'delete'} p.action - The action type
 * @param {string|number|null} [p.rowId] - The primary key of the affected row (if known)
 * @param {any} [p.before] - Object/row state before the action
 * @param {any} [p.after] - Object/row state after the action
 * @param {{id?: string, email?: string}|null} [p.member] - Current actor
 */
export async function logAction({ table, action, rowId = null, before = null, after = null, member = null, source = null }) {
  try {
    const payload = {
      table_name: table,
      action,
      row_id: rowId ?? null,
      actor_member_id: member?.id ?? null,
      actor_email: member?.email ?? null,
  before: before ?? null,
  after: after ?? null,
  source: source ?? null,
    };
    const { error } = await supabase.from('audit_logs').insert([payload]);
    if (error) {
      const msg = String(error.message || '').toLowerCase();
      // If the table or columns don't exist, just skip logging without breaking UX
      if (msg.includes('relation') || msg.includes('does not exist')) return;
      // Soft log to console for other errors
      // eslint-disable-next-line no-console
      console.warn('audit log insert failed:', error.message || error);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('audit log exception:', e?.message || e);
  }
}
