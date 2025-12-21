'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'

type Invitation = {
  id: string
  umbrella_group_id: string
  invited_by_user_id: string
  email: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  invited_at: string
  expires_at: string
  responded_at: string | null
  umbrella_groups: {
    id: string
    name: string
    description: string | null
    logo_url: string | null
    privacy_level: string
  }
  invited_by: {
    id: string
    display_name: string
    email: string
  }
}

type UmbrellaGroup = {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  privacy_level: string
  created_at: string
  membership_role?: string
  member_count?: number
}

type FamilyMember = {
  id: string
  family_id: string
  name: string
  birthday: string | null
  photo_url: string | null
  dietary_restrictions: string[] | null
  favorite_ingredients: string[] | null
  favorite_cuisines: string[] | null
  created_at: string
  updated_at: string
}

// Helper function to calculate age from birthday
function calculateAge(birthday: string | null): number | null {
  if (!birthday) return null
  const today = new Date()
  const birthDate = new Date(birthday)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

function FamilyMembersSection() {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const supabase = createClient()

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    birthday: '',
    photo_url: '',
    dietary_restrictions: [] as string[],
    favorite_ingredients: [] as string[],
    favorite_cuisines: [] as string[]
  })

  // New item inputs
  const [newRestriction, setNewRestriction] = useState('')
  const [newIngredient, setNewIngredient] = useState('')
  const [newCuisine, setNewCuisine] = useState('')

  useEffect(() => {
    loadFamilyMembers()
  }, [])

  const loadFamilyMembers = async () => {
    setLoading(true)

    try {
      const { data: family, error: familyError } = await supabase
        .from('families')
        .select('id')
        .limit(1)
        .maybeSingle()

      if (familyError) throw familyError
      if (!family?.id) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('family_id', family.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setFamilyMembers(data || [])
    } catch (error) {
      console.error('Error loading family members:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      birthday: '',
      photo_url: '',
      dietary_restrictions: [],
      favorite_ingredients: [],
      favorite_cuisines: []
    })
    setEditingMember(null)
  }

  const openAddModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (member: FamilyMember) => {
    setEditingMember(member)
    setFormData({
      name: member.name,
      birthday: member.birthday || '',
      photo_url: member.photo_url || '',
      dietary_restrictions: member.dietary_restrictions || [],
      favorite_ingredients: member.favorite_ingredients || [],
      favorite_cuisines: member.favorite_cuisines || []
    })
    setShowModal(true)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPhoto(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const filePath = `family-photos/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('public')
      .upload(filePath, file)

    if (uploadError) {
      console.error('Upload error:', uploadError)
      setUploadingPhoto(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('public')
      .getPublicUrl(filePath)

    setFormData({ ...formData, photo_url: publicUrl })
    setUploadingPhoto(false)
  }

  const handleSave = async () => {
    const { data: family, error: familyError } = await supabase
      .from('families')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (familyError || !family?.id) {
      alert('Error loading family')
      return
    }

    const memberData = {
      family_id: family.id,
      name: formData.name,
      birthday: formData.birthday || null,
      photo_url: formData.photo_url || null,
      dietary_restrictions: formData.dietary_restrictions.length > 0 ? formData.dietary_restrictions : null,
      favorite_ingredients: formData.favorite_ingredients.length > 0 ? formData.favorite_ingredients : null,
      favorite_cuisines: formData.favorite_cuisines.length > 0 ? formData.favorite_cuisines : null
    }

    if (editingMember) {
      const { error } = await supabase
        .from('family_members')
        .update(memberData)
        .eq('id', editingMember.id)

      if (error) {
        alert(`Failed to update family member: ${error.message}`)
      } else {
        setShowModal(false)
        resetForm()
        loadFamilyMembers()
      }
    } else {
      const { error } = await supabase
        .from('family_members')
        .insert(memberData)

      if (error) {
        alert(`Failed to add family member: ${error.message}`)
      } else {
        setShowModal(false)
        resetForm()
        loadFamilyMembers()
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this family member?')) return

    const { error } = await supabase
      .from('family_members')
      .delete()
      .eq('id', id)

    if (!error) {
      loadFamilyMembers()
    }
  }

  const addRestriction = () => {
    if (newRestriction.trim() && !formData.dietary_restrictions.includes(newRestriction.trim())) {
      setFormData({
        ...formData,
        dietary_restrictions: [...formData.dietary_restrictions, newRestriction.trim()]
      })
      setNewRestriction('')
    }
  }

  const removeRestriction = (item: string) => {
    setFormData({
      ...formData,
      dietary_restrictions: formData.dietary_restrictions.filter(r => r !== item)
    })
  }

  const addIngredient = () => {
    if (newIngredient.trim() && !formData.favorite_ingredients.includes(newIngredient.trim())) {
      setFormData({
        ...formData,
        favorite_ingredients: [...formData.favorite_ingredients, newIngredient.trim()]
      })
      setNewIngredient('')
    }
  }

  const removeIngredient = (item: string) => {
    setFormData({
      ...formData,
      favorite_ingredients: formData.favorite_ingredients.filter(i => i !== item)
    })
  }

  const addCuisine = () => {
    if (newCuisine.trim() && !formData.favorite_cuisines.includes(newCuisine.trim())) {
      setFormData({
        ...formData,
        favorite_cuisines: [...formData.favorite_cuisines, newCuisine.trim()]
      })
      setNewCuisine('')
    }
  }

  const removeCuisine = (item: string) => {
    setFormData({
      ...formData,
      favorite_cuisines: formData.favorite_cuisines.filter(c => c !== item)
    })
  }

  if (loading) {
    return (
      <div className="mt-6 bg-white rounded-2xl shadow-md border border-gray-100 p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-3 text-gray-600">Loading family members...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="mt-6 bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Family Members</h2>
              <p className="text-sm text-gray-600 mt-1">Manage your family profiles and preferences</p>
            </div>
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium shadow-md hover:shadow-lg"
            >
              Add Member
            </button>
          </div>
        </div>

        <div className="p-6">
          {familyMembers.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Family Members Yet</h3>
              <p className="text-gray-600 mb-4">Add your first family member to track preferences and dietary restrictions</p>
              <button
                onClick={openAddModal}
                className="inline-block px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium"
              >
                Add Family Member
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {familyMembers.map((member) => (
                <div key={member.id} className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                      {member.photo_url ? (
                        <Image
                          src={member.photo_url}
                          alt={member.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-400 to-purple-400">
                          <span className="text-white text-lg font-bold">
                            {member.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{member.name}</h3>
                      {member.birthday && (
                        <p className="text-xs text-gray-600">{calculateAge(member.birthday)} years old</p>
                      )}
                    </div>
                  </div>

                  {member.dietary_restrictions && member.dietary_restrictions.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-gray-700 mb-1">Dietary Restrictions</p>
                      <div className="flex flex-wrap gap-1">
                        {member.dietary_restrictions.slice(0, 2).map((restriction, idx) => (
                          <span key={idx} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            {restriction}
                          </span>
                        ))}
                        {member.dietary_restrictions.length > 2 && (
                          <span className="text-xs text-gray-500">+{member.dietary_restrictions.length - 2}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {member.favorite_cuisines && member.favorite_cuisines.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-700 mb-1">Favorite Cuisines</p>
                      <div className="flex flex-wrap gap-1">
                        {member.favorite_cuisines.slice(0, 2).map((cuisine, idx) => (
                          <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            {cuisine}
                          </span>
                        ))}
                        {member.favorite_cuisines.length > 2 && (
                          <span className="text-xs text-gray-500">+{member.favorite_cuisines.length - 2}</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => openEditModal(member)}
                      className="flex-1 flex items-center justify-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-medium"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(member.id)}
                      className="flex-1 flex items-center justify-center gap-1 bg-red-50 text-red-700 px-2 py-1.5 rounded-lg hover:bg-red-100 transition-colors text-xs font-medium"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingMember ? 'Edit Family Member' : 'Add Family Member'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  resetForm()
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Photo</label>
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                    {formData.photo_url ? (
                      <Image
                        src={formData.photo_url}
                        alt="Preview"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-400 to-purple-400">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
                    />
                    {uploadingPhoto && <p className="text-sm text-gray-500 mt-1">Uploading...</p>}
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder:text-gray-400"
                  placeholder="Enter name"
                  required
                />
              </div>

              {/* Birthday */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Birthday</label>
                <input
                  type="date"
                  value={formData.birthday}
                  onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder:text-gray-400"
                  max={new Date().toISOString().split('T')[0]}
                />
                {formData.birthday && (
                  <p className="text-sm text-gray-600 mt-1">
                    Age: {calculateAge(formData.birthday)} years old
                  </p>
                )}
              </div>

              {/* Dietary Restrictions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dietary Restrictions</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newRestriction}
                    onChange={(e) => setNewRestriction(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRestriction())}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder:text-gray-400"
                    placeholder="Add restriction (e.g., Gluten-free)"
                  />
                  <button
                    onClick={addRestriction}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.dietary_restrictions.map((restriction, idx) => (
                    <span key={idx} className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                      {restriction}
                      <button
                        onClick={() => removeRestriction(restriction)}
                        className="text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Favorite Ingredients */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Favorite Ingredients</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newIngredient}
                    onChange={(e) => setNewIngredient(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addIngredient())}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder:text-gray-400"
                    placeholder="Add ingredient (e.g., Chicken)"
                  />
                  <button
                    onClick={addIngredient}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.favorite_ingredients.map((ingredient, idx) => (
                    <span key={idx} className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                      {ingredient}
                      <button
                        onClick={() => removeIngredient(ingredient)}
                        className="text-green-500 hover:text-green-700"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Favorite Cuisines */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Favorite Cuisines</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newCuisine}
                    onChange={(e) => setNewCuisine(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCuisine())}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder:text-gray-400"
                    placeholder="Add cuisine (e.g., Italian)"
                  />
                  <button
                    onClick={addCuisine}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.favorite_cuisines.map((cuisine, idx) => (
                    <span key={idx} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                      {cuisine}
                      <button
                        onClick={() => removeCuisine(cuisine)}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false)
                  resetForm()
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingMember ? 'Save Changes' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MyGroupsSection() {
  const [groups, setGroups] = useState<UmbrellaGroup[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadGroups()
  }, [])

  const loadGroups = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get user's group memberships
      const { data: memberships } = await supabase
        .from('umbrella_group_memberships')
        .select(`
          role,
          umbrella_group_id,
          umbrella_groups (
            id,
            name,
            description,
            logo_url,
            privacy_level,
            created_at
          )
        `)
        .eq('user_id', user.id)

      if (memberships) {
        const groupsWithRole = memberships.map((m: any) => ({
          ...m.umbrella_groups,
          membership_role: m.role
        }))
        setGroups(groupsWithRole)
      }
    } catch (error) {
      console.error('Error loading groups:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="mt-6 bg-white rounded-2xl shadow-md border border-gray-100 p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-3 text-gray-600">Loading groups...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6 bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">My Groups</h2>
            <p className="text-sm text-gray-600 mt-1">Manage your family groups</p>
          </div>
          <Link
            href="/dashboard/groups/new"
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium shadow-md hover:shadow-lg"
          >
            Create Group
          </Link>
        </div>
      </div>

      <div className="p-6">
        {groups.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Groups Yet</h3>
            <p className="text-gray-600 mb-4">Create or join a group to start sharing recipes with family</p>
            <Link
              href="/dashboard/groups/new"
              className="inline-block px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium"
            >
              Create Your First Group
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/dashboard/groups/${group.id}`}
                className="block border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
              >
                <div className="flex items-center gap-4">
                  {/* Group Logo */}
                  {group.logo_url ? (
                    <img
                      src={group.logo_url}
                      alt={group.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">
                        {group.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Group Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-gray-900">{group.name}</h3>
                      {group.membership_role === 'admin' && (
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
                          Admin
                        </span>
                      )}
                    </div>
                    {group.description && (
                      <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className="capitalize">{group.privacy_level}</span>
                      <span>•</span>
                      <span>Joined {new Date(group.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AccountPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadInvitations()
  }, [])

  const loadInvitations = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be logged in')
        setLoading(false)
        return
      }

      // Get user's email
      const { data: userData } = await supabase
        .from('users')
        .select('email')
        .eq('id', user.id)
        .single()

      if (userData) {
        setUserEmail(userData.email)

        // Load invitations for this email
        const { data: invitationsData, error: invError } = await supabase
          .from('umbrella_group_invitations')
          .select(`
            id,
            umbrella_group_id,
            invited_by_user_id,
            email,
            status,
            invited_at,
            expires_at,
            responded_at,
            umbrella_groups (
              id,
              name,
              description,
              logo_url,
              privacy_level
            ),
            invited_by:users!umbrella_group_invitations_invited_by_user_id_fkey (
              id,
              display_name,
              email
            )
          `)
          .eq('email', userData.email)
          .order('invited_at', { ascending: false })

        if (invError) throw invError

        setInvitations(invitationsData as any || [])
      }
    } catch (err: any) {
      console.error('Error loading invitations:', err)
      setError(err.message || 'Failed to load invitations')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (invitation: Invitation) => {
    setProcessing(invitation.id)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Check if invitation is still valid
      if (new Date(invitation.expires_at) < new Date()) {
        // Mark as expired
        await supabase
          .from('umbrella_group_invitations')
          .update({ status: 'expired' })
          .eq('id', invitation.id)

        throw new Error('This invitation has expired')
      }

      // Add user to the group
      const { error: memberError } = await supabase
        .from('umbrella_group_memberships')
        .insert({
          umbrella_group_id: invitation.umbrella_group_id,
          user_id: user.id,
          role: 'member'
        })

      if (memberError) {
        // Check if already a member
        if (memberError.code === '23505') {
          throw new Error('You are already a member of this group')
        }
        throw memberError
      }

      // Update invitation status
      const { error: updateError } = await supabase
        .from('umbrella_group_invitations')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString()
        })
        .eq('id', invitation.id)

      if (updateError) throw updateError

      // Reload invitations
      await loadInvitations()

      // Show success message
      alert(`Successfully joined ${invitation.umbrella_groups.name}!`)
    } catch (err: any) {
      console.error('Error accepting invitation:', err)
      setError(err.message || 'Failed to accept invitation')
    } finally {
      setProcessing(null)
    }
  }

  const handleDecline = async (invitation: Invitation) => {
    if (!confirm('Are you sure you want to decline this invitation?')) return

    setProcessing(invitation.id)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('umbrella_group_invitations')
        .update({
          status: 'declined',
          responded_at: new Date().toISOString()
        })
        .eq('id', invitation.id)

      if (updateError) throw updateError

      // Reload invitations
      await loadInvitations()
    } catch (err: any) {
      console.error('Error declining invitation:', err)
      setError(err.message || 'Failed to decline invitation')
    } finally {
      setProcessing(null)
    }
  }

  const pendingInvitations = invitations.filter(i => i.status === 'pending')
  const respondedInvitations = invitations.filter(i => i.status !== 'pending')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Account
            </h1>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
            >
              ← Back to Dashboard
            </Link>
          </div>
          {userEmail && (
            <p className="text-gray-600">Logged in as: {userEmail}</p>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Pending Invitations */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Pending Invitations</h2>
                <p className="text-sm text-gray-600 mt-1">Group invitations waiting for your response</p>
              </div>
              {pendingInvitations.length > 0 && (
                <span className="px-3 py-1 bg-indigo-600 text-white text-sm font-bold rounded-full">
                  {pendingInvitations.length}
                </span>
              )}
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-3 text-gray-600">Loading invitations...</p>
              </div>
            ) : pendingInvitations.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Invitations</h3>
                <p className="text-gray-600">You're all caught up!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingInvitations.map((invitation) => {
                  const isExpired = new Date(invitation.expires_at) < new Date()
                  const isProcessing = processing === invitation.id

                  return (
                    <div key={invitation.id} className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50/50">
                      <div className="flex items-start gap-4">
                        {/* Group Logo */}
                        {invitation.umbrella_groups.logo_url ? (
                          <img
                            src={invitation.umbrella_groups.logo_url}
                            alt={invitation.umbrella_groups.name}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                            <span className="text-white text-2xl font-bold">
                              {invitation.umbrella_groups.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}

                        {/* Invitation Details */}
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 mb-1">
                            {invitation.umbrella_groups.name}
                          </h3>
                          {invitation.umbrella_groups.description && (
                            <p className="text-sm text-gray-600 mb-2">{invitation.umbrella_groups.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                            <span>Invited by {invitation.invited_by.display_name}</span>
                            <span>•</span>
                            <span>{new Date(invitation.invited_at).toLocaleDateString()}</span>
                            {isExpired && (
                              <>
                                <span>•</span>
                                <span className="text-red-600 font-semibold">Expired</span>
                              </>
                            )}
                          </div>

                          {/* Actions */}
                          {!isExpired && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAccept(invitation)}
                                disabled={isProcessing}
                                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isProcessing ? 'Processing...' : 'Accept'}
                              </button>
                              <button
                                onClick={() => handleDecline(invitation)}
                                disabled={isProcessing}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Invitation History */}
        {respondedInvitations.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Invitation History</h2>
              <p className="text-sm text-gray-600 mt-1">Past invitations you've responded to</p>
            </div>

            <div className="p-6">
              <div className="space-y-3">
                {respondedInvitations.map((invitation) => (
                  <div key={invitation.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {invitation.umbrella_groups.logo_url ? (
                          <img
                            src={invitation.umbrella_groups.logo_url}
                            alt={invitation.umbrella_groups.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                            <span className="text-white text-sm font-bold">
                              {invitation.umbrella_groups.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}

                        <div>
                          <div className="font-semibold text-gray-900">{invitation.umbrella_groups.name}</div>
                          <div className="text-xs text-gray-500">
                            Responded {invitation.responded_at ? new Date(invitation.responded_at).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                      </div>

                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        invitation.status === 'accepted'
                          ? 'bg-green-100 text-green-800'
                          : invitation.status === 'declined'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Family Members */}
        <FamilyMembersSection />

        {/* My Groups */}
        <MyGroupsSection />
      </div>
    </div>
  )
}
