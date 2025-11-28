import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { count, error } = await supabase
      .from('appliances')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (!error && count === 0) {
      redirect("/setup")
    }
    
    redirect("/dashboard")
  } else {
    redirect("/login")
  }
}
