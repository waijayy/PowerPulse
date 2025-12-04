'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updatePassword(formData: FormData) {
    const supabase = await createClient()
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (password !== confirmPassword) {
        return { error: 'Passwords do not match' }
    }

    const { error } = await supabase.auth.updateUser({
        password: password
    })

    if (error) {
        console.error('Error updating password:', error)
        return { error: 'Failed to update password' }
    }

    revalidatePath('/profile')
    return { success: 'Password updated successfully' }
}

export async function updateProfile(formData: FormData) {
    const supabase = await createClient()
    const username = formData.get('username') as string

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    // Update public.profiles table
    const { error } = await supabase
        .from('profiles')
        .upsert({
            id: user.id,
            username,
            updated_at: new Date().toISOString(),
        })

    if (error) {
        console.error('Error updating profile:', error)
        return { error: 'Failed to update profile' }
    }

    revalidatePath('/profile')
    return { success: 'Profile updated successfully' }
}

export async function updateBudget(budget: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'User not logged in' }
    }

    const { error } = await supabase
        .from('profiles')
        .upsert({
            id: user.id,
            monthly_budget_target: budget,
            updated_at: new Date().toISOString(),
        })

    if (error) {
        console.error('Error updating budget:', error)
        return { error: 'Failed to update budget' }
    }

    revalidatePath('/profile')
    return { success: true }
}

export async function updateProfileBill(amount: number, kwh: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'User not logged in' }
    }

    const { error } = await supabase
        .from('profiles')
        .upsert({
            id: user.id,
            total_bill_amount: amount,
            total_kwh_usage: kwh,
            updated_at: new Date().toISOString(),
        })

    if (error) {
        console.error('Error updating bill details:', error)
        return { error: 'Failed to update bill details' }
    }

    revalidatePath('/profile')
    return { success: true }
}
export async function completeSetup(billAmount: number, billKwh: number, budgetTarget: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'User not logged in' }
    }

    const { error } = await supabase
        .from('profiles')
        .upsert({
            id: user.id,
            total_bill_amount: billAmount,
            total_kwh_usage: billKwh,
            monthly_budget_target: budgetTarget,
            updated_at: new Date().toISOString(),
        })

    if (error) {
        console.error('Error completing setup:', error)
        return { error: 'Failed to save setup details' }
    }

    revalidatePath('/dashboard')
    return { success: true }
}

export async function getProfile() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    return data
}
