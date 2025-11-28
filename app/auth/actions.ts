'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        console.error('Login error:', error)
        if (error.code === 'email_not_confirmed') {
            redirect('/login?error=Please check your email to confirm your account')
        }
        redirect('/login?error=Could not authenticate user')
    }

    revalidatePath('/', 'layout')
    redirect('/')
}

export async function signup(formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const username = formData.get('username') as string

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                username,
            },
        },
    })

    if (error) {
        console.error('Signup error:', error)
        redirect('/login?error=Could not authenticate user')
    }

    // Check if session was created (email confirmation might be required)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
        console.log('Signup successful but no session (check email confirmation)')
    } else {
        console.log('Signup successful, session created')

        // Save username to profiles
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: session.user.id,
                username: username,
                updated_at: new Date().toISOString(),
            })

        if (profileError) {
            console.error('Error creating profile:', profileError)
            // Continue anyway, as auth is successful
        }
    }

    revalidatePath('/', 'layout')
    redirect('/setup')
}

export async function signout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    redirect('/login')
}
