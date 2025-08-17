// Helper to fetch global aggregates in a way that is consistent across users.
// Attempts to call an RPC (get_global_aggregates) that should be created in Supabase
// with SECURITY DEFINER so RLS does not restrict totals. Falls back to client-side
// aggregation if the RPC is missing or fails.

export async function fetchGlobalAggregates(supabase) {
  const { data: rows, error } = await supabase.rpc('get_global_aggregates');
  if (!error && rows) {
    const r = Array.isArray(rows) ? rows[0] : rows;
    const totalMealsAll = Number(r?.total_meals ?? 0);
    const totalBazarAll = Number(r?.total_bazar ?? 0);
    const totalDepositsAll = Number(r?.total_deposits ?? 0);
    const totalMembersAll = Number(r?.total_members ?? 0) || 0;
    const mealRate = totalMealsAll > 0 ? totalBazarAll / totalMealsAll : 0;
    return { usedRPC: true, totalMealsAll, totalBazarAll, totalDepositsAll, totalMembersAll, mealRate };
  }

  // Fallback to client-visible aggregation (subject to RLS)
  const [mealsRes, bazarRes, depositsRes, membersHead] = await Promise.all([
    supabase.from('meals').select('meal_count'),
    supabase.from('bazar').select('cost'),
    supabase.from('deposits').select('amount'),
    supabase.from('members').select('id', { count: 'exact', head: true }),
  ]);

  const totalMealsAll = (mealsRes.data || []).reduce((s, r) => s + (Number(r.meal_count) || 0), 0);
  const totalBazarAll = (bazarRes.data || []).reduce((s, r) => s + (Number(r.cost) || 0), 0);
  const totalDepositsAll = (depositsRes.data || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalMembersAll = Number(membersHead?.count) || 0;
  const mealRate = totalMealsAll > 0 ? totalBazarAll / totalMealsAll : 0;

  return {
    usedRPC: false,
    totalMealsAll,
    totalBazarAll,
    totalDepositsAll,
    totalMembersAll,
    mealRate,
  };
}
