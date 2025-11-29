import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: appliances, error } = await supabase
      .from('appliances')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching appliances:', error)
      return NextResponse.json({ error: 'Failed to fetch appliances' }, { status: 500 })
    }

    // Fetch profile data for bill info
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_bill_amount, monthly_budget_target, expected_monthly_cost')
      .eq('id', user.id)
      .single()

    // Fetch saved planning data
    const { data: planning } = await supabase
      .from('planning')
      .select('plan_data')
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({
      appliances,
      profile: profile || { total_bill_amount: 0, monthly_budget_target: 150, expected_monthly_cost: 0 },
      planning: planning?.plan_data || null
    })
  } catch (error) {
    console.error('Appliances API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
