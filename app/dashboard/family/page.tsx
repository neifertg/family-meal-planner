'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

type FamilyMember = {
  id: string
  family_id: string
  name: string
  age: number | null
  photo_url: string | null
  dietary_restrictions: string[] | null
  favorite_ingredients: string[] | null
  favorite_cuisines: string[] | null
  created_at: string
  updated_at: string
}

export default function FamilyPage() {
  const supabase = createClient()
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    age: '',
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
    setIsLoading(true)

    // Get the family (RLS ensures we only get the user's family)
    const { data: family, error: familyError } = await supabase
      .from('families')
      .select('id')
      .single()

    if (familyError) {
      console.error('Error loading family:', familyError)
      setIsLoading(false)
      return
    }

    if (!family?.id) {
      console.error('No family found')
      setIsLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('family_members')
      .select('*')
      .eq('family_id', family.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error loading family members:', error)
    } else if (data) {
      setFamilyMembers(data)
    }
    setIsLoading(false)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      age: '',
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
      age: member.age?.toString() || '',
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
    // Get the family (RLS ensures we only get the user's family)
    const { data: family, error: familyError } = await supabase
      .from('families')
      .select('id')
      .single()

    if (familyError) {
      console.error('Error loading family:', familyError)
      alert(`Error loading family: ${familyError.message}`)
      return
    }

    if (!family?.id) {
      console.error('No family found')
      alert('No family found. Please contact support.')
      return
    }

    const memberData = {
      family_id: family.id,
      name: formData.name,
      age: formData.age ? parseInt(formData.age) : null,
      photo_url: formData.photo_url || null,
      dietary_restrictions: formData.dietary_restrictions.length > 0 ? formData.dietary_restrictions : null,
      favorite_ingredients: formData.favorite_ingredients.length > 0 ? formData.favorite_ingredients : null,
      favorite_cuisines: formData.favorite_cuisines.length > 0 ? formData.favorite_cuisines : null
    }

    console.log('Saving member data:', memberData)

    if (editingMember) {
      const { error } = await supabase
        .from('family_members')
        .update(memberData)
        .eq('id', editingMember.id)

      if (error) {
        console.error('Error updating family member:', error)
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
        console.error('Error adding family member:', error)
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading family members...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Family Members</h1>
          <p className="text-gray-600 mt-1">Manage your family profiles and preferences</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Family Member
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-100 rounded-full p-3">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Members</p>
              <p className="text-2xl font-bold text-gray-900">{familyMembers.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-amber-100 rounded-full p-3">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Average Age</p>
              <p className="text-2xl font-bold text-gray-900">
                {familyMembers.filter(m => m.age).length > 0
                  ? Math.round(familyMembers.filter(m => m.age).reduce((sum, m) => sum + (m.age || 0), 0) / familyMembers.filter(m => m.age).length)
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-green-100 rounded-full p-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">With Restrictions</p>
              <p className="text-2xl font-bold text-gray-900">
                {familyMembers.filter(m => m.dietary_restrictions && m.dietary_restrictions.length > 0).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Family Members Grid */}
      {familyMembers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No family members yet</h3>
          <p className="text-gray-600 mb-4">Add your first family member to get started</p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Family Member
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {familyMembers.map((member) => (
            <div key={member.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              {/* Photo and Name */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                  {member.photo_url ? (
                    <Image
                      src={member.photo_url}
                      alt={member.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-400 to-purple-400">
                      <span className="text-white text-2xl font-bold">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">{member.name}</h3>
                  {member.age && (
                    <p className="text-sm text-gray-600">{member.age} years old</p>
                  )}
                </div>
              </div>

              {/* Dietary Restrictions */}
              {member.dietary_restrictions && member.dietary_restrictions.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-700 mb-1">Dietary Restrictions</p>
                  <div className="flex flex-wrap gap-1">
                    {member.dietary_restrictions.map((restriction, idx) => (
                      <span key={idx} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {restriction}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Favorite Ingredients */}
              {member.favorite_ingredients && member.favorite_ingredients.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-700 mb-1">Favorite Ingredients</p>
                  <div className="flex flex-wrap gap-1">
                    {member.favorite_ingredients.slice(0, 3).map((ingredient, idx) => (
                      <span key={idx} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        {ingredient}
                      </span>
                    ))}
                    {member.favorite_ingredients.length > 3 && (
                      <span className="text-xs text-gray-500">+{member.favorite_ingredients.length - 3} more</span>
                    )}
                  </div>
                </div>
              )}

              {/* Favorite Cuisines */}
              {member.favorite_cuisines && member.favorite_cuisines.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-700 mb-1">Favorite Cuisines</p>
                  <div className="flex flex-wrap gap-1">
                    {member.favorite_cuisines.slice(0, 3).map((cuisine, idx) => (
                      <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {cuisine}
                      </span>
                    ))}
                    {member.favorite_cuisines.length > 3 && (
                      <span className="text-xs text-gray-500">+{member.favorite_cuisines.length - 3} more</span>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => openEditModal(member)}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(member.id)}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-700 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter name"
                  required
                />
              </div>

              {/* Age */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter age"
                  min="0"
                  max="150"
                />
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
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
    </div>
  )
}
