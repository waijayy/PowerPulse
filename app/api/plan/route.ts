import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { ELECTRICITY_RATES, senToRM } from '@/constants/electricity-rates'

export async function POST(req: Request) {
  try {
    const { message, targetBill } = await req.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Please log in to use the planner.' }, { status: 401 })
    }

    // Fetch user's appliances
    const { data: appliances, error } = await supabase
      .from('appliances')
      .select('*')
      .eq('user_id', user.id)

    if (error || !appliances || appliances.length === 0) {
      return NextResponse.json({
        error: 'No appliances found. Please set up your appliances first at /setup'
      }, { status: 400 })
    }

    // Calculate current costs using real rates
    const peakRate = senToRM(ELECTRICITY_RATES.LOW_USAGE.peak)
    const offPeakRate = senToRM(ELECTRICITY_RATES.LOW_USAGE.offPeak)

    const applianceData = appliances.map((app) => {
      const kWh = app.watt / 1000
      const dailyPeakCost = app.quantity * kWh * app.peak_usage_hours * peakRate
      const dailyOffPeakCost = app.quantity * kWh * app.off_peak_usage_hours * offPeakRate
      const dailyCost = dailyPeakCost + dailyOffPeakCost

      return {
        name: app.name,
        quantity: app.quantity,
        watt: app.watt,
        kWh: kWh,
        peak_hours: app.peak_usage_hours,
        offpeak_hours: app.off_peak_usage_hours,
        daily_cost: dailyCost,
        monthly_cost: dailyCost * 30
      }
    })

    const currentMonthlyBill = applianceData.reduce((sum, app) => sum + app.monthly_cost, 0)
    const requiredSavings = Math.max(0, currentMonthlyBill - targetBill)

    // Build the AI prompt
    const systemPrompt = `You are an AI energy optimizer for PowerPulse, a Malaysian electricity management app.

ELECTRICITY RATES (Malaysian Ringgit per kWh):
- Peak hours (8am-10pm): RM ${peakRate.toFixed(4)}/kWh
- Off-peak hours (10pm-8am): RM ${offPeakRate.toFixed(4)}/kWh
- Shifting from peak to off-peak saves about 14%

USER'S CURRENT APPLIANCES:
${applianceData.map(a => `- ${a.name}: ${a.quantity} unit(s), ${a.watt}W (${a.kWh}kWh), currently ${a.peak_hours}h peak + ${a.offpeak_hours}h off-peak daily = RM ${a.monthly_cost.toFixed(2)}/month`).join('\n')}

CURRENT MONTHLY BILL: RM ${currentMonthlyBill.toFixed(2)}
TARGET MONTHLY BILL: RM ${targetBill.toFixed(2)}
REQUIRED SAVINGS: RM ${requiredSavings.toFixed(2)}

YOUR TASK:
Based on the user's request, create an optimized energy plan. 

RULES:
1. If user wants to INCREASE usage of an appliance (e.g., "more AC"), you MUST DECREASE other appliances to compensate
2. ALWAYS try to shift usage to off-peak hours when possible
3. NEVER reduce Refrigerator below 24 hours (always on)
4. Prioritize reducing non-essential appliances (TV, PC, Lights) before essentials
5. The projected_bill MUST be at or below the target

RESPOND WITH ONLY THIS JSON (no other text):
{
  "plan": [
    {
      "name": "Appliance Name",
      "current_hours": "Xh peak + Yh off-peak",
      "planned_hours": "Ah peak + Bh off-peak",
      "planned_peak_hours": 5,
      "planned_off_peak_hours": 2,
      "monthly_savings": 15.50,
      "change": "Brief explanation of change"
    }
  ],
  "projected_bill": 120.00,
  "total_savings": 30.00,
  "explanation": "Friendly 2-3 sentence summary of the plan and key tips"
}`

    const client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    })

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `User request: "${message}"\n\nCreate a plan that accommodates this while keeping the monthly bill under RM ${targetBill}.` }
      ],
      temperature: 0.2,
      max_tokens: 2000,
    })

    const aiResponse = response.choices[0].message.content

    // Parse the JSON response
    try {
      const jsonMatch = aiResponse?.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const planData = JSON.parse(jsonMatch[0])

      // Save to planning table (upsert - will update if user_id exists)
      const { error: planError } = await supabase
        .from('planning')
        .upsert({
          user_id: user.id,
          plan_data: planData
        }, { onConflict: 'user_id' })

      if (planError) {
        console.error('Error saving plan:', planError)
        return NextResponse.json({
          error: `Failed to save plan: ${planError.message}`,
          details: planError
        }, { status: 500 })
      }

      // Update profiles table with expected monthly cost
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          expected_monthly_cost: planData.projected_bill
        })
        .eq('id', user.id)

      if (profileError) console.error('Error updating profile cost:', profileError)

      return NextResponse.json({
        ...planData,
        currentBill: currentMonthlyBill,
        targetBill: targetBill
      })
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse)
      // Return the raw explanation if JSON parsing fails
      return NextResponse.json({
        explanation: aiResponse,
        projected_bill: currentMonthlyBill,
        total_savings: 0,
        plan: []
      })
    }

  } catch (error) {
    console.error('Plan API error:', error)
    return NextResponse.json({ error: 'Failed to generate plan. Please try again.' }, { status: 500 })
  }
}
