import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { ELECTRICITY_RATES, senToRM } from '@/constants/electricity-rates'

export async function POST(req: Request) {
  try {
    const { message, targetBill } = await req.json()
    
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Fetch user's appliances if logged in
    let applianceContext = ""
    let currentMonthlyBill = 0
    
    if (user) {
      const { data: appliances } = await supabase
        .from('appliances')
        .select('*')
        .eq('user_id', user.id)

      if (appliances && appliances.length > 0) {
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
            peak_hours: app.peak_usage_hours,
            offpeak_hours: app.off_peak_usage_hours,
            daily_cost: dailyCost,
            monthly_cost: dailyCost * 30
          }
        })

        currentMonthlyBill = applianceData.reduce((sum, app) => sum + app.monthly_cost, 0)
        
        applianceContext = `
USER'S APPLIANCES (from their setup):
${applianceData.map(a => `- ${a.name}: ${a.quantity} unit(s), ${a.watt}W, ${a.peak_hours}h peak + ${a.offpeak_hours}h off-peak daily, ~RM ${a.monthly_cost.toFixed(2)}/month`).join('\n')}

CURRENT ESTIMATED MONTHLY BILL: RM ${currentMonthlyBill.toFixed(2)}
`
      }
    }

    // Check if this is a planning request (has target bill)
    const isPlanningRequest = targetBill && targetBill > 0
    
    const client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    })

    if (isPlanningRequest) {
      // Generate a structured plan
      const planPrompt = `You are an energy optimization AI for PowerPulse, a Malaysian electricity management app.

ELECTRICITY RATES:
- Peak hours (8am-10pm): RM 0.2852/kWh
- Off-peak hours (10pm-8am): RM 0.2443/kWh

${applianceContext}

TARGET MONTHLY BILL: RM ${targetBill}
REQUIRED SAVINGS: RM ${Math.max(0, currentMonthlyBill - targetBill).toFixed(2)}

Create a personalized plan based on the user's request. When they want to INCREASE usage of something, DECREASE other appliances to compensate.

Respond with ONLY valid JSON:
{
  "plan": [
    {
      "name": "Appliance Name",
      "current_hours": "5h peak + 1h off-peak",
      "planned_hours": "3h peak + 3h off-peak", 
      "monthly_savings": 15.50,
      "change": "Shifted 2 hours to off-peak"
    }
  ],
  "projected_bill": 120.00,
  "total_savings": 30.00,
  "explanation": "Friendly 2-3 sentence summary"
}`

      const response = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: planPrompt },
          { role: "user", content: message }
        ],
        temperature: 0.3,
      })

      const aiResponse = response.choices[0].message.content
      
      try {
        const jsonMatch = aiResponse?.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const planData = JSON.parse(jsonMatch[0])
          return NextResponse.json({
            reply: planData.explanation,
            plan: planData,
            currentBill: currentMonthlyBill
          })
        }
      } catch {
        // Fall through to return as text
      }
      
      return NextResponse.json({ reply: aiResponse })
      
    } else {
      // Regular conversational chat
      const chatPrompt = `You are a friendly energy advisor AI for PowerPulse, a Malaysian electricity management app.

ELECTRICITY RATES (Malaysia):
- Peak hours (8am-10pm): RM 0.2852/kWh  
- Off-peak hours (10pm-8am): RM 0.2443/kWh (saves ~14%)

${applianceContext || "The user hasn't set up their appliances yet."}

GUIDELINES:
- Give practical, actionable energy-saving advice
- Reference the user's specific appliances when relevant
- Mention Malaysian-specific tips (TNB rates, hot climate, etc.)
- Keep responses concise but helpful
- If they ask about creating a plan or hitting a target bill, tell them to include their target budget in RM

Be conversational and encouraging!`

      const response = await client.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: chatPrompt },
          { role: "user", content: message }
        ],
        temperature: 0.7,
      })

      return NextResponse.json({
        reply: response.choices[0].message.content,
        currentBill: currentMonthlyBill
      })
    }

  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Failed to get response" }, { status: 500 })
  }
}
