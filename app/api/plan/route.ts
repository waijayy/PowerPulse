import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { calculatePersonalizedPlan } from '@/utils/plan-calculator'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' })

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

    // Fetch billing profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_bill_amount, monthly_budget_target')
      .eq('id', user.id)
      .single()

    const lastMonthBill = profile?.total_bill_amount ?? 0
    const effectiveTargetBill = profile?.monthly_budget_target ?? targetBill ?? 150

    let planData;

    if (message) {
      if (!process.env.GROQ_API_KEY) {
        console.error('GROQ_API_KEY is missing')
        return NextResponse.json({ error: 'AI service is not configured (missing API key).' }, { status: 500 })
      }

      // AI Chat Mode: Adjust existing plan
      // Fetch the current plan from DB to use as context
      const { data: existingPlanData } = await supabase
        .from('planning')
        .select('plan_data')
        .eq('user_id', user.id)
        .single()

      let currentPlanContext = existingPlanData?.plan_data

      // If no existing plan, generate a fresh one first
      if (!currentPlanContext) {
        const calculatedPlan = calculatePersonalizedPlan(
          appliances.map((app) => ({
            name: app.name,
            quantity: app.quantity,
            watt: app.watt,
            peak_usage_hours: app.peak_usage_hours,
            off_peak_usage_hours: app.off_peak_usage_hours,
            usage_start_time: app.usage_start_time,
            usage_end_time: app.usage_end_time,
          })),
          lastMonthBill,
          effectiveTargetBill
        )
        // We need to format it to match the structure expected by AI/Frontend
        currentPlanContext = {
          plan: calculatedPlan.plan.map((item) => ({
            name: item.name,
            planned_peak_hours_weekday: item.planned_peak_hours_weekday,
            planned_off_peak_hours_weekday: item.planned_offpeak_hours_weekday,
            planned_peak_hours_weekend: item.planned_peak_hours_weekend,
            planned_offpeak_hours_weekend: item.planned_offpeak_hours_weekend,
            suggested_time_weekday: item.suggested_time_weekday,
            suggested_time_weekend: item.suggested_time_weekend,
            monthly_savings: item.monthly_savings,
            change: 'Optimized for target bill'
          })),
          projected_bill: calculatedPlan.projected_bill,
          total_savings: calculatedPlan.total_savings
        }
      }


      // Build enhanced current plan with all necessary context
      const enhancedPlanContext = {
        ...currentPlanContext,
        plan: currentPlanContext.plan.map((planItem: any) => {
          const appliance = appliances.find(app => app.name === planItem.name)

          // Calculate current averaged hours from the plan (what's shown in UI)
          const currentAvgPeak = (
            (planItem.planned_peak_hours_weekday || 0) * 5 +
            (planItem.planned_peak_hours_weekend || 0) * 2
          ) / 7
          const currentAvgOffPeak = (
            (planItem.planned_off_peak_hours_weekday || 0) * 5 +
            (planItem.planned_offpeak_hours_weekend || 0) * 2
          ) / 7

          return {
            ...planItem,
            watt: appliance?.watt || 0,
            quantity: appliance?.quantity || 1,
            last_month_peak_hours: appliance?.peak_usage_hours || 0,
            last_month_offpeak_hours: appliance?.off_peak_usage_hours || 0,
            // Add explicit current values for AI clarity
            current_avg_peak_hours: Math.round(currentAvgPeak * 10) / 10,
            current_avg_offpeak_hours: Math.round(currentAvgOffPeak * 10) / 10
          }
        })
      }

      const systemPrompt = `You are an energy planning assistant for PowerPulse.
      
      BILLING CONTEXT:
      - Previous Month Bill: $${lastMonthBill}
      - Target Next Month Bill: $${effectiveTargetBill}
      - Required Savings: $${lastMonthBill - effectiveTargetBill}
      
      CURRENT PERSONALIZED PLAN (Your baseline to adjust):
      ${JSON.stringify(enhancedPlanContext, null, 2)}
      
      User Request: "${message}"
      
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      CRITICAL INSTRUCTIONS:
      
      ⚠️ BASELINE VALUES TO USE:
      For each appliance, the CURRENT plan values are the SPECIFIC weekday/weekend breakdowns:
      - planned_peak_hours_weekday (e.g., for Computer/PC it's 1.2h)
      - planned_off_peak_hours_weekday (e.g., for Computer/PC it's 1.7h)
      - planned_peak_hours_weekend (always 0 - weekends have no peak)
      - planned_offpeak_hours_weekend (e.g., for Computer/PC it's 1.4h)
      
      YOU MUST adjust from these CURRENT SPECIFIC VALUES, NOT from last_month values or averaged values!
      
      STEPS:
      1. Look at each appliance's CURRENT weekday/weekend breakdown values
      2. Modify the specific weekday/weekend hours according to user request
      3. INCREMENT RULE: If user asks to "use more" without specifying an amount, increase by ONLY 1.0 to 1.5 hours total. DO NOT increase more than this unless explicitly asked.
      4. TRADE-OFF RULE: If you increase usage of one appliance, you MUST DECREASE usage of other high-wattage appliances (like Water Heater, Washing Machine, etc.) to compensate.
      5. PRIORITIZE reducing HIGH WATTAGE appliances first (check 'watt' value) for maximum impact.
      6. Keep hours reasonable (weekday peak: 0-8h, weekday off-peak: 0-16h, weekend: 0-24h all off-peak)
      
      CONSTRAINTS per appliance:
      - Refrigerator: MUST NOT BE CHANGED. It must run 24 hours/day (Weekday: 8h peak + 16h off-peak, Weekend: 24h off-peak). DO NOT REDUCE THIS.
      - Weekday Peak Hours: 0-8h (rate: $0.2583/kWh, 2pm-10pm)
      - Weekday Off-Peak Hours: 0-16h (rate: $0.2443/kWh, 10pm-2pm next day)
      - Weekend: all off-peak (0-24h)
      
      BUDGET GOAL:
      - The projected_bill should be close to the current bill.
      - It is acceptable if it increases slightly, but it MUST NOT exceed the Target Bill ($${effectiveTargetBill}) significantly.
      
      CALCULATIONS:
      - Monthly savings = (last_month_peak - new_peak) × watt × 0.57 × 30 / 1000
                        + (last_month_offpeak - new_offpeak) × watt × 0.33 × 30 / 1000
      - Projected bill = Previous Bill - Total Savings
      
      UPDATE 'change' field: Describe changes from CURRENT plan using SPECIFIC values
      (e.g., "Weekday: 1.2h→1.0h peak, 1.7h→2.0h off-peak")
      
      OUTPUT JSON:
      {
        "plan": [
          {
            "name": "string",
            "planned_peak_hours_weekday": number,
            "planned_off_peak_hours_weekday": number,
            "planned_peak_hours_weekend": number,
            "planned_offpeak_hours_weekend": number,
            "suggested_time_weekday": "string",
            "suggested_time_weekend": "string",
            "monthly_savings": number,
            "change": "string"
          }
        ],
        "projected_bill": number,
        "total_savings": number,
        "explanation": "string"
      }
      `

      // Debug logging
      console.log('========== AI DEBUGGING ==========')
      console.log('Enhanced Plan Context:', JSON.stringify(enhancedPlanContext, null, 2))
      console.log('User Message:', message)
      console.log('==================================')

      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' }
      })

      const content = completion.choices[0].message.content
      if (!content) {
        throw new Error('AI returned empty content')
      }
      const aiResponse = JSON.parse(content)

      // Post-process to ensure all fields are present (like current_hours strings)
      // Use the CURRENT PLAN's weekday/weekend breakdown values as the baseline
      // This ensures the AI shows what's currently displayed on plan/page.tsx
      const aiPlan = aiResponse.plan || []

      // Debug: Log available plan names
      console.log('========== NAME MATCHING DEBUG ==========')
      console.log('Enhanced Plan Context names:', enhancedPlanContext.plan.map((p: any) => p.name))
      console.log('AI Response plan names:', aiPlan.map((p: any) => p.name))
      console.log('=========================================')

      const formattedPlan = aiPlan.map((item: any) => {
        // Find the current plan item to get the CURRENT weekday/weekend breakdown
        // Use flexible matching: exact match first, then case-insensitive, then partial match
        let currentPlanItem = enhancedPlanContext.plan.find((p: any) => p.name === item.name)

        if (!currentPlanItem) {
          // Try case-insensitive match
          currentPlanItem = enhancedPlanContext.plan.find((p: any) =>
            p.name.toLowerCase() === item.name.toLowerCase()
          )
        }

        if (!currentPlanItem) {
          // Try partial match (contains)
          currentPlanItem = enhancedPlanContext.plan.find((p: any) =>
            p.name.toLowerCase().includes(item.name.toLowerCase()) ||
            item.name.toLowerCase().includes(p.name.toLowerCase())
          )
        }

        console.log(`Matching "${item.name}": ${currentPlanItem ? 'FOUND' : 'NOT FOUND'}`, currentPlanItem?.name)

        // Use current plan's WEEKDAY breakdown as "current_hours" (what's shown in plan UI)
        const currentPeakWeekday = currentPlanItem?.planned_peak_hours_weekday || 0
        const currentOffPeakWeekday = currentPlanItem?.planned_off_peak_hours_weekday || 0
        const currentOffPeakWeekend = currentPlanItem?.planned_offpeak_hours_weekend || 0

        // Format: Show weekday breakdown and weekend breakdown separately for clarity
        const plannedHoursFormatted = `Weekday: ${item.planned_peak_hours_weekday.toFixed(1)}h peak + ${item.planned_off_peak_hours_weekday.toFixed(1)}h off-peak\nWeekend: ${(item.planned_offpeak_hours_weekend || 0).toFixed(1)}h off-peak`

        const avgPeak = (item.planned_peak_hours_weekday * 5 + (item.planned_peak_hours_weekend || 0) * 2) / 7
        const avgOffPeak = (item.planned_off_peak_hours_weekday * 5 + (item.planned_offpeak_hours_weekend || 0) * 2) / 7

        return {
          name: item.name,
          current_hours: `Weekday: ${currentPeakWeekday.toFixed(1)}h peak + ${currentOffPeakWeekday.toFixed(1)}h off-peak | Weekend: ${currentOffPeakWeekend.toFixed(1)}h`,
          planned_hours: plannedHoursFormatted,
          planned_peak_hours: Math.round(avgPeak * 10) / 10,
          planned_off_peak_hours: Math.round(avgOffPeak * 10) / 10,
          monthly_savings: item.monthly_savings,
          change: item.change || 'Optimized for target bill',
          planned_peak_hours_weekday: item.planned_peak_hours_weekday,
          planned_off_peak_hours_weekday: item.planned_off_peak_hours_weekday,
          planned_peak_hours_weekend: item.planned_peak_hours_weekend || 0,
          planned_offpeak_hours_weekend: item.planned_offpeak_hours_weekend || 0,
          suggested_time_weekday: item.suggested_time_weekday,
          suggested_time_weekend: item.suggested_time_weekend
        }
      })

      planData = {
        plan: formattedPlan,
        projected_bill: aiResponse.projected_bill,
        total_savings: aiResponse.total_savings,
        explanation: aiResponse.explanation
      }

    } else {
      // Calculator Mode: Generate fresh plan
      const calculatedPlan = calculatePersonalizedPlan(
        appliances.map((app) => ({
          name: app.name,
          quantity: app.quantity,
          watt: app.watt,
          peak_usage_hours: app.peak_usage_hours,
          off_peak_usage_hours: app.off_peak_usage_hours,
          usage_start_time: app.usage_start_time,
          usage_end_time: app.usage_end_time,
        })),
        lastMonthBill,
        effectiveTargetBill
      )

      const formattedPlan = calculatedPlan.plan.map((item) => {
        const avgPeak = (item.planned_peak_hours_weekday * 5 + item.planned_peak_hours_weekend * 2) / 7
        const avgOffPeak = (item.planned_offpeak_hours_weekday * 5 + item.planned_offpeak_hours_weekend * 2) / 7

        return {
          name: item.name,
          current_hours: `${item.last_month_peak_hours.toFixed(1)}h peak + ${item.last_month_offpeak_hours.toFixed(1)}h off-peak`,
          planned_hours: `${avgPeak.toFixed(1)}h peak + ${avgOffPeak.toFixed(1)}h off-peak`,
          planned_peak_hours: Math.round(avgPeak * 10) / 10,
          planned_off_peak_hours: Math.round(avgOffPeak * 10) / 10,
          monthly_savings: Math.round(item.monthly_savings * 10) / 10,
          change: `Optimized for target bill`,
          planned_peak_hours_weekday: item.planned_peak_hours_weekday,
          planned_off_peak_hours_weekday: item.planned_offpeak_hours_weekday,
          planned_peak_hours_weekend: item.planned_peak_hours_weekend,
          planned_offpeak_hours_weekend: item.planned_offpeak_hours_weekend,
          suggested_time_weekday: item.suggested_time_weekday,
          suggested_time_weekend: item.suggested_time_weekend,
        }
      })

      planData = {
        plan: formattedPlan,
        projected_bill: calculatedPlan.projected_bill,
        total_savings: calculatedPlan.total_savings,
        explanation: calculatedPlan.explanation,
      }
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
    }

    // Update profiles table with expected monthly cost
    await supabase
      .from('profiles')
      .update({
        expected_monthly_cost: planData.projected_bill
      })
      .eq('id', user.id)

    return NextResponse.json({
      ...planData,
      currentBill: lastMonthBill,
      targetBill: effectiveTargetBill,
      lastMonthBill
    })

  } catch (error) {
    console.error('Plan API error:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    return NextResponse.json({
      error: `Failed to generate plan: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 })
  }
}
