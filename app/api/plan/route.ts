import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { calculatePersonalizedPlan } from '@/utils/plan-calculator'

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

    // Fetch billing profile (last month bill + target bill)
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_bill_amount, monthly_budget_target')
      .eq('id', user.id)
      .single()

    const lastMonthBill = profile?.total_bill_amount ?? 0
    const effectiveTargetBill = profile?.monthly_budget_target ?? targetBill ?? 150

    // Calculate current costs using given peak/off-peak rates (RM/kWh)
    const peakRate = 0.2583
    const offPeakRate = 0.2443

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
        usage_start_time: app.usage_start_time,
        usage_end_time: app.usage_end_time,
        daily_cost: dailyCost,
        monthly_cost: dailyCost * 30
      }
    })

    const currentMonthlyBill = applianceData.reduce((sum, app) => sum + app.monthly_cost, 0)
    const baselineBill = lastMonthBill > 0 ? lastMonthBill : currentMonthlyBill
    const requiredSavings = Math.max(0, baselineBill - effectiveTargetBill)

    // Use smart calculator to generate base plan based on target
    const calculatedPlan = calculatePersonalizedPlan(
      appliances.map((app) => ({
        name: app.name,
        quantity: app.quantity,
        watt: app.watt,
        peak_usage_hours: app.peak_usage_hours,
        off_peak_usage_hours: app.off_peak_usage_hours,
      })),
      lastMonthBill,
      effectiveTargetBill
    )

    // Format calculator result to match expected plan format
    const formattedPlan = calculatedPlan.plan.map((item) => {
      // Use weekday hours for display (or average if needed)
      const avgPeak = (item.planned_peak_hours_weekday * 5 + item.planned_peak_hours_weekend * 2) / 7
      const avgOffPeak = (item.planned_offpeak_hours_weekday * 5 + item.planned_offpeak_hours_weekend * 2) / 7
      
      return {
        name: item.name,
        current_hours: `${item.last_month_peak_hours}h peak + ${item.last_month_offpeak_hours}h off-peak`,
        planned_hours: `${avgPeak.toFixed(1)}h peak + ${avgOffPeak.toFixed(1)}h off-peak`,
        planned_peak_hours: Math.round(avgPeak * 10) / 10,
        planned_off_peak_hours: Math.round(avgOffPeak * 10) / 10,
        monthly_savings: item.monthly_savings,
        change: `Reduced from ${item.last_month_peak_hours}h peak + ${item.last_month_offpeak_hours}h off-peak to optimize for target bill`,
        // Include weekday/weekend breakdown for frontend
        planned_peak_hours_weekday: item.planned_peak_hours_weekday,
        planned_off_peak_hours_weekday: item.planned_offpeak_hours_weekday,
        planned_peak_hours_weekend: item.planned_peak_hours_weekend,
        planned_off_peak_hours_weekend: item.planned_offpeak_hours_weekend,
      }
    })

    // If user has a specific message request, use AI to refine, otherwise use calculator result
    const hasSpecificRequest = message && message.trim().length > 0 && 
      !message.toLowerCase().includes('optimize') && 
      !message.toLowerCase().includes('target')

    if (hasSpecificRequest) {
      // Use AI to refine based on user request
      // Build the AI prompt
    const systemPrompt = `You are an AI energy optimizer for PowerPulse, a Malaysian electricity management app.

ELECTRICITY RATES (Malaysian Ringgit per kWh):
- Peak hours (8am-10pm): RM ${peakRate.toFixed(4)}/kWh
- Off-peak hours (10pm-8am): RM ${offPeakRate.toFixed(4)}/kWh
- Shifting from peak to off-peak saves money because off-peak is cheaper

USER'S CURRENT APPLIANCES (FROM DATABASE):
${applianceData.map(a => `- ${a.name}: ${a.quantity} unit(s), ${a.watt}W (${a.kWh}kWh), scheduled ${a.usage_start_time || 'N/A'} to ${a.usage_end_time || 'N/A'} daily, currently ${a.peak_hours}h peak + ${a.offpeak_hours}h off-peak daily = RM ${a.monthly_cost.toFixed(2)}/month`).join('\n')}

MODEL BASELINE:
- Last month's actual bill (from user profile): RM ${lastMonthBill.toFixed(2)}
- Modelled bill from current appliance usage: RM ${currentMonthlyBill.toFixed(2)}
- Baseline used for planning (max of the two): RM ${baselineBill.toFixed(2)}

TARGET MONTHLY BILL (from user profile if available): RM ${effectiveTargetBill.toFixed(2)}
REQUIRED SAVINGS: RM ${requiredSavings.toFixed(2)}

YOUR TASK:
Based on the user's request, create an optimized energy plan. 

RULES:
1. If user wants to INCREASE usage of an appliance (e.g., "more AC"), you MUST DECREASE other appliances to compensate.
2. ALWAYS try to shift usage to off-peak hours when possible, especially for non-essential loads.
3. NEVER reduce Refrigerator below 24 hours (always on) – keep most of its energy in off-peak hours as much as practical.
4. Prioritize reducing non-essential appliances (TV, PC, Lights) before essentials.
5. The projected_bill MUST be at or below the target monthly bill.
6. DO NOT give every appliance the same planned hours. Tailor planned_peak_hours and planned_off_peak_hours to each appliance's type, wattage and current schedule. High-watt appliances (like AC) should usually have more aggressive off-peak shifting than low-watt appliances (like LED lights).

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
        { role: "user", content: `User request: "${message}"\n\nCreate a plan that accommodates this while keeping the monthly bill under RM ${effectiveTargetBill}.` }
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
        currentBill: baselineBill,
        targetBill: effectiveTargetBill,
        lastMonthBill
      })
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse)
      // Fall back to calculator result if AI fails
      const planData = {
        plan: formattedPlan,
        projected_bill: calculatedPlan.projected_bill,
        total_savings: calculatedPlan.total_savings,
        explanation: calculatedPlan.explanation,
      }

      // Save calculator plan
      await supabase
        .from('planning')
        .upsert({
          user_id: user.id,
          plan_data: planData
        }, { onConflict: 'user_id' })

      await supabase
        .from('profiles')
        .update({
          expected_monthly_cost: calculatedPlan.projected_bill
        })
        .eq('id', user.id)

      return NextResponse.json({
        ...planData,
        currentBill: baselineBill,
        targetBill: effectiveTargetBill,
        lastMonthBill
      })
    }
    } else {
      // No specific request, use calculator result directly
      const planData = {
        plan: formattedPlan,
        projected_bill: calculatedPlan.projected_bill,
        total_savings: calculatedPlan.total_savings,
        explanation: calculatedPlan.explanation,
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
        return NextResponse.json({
          error: `Failed to save plan: ${planError.message}`,
          details: planError
        }, { status: 500 })
      }

      // Update profiles table with expected monthly cost
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          expected_monthly_cost: calculatedPlan.projected_bill
        })
        .eq('id', user.id)

      if (profileError) console.error('Error updating profile cost:', profileError)

      return NextResponse.json({
        ...planData,
        currentBill: baselineBill,
        targetBill: effectiveTargetBill,
        lastMonthBill
      })
    }

  } catch (error) {
    console.error('Plan API error:', error)
    return NextResponse.json({ error: 'Failed to generate plan. Please try again.' }, { status: 500 })
  }
}
