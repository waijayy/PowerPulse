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
