'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getAppliances() {
    const supabase = await createClient()
    const { data: appliances, error } = await supabase
        .from('appliances')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching appliances:', error)
        return []
    }

    console.log('Fetched appliances:', appliances?.length)
    return appliances
}

export async function addAppliance(formData: FormData) {
    const supabase = await createClient()
    const name = formData.get('name') as string
    const quantity = parseInt(formData.get('quantity') as string)
    const watt = parseFloat(formData.get('watt') as string) || 0

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        console.error('addAppliance: User not logged in')
        return { error: 'User not logged in' }
    }

    console.log('addAppliance: Adding for user', user.id)

    const { error } = await supabase
        .from('appliances')
        .insert({
            name,
            quantity,
            watt,
            user_id: user.id,
        })

    if (error) {
        console.error('Error adding appliance:', error)
        return { error: 'Failed to add appliance' }
    }

    revalidatePath('/setup')
    return { success: true }
}

export async function updateAppliance(id: number, formData: FormData) {
    const supabase = await createClient()
    const name = formData.get('name') as string
    const quantity = parseInt(formData.get('quantity') as string)
    const watt = parseFloat(formData.get('watt') as string)

    const updateData: any = { name, quantity }
    if (!isNaN(watt)) {
        updateData.watt = watt
    }

    const { error } = await supabase
        .from('appliances')
        .update(updateData)
        .eq('id', id)

    if (error) {
        console.error('Error updating appliance:', error)
        return { error: 'Failed to update appliance' }
    }

    revalidatePath('/setup')
    return { success: true }
}

export async function deleteAppliance(id: number) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('appliances')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting appliance:', error)
        return { error: 'Failed to delete appliance' }
    }

    revalidatePath('/setup')
    return { success: true }
}
