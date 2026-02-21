'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { BottomNav } from '@/components/navigation/bottom-nav'
import { TopNavMobile } from '@/components/navigation/top-nav-mobile'
import Link from 'next/link'
import { User, Building2, MapPin, Mail, ImageIcon, Lock, LogOut, Sparkles, ChevronRight } from 'lucide-react'
import { EditProfileModal } from '@/components/profile/edit-profile-modal'
import { ChangePasswordModal } from '@/components/profile/change-password-modal'
import { UploadLogoModal } from '@/components/profile/upload-logo-modal'
import { showError, showSuccess } from '@/lib/toast'
import { ProfileSkeleton } from '@/components/skeletons/profile-skeleton'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface Profile {
  username: string
  business_name: string
  address: string
  logo_url: string | null
  created_at: string
}

export function ProfilePageClient() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [hasBusinessBio, setHasBusinessBio] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push('/auth/login')
        return
      }
      setUser(user)

      // Retry profile fetch — for new users the handle_new_user trigger
      // may still be running when we first hit the profile page.
      let profileData = null
      const maxRetries = 3
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) {
          console.error('Profile fetch error:', error.message, error.code, error.hint)
          setProfile(null)
          return
        }

        if (data) {
          profileData = data
          break
        }

        // No data yet — wait before retrying so the trigger can finish
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
        }
      }

      if (!profileData) {
        // All retries returned nothing — create the profile row ourselves
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            email: user.email || '',
            username: user.user_metadata?.username || user.email?.split('@')[0] || '',
            business_name: '',
            address: '',
          })
          .select()
          .single()

        if (insertError) {
          console.error('Profile auto-create error:', insertError.message)
          setProfile(null)
          return
        }
        setProfile(newProfile)
      } else {
        setProfile(profileData)
      }
      // Check if business bio exists
      try {
        const bioRes = await fetch('/api/business-profile')
        if (bioRes.ok) {
          const bioData = await bioRes.json()
          setHasBusinessBio(
            bioData?.profile_completed === true ||
            (bioData?.business_context && Object.keys(bioData.business_context).length > 0)
          )
        }
      } catch {
        // Silently ignore — business_profiles table may not exist
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (field: string, value: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          [field]: value,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      if (error) {
        console.error('❌ Update error:', error)
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        throw error
      }

      await loadProfile()
      setEditingField(null)
    } catch (error: unknown) {
      console.error('❌ Failed to update profile:', error)
      // Handle both Error instances and Supabase PostgrestError objects
      const err = error as { message?: string; code?: string }
      const errorMessage = err?.message || 'Unknown error'
      showError(`Failed to update profile: ${errorMessage}`)
    }
  }

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut()

      if (error) {
        showError('Failed to logout: ' + error.message)
        return
      }

      // Show success message
      showSuccess('Logged out successfully')

      // Redirect to login page
      router.push('/auth/login')

    } catch (error: unknown) {
      console.error('Logout error:', error)
      showError('Failed to logout')
    } finally {
      setIsLoggingOut(false)
      setShowLogoutConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f0f23] to-[#1a1a2e] text-white pb-24 md:pb-8">
        <SiteHeader />
        <TopNavMobile />
        <div className="container mx-auto px-4 pt-2 pb-24 md:p-6 max-w-3xl">
          <ProfileSkeleton />
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0f23] to-[#1a1a2e] text-white pb-24 md:pb-8">
      <SiteHeader />
      <TopNavMobile />

      <div className="container mx-auto px-4 pt-2 pb-24 md:p-6 max-w-3xl">
        {/* Page Header */}
        <div className="mt-2 mb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-white">Profile</h1>
        </div>

        {/* Header with Logo */}
        <div className="bg-gradient-to-r from-purple-900/40 to-purple-800/40 rounded-lg p-8 mb-6 text-center border border-purple-500/30">
          <div className="flex flex-col items-center gap-4">
            {/* Logo/Avatar */}
            <div className="relative">
              {profile?.logo_url ? (
                <img
                  src={profile.logo_url}
                  alt="Business Logo"
                  className="w-24 h-24 rounded-full object-cover border-4 border-purple-500"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-purple-700 flex items-center justify-center border-4 border-purple-500">
                  <Building2 className="w-12 h-12 text-white" />
                </div>
              )}
            </div>

            {/* Business Name & Username */}
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                {profile?.business_name || 'My Business'}
              </h1>
              <p className="text-purple-300">
                {profile?.username || user?.email?.split('@')[0]}
              </p>
            </div>
          </div>
        </div>

        {/* Profile Fields */}
        <div className="space-y-4">
          {/* Username */}
          <ProfileField
            icon={<User className="w-5 h-5" />}
            label="Username"
            value={profile?.username || ''}
            onEdit={() => setEditingField('username')}
          />

          {/* Business Name */}
          <ProfileField
            icon={<Building2 className="w-5 h-5" />}
            label="Business Name"
            value={profile?.business_name || ''}
            onEdit={() => setEditingField('business_name')}
          />

          {/* Address */}
          <ProfileField
            icon={<MapPin className="w-5 h-5" />}
            label="Address"
            value={profile?.address || ''}
            onEdit={() => setEditingField('address')}
          />

          {/* Admin Email */}
          <ProfileField
            icon={<Mail className="w-5 h-5" />}
            label="Admin Email"
            value={user?.email || ''}
            onEdit={null}
            helper="Contact admin to change email"
          />

          {/* Logo */}
          <ProfileField
            icon={<ImageIcon className="w-5 h-5" />}
            label="Logo"
            value={profile?.logo_url ? 'Logo uploaded' : 'No logo'}
            onEdit={() => setEditingField('logo')}
          />

          {/* Password */}
          <ProfileField
            icon={<Lock className="w-5 h-5" />}
            label="Password"
            value="••••••••"
            onEdit={() => setEditingField('password')}
            buttonText="Change"
          />

          {/* Logout Button */}
          <div className="mt-8">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              disabled={isLoggingOut}
              className="w-full max-w-md mx-auto px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center gap-2 transition-colors font-medium"
              aria-label="Logout"
            >
              <LogOut className="w-5 h-5" />
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>

          {/* Business Bio Button */}
          <div className="mt-4">
            <Link href="/profile/business-bio">
              <button className="w-full flex items-center justify-between bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 hover:border-purple-500/60 rounded-2xl px-6 py-4 transition-all duration-200 group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#8b5cf6]/20 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-medium">Business Bio</p>
                    <p className="text-white/50 text-xs">Help Donna know your business</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasBusinessBio ? (
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                      ✓ Added
                    </span>
                  ) : (
                    <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">
                      Optional
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/70 transition-colors" />
                </div>
              </button>
            </Link>
          </div>

          {/* Account Info */}
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-6 mt-6">
            <p className="text-purple-300 text-sm">
              Member since {new Date(profile?.created_at || '').toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
        </div>
      </div>

      <BottomNav />

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLogoutConfirm(false)
            }
          }}
        >
          <div className="bg-secondary border border-purple-500/30 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              Confirm Logout
            </h2>
            <p className="text-purple-200 mb-6">
              Are you sure you want to logout?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
                className="flex-1 px-4 py-2 bg-purple-900/30 hover:bg-purple-900/50 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
              >
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Edit Modals */}
      {editingField && editingField !== 'password' && editingField !== 'logo' && (
        <EditProfileModal
          field={editingField}
          currentValue={profile?.[editingField as keyof Profile] as string || ''}
          onSave={(value) => handleUpdate(editingField, value)}
          onClose={() => setEditingField(null)}
        />
      )}

      {editingField === 'password' && (
        <ChangePasswordModal
          onClose={() => setEditingField(null)}
        />
      )}

      {editingField === 'logo' && user && (
        <UploadLogoModal
          currentLogoUrl={profile?.logo_url || null}
          userId={user.id}
          onSuccess={loadProfile}
          onClose={() => setEditingField(null)}
        />
      )}
    </div>
  )
}

// ProfileField Component
function ProfileField({
  icon,
  label,
  value,
  onEdit,
  helper,
  buttonText = 'Edit'
}: {
  icon: React.ReactNode
  label: string
  value: string
  onEdit: (() => void) | null
  helper?: string
  buttonText?: string
}) {
  return (
    <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="text-purple-400">{icon}</div>
          <span className="text-purple-300 text-sm font-medium">{label}</span>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-sm rounded-lg transition-colors"
          >
            {buttonText}
          </button>
        )}
      </div>
      <p className="text-white text-lg ml-8">
        {value || 'Not set'}
      </p>
      {helper && (
        <p className="text-purple-400 text-xs ml-8 mt-1">{helper}</p>
      )}
    </div>
  )
}
