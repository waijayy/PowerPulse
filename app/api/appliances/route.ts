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

    return NextResponse.json({ appliances })
  } catch (error) {
    console.error('Appliances API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

