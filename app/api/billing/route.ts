import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("total_bill_amount, monthly_budget_target")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching billing summary:", error);
      return NextResponse.json(
        { error: "Failed to fetch billing summary" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      lastMonthBill: data?.total_bill_amount ?? 0,
      targetBill: data?.monthly_budget_target ?? 150,
    });
  } catch (err) {
    console.error("Billing API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

