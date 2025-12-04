import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    try {
        const { planData, targetBill } = await req.json()

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Please log in to save your plan.' }, { status: 401 })
        }

        if (!planData) {
            return NextResponse.json({ error: 'No plan data provided.' }, { status: 400 })
        }

        // Save to planning table
        const { error: planError } = await supabase
            .from('planning')
            .upsert({
                user_id: user.id,
                plan_data: planData
            }, { onConflict: 'user_id' })

        if (planError) {
            console.error('Error saving plan:', planError)
            return NextResponse.json({ error: 'Failed to save plan to database.' }, { status: 500 })
        }


        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Save Plan API error:', error)
        return NextResponse.json({
            error: `Failed to save plan: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, { status: 500 })
    }
}
