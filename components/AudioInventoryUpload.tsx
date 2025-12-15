'use client'

import { useState, useRef, useEffect } from 'react'
import { ParsedInventoryItem, AudioTranscriptionResponse, InventoryParseResponse } from '@/lib/audioInventory/types'

interface AudioInventoryUploadProps {
  familyId: string
  onItemsProcessed: (items: ParsedInventoryItem[]) => void
}

export default function AudioInventoryUpload({ familyId, onItemsProcessed }: AudioInventoryUploadProps) {
  const [mode, setMode] = useState<'record' | 'upload'>('record')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [step, setStep] = useState<'input' | 'recording' | 'transcribing' | 'parsing' | 'review'>('input')
  const [transcript, setTranscript] = useState<string>('')
  const [parsedItems, setParsedItems] = useState<ParsedInventoryItem[]>([])
  const [editingItems, setEditingItems] = useState<ParsedInventoryItem[]>([])
  const [error, setError] = useState<string | null>(null)

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const MAX_RECORDING_TIME = 300 // 5 minutes in seconds

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Use webm for better browser compatibility
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const mediaRecorder = new MediaRecorder(stream, { mimeType })

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        setAudioBlob(audioBlob)

        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop())

        // Reset timer
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      setError(null)
      setStep('recording')

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          // Auto-stop at 5 minutes
          if (newTime >= MAX_RECORDING_TIME) {
            stopRecording()
          }
          return newTime
        })
      }, 1000)

    } catch (err: any) {
      console.error('Error starting recording:', err)
      setError('Failed to access microphone. Please allow microphone permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setStep('input')
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAudioFile(file)
      setError(null)
    }
  }

  const processAudio = async (audio: File | Blob) => {
    setProcessing(true)
    setError(null)
    setStep('transcribing')

    try {
      // Convert Blob to File if needed
      const audioFile = audio instanceof File
        ? audio
        : new File([audio], 'recording.webm', { type: audio.type })

      // Step 1: Transcribe audio with Whisper
      const formData = new FormData()
      formData.append('audio', audioFile)

      const transcribeRes = await fetch('/api/inventory/transcribe-audio', {
        method: 'POST',
        body: formData
      })

      if (!transcribeRes.ok) {
        const errorData = await transcribeRes.json()
        throw new Error(errorData.error || 'Failed to transcribe audio')
      }

      const transcriptionData: AudioTranscriptionResponse = await transcribeRes.json()
      setTranscript(transcriptionData.text)

      // Step 2: Parse transcript into inventory items
      setStep('parsing')

      const parseRes = await fetch('/api/inventory/parse-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcriptionData.text })
      })

      if (!parseRes.ok) {
        const errorData = await parseRes.json()
        throw new Error(errorData.error || 'Failed to parse transcript')
      }

      const parseData: InventoryParseResponse = await parseRes.json()
      setParsedItems(parseData.items)
      setEditingItems(parseData.items)

      // Move to review step
      setStep('review')
    } catch (err: any) {
      console.error('Error processing audio:', err)
      setError(err.message || 'Failed to process audio file')
      setStep('input')
    } finally {
      setProcessing(false)
    }
  }

  const handleProcessRecording = () => {
    if (audioBlob) {
      processAudio(audioBlob)
    }
  }

  const handleProcessFile = () => {
    if (audioFile) {
      processAudio(audioFile)
    }
  }

  const handleItemEdit = (index: number, field: keyof ParsedInventoryItem, value: any) => {
    setEditingItems(items =>
      items.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  const handleRemoveItem = (index: number) => {
    setEditingItems(items => items.filter((_, i) => i !== index))
  }

  const handleConfirmItems = () => {
    onItemsProcessed(editingItems)
  }

  const handleReset = () => {
    setAudioFile(null)
    setAudioBlob(null)
    setTranscript('')
    setParsedItems([])
    setEditingItems([])
    setError(null)
    setRecordingTime(0)
    setStep('input')
  }

  return (
    <div className="space-y-6">
      {/* Input Step - Record or Upload */}
      {step === 'input' && (
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Audio Inventory Upload</h3>
            <p className="text-sm text-gray-600 mb-4">
              Record or upload an audio file listing your inventory items. Speak naturally like:
              &quot;Two pounds of chicken breast expires January 20th, three cans of black beans, half gallon of milk good until next Tuesday&quot;
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="flex gap-2 mb-4 border-b border-gray-200">
            <button
              onClick={() => setMode('record')}
              className={`px-4 py-2 font-medium transition-colors ${
                mode === 'record'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Record Audio
            </button>
            <button
              onClick={() => setMode('upload')}
              className={`px-4 py-2 font-medium transition-colors ${
                mode === 'upload'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Upload File
            </button>
          </div>

          {/* Record Mode */}
          {mode === 'record' && (
            <div>
              {!audioBlob ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <svg
                        className="h-16 w-16 text-indigo-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                        />
                      </svg>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-4">Ready to record your inventory</p>
                  <button
                    onClick={startRecording}
                    className="px-8 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg hover:from-red-700 hover:to-pink-700 transition-all font-medium shadow-md hover:shadow-lg inline-flex items-center gap-2"
                  >
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                    Start Recording
                  </button>
                  <p className="text-xs text-gray-500 mt-3">Maximum 5 minutes</p>
                </div>
              ) : (
                <div className="border-2 border-green-300 bg-green-50 rounded-lg p-8 text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-green-600 mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm font-medium text-gray-900 mb-1">Recording Complete</p>
                  <p className="text-sm text-gray-600 mb-4">Duration: {formatTime(recordingTime)}</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={handleProcessRecording}
                      className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium shadow-md hover:shadow-lg"
                    >
                      Process Recording
                    </button>
                    <button
                      onClick={() => setAudioBlob(null)}
                      className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      Re-record
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upload Mode */}
          {mode === 'upload' && (
            <div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="audio-upload"
                />
                <label htmlFor="audio-upload" className="cursor-pointer block">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400 mb-3"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-sm text-gray-600">
                    {audioFile ? audioFile.name : 'Click to select audio file'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Supported: MP3, WAV, M4A, WebM (max 10MB, ~5 minutes)
                  </p>
                </label>
              </div>

              {audioFile && (
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={handleProcessFile}
                    disabled={processing}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing ? 'Processing...' : 'Process Audio'}
                  </button>
                  <button
                    onClick={() => setAudioFile(null)}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Recording Step */}
      {step === 'recording' && (
        <div className="text-center py-12">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-red-600 rounded-full animate-ping opacity-75"></div>
            <div className="relative w-20 h-20 bg-red-600 rounded-full flex items-center justify-center">
              <div className="w-6 h-6 bg-white rounded-full"></div>
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Recording...</h3>
          <p className="text-3xl font-mono text-indigo-600 mb-4">{formatTime(recordingTime)}</p>
          <p className="text-sm text-gray-600 mb-6">Speak clearly and list your inventory items</p>
          <button
            onClick={stopRecording}
            className="px-8 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium shadow-md hover:shadow-lg"
          >
            Stop Recording
          </button>
          <p className="text-xs text-gray-500 mt-3">
            Maximum time: {formatTime(MAX_RECORDING_TIME)}
          </p>
        </div>
      )}

      {/* Processing Steps */}
      {(step === 'transcribing' || step === 'parsing') && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {step === 'transcribing' ? 'Transcribing Audio...' : 'Parsing Inventory Items...'}
          </h3>
          <p className="text-sm text-gray-600">
            {step === 'transcribing'
              ? 'Converting your speech to text'
              : 'Extracting structured inventory data'}
          </p>
        </div>
      )}

      {/* Review Step */}
      {step === 'review' && (
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Review & Edit Items</h3>
            <p className="text-sm text-gray-600 mb-2">
              Found {editingItems.length} items. Review and edit before importing.
            </p>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4">
              <p className="text-xs font-medium text-gray-700 mb-1">Transcript:</p>
              <p className="text-xs text-gray-600 italic">&quot;{transcript}&quot;</p>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {editingItems.map((item, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${
                  item.confidence === 'low'
                    ? 'border-yellow-300 bg-yellow-50'
                    : item.confidence === 'medium'
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-green-300 bg-green-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Item Name *
                      </label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemEdit(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Quantity
                      </label>
                      <input
                        type="text"
                        value={item.quantity || ''}
                        onChange={(e) => handleItemEdit(index, 'quantity', e.target.value || null)}
                        placeholder="e.g., 2 pounds"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Category *
                      </label>
                      <select
                        value={item.category}
                        onChange={(e) => handleItemEdit(index, 'category', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-900"
                      >
                        <option value="produce">Produce</option>
                        <option value="meat">Meat</option>
                        <option value="dairy">Dairy</option>
                        <option value="pantry">Pantry</option>
                        <option value="frozen">Frozen</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Expiration Date
                      </label>
                      <input
                        type="date"
                        value={item.expiration_date || ''}
                        onChange={(e) => handleItemEdit(index, 'expiration_date', e.target.value || null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-900"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="flex-shrink-0 p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    title="Remove item"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {item.confidence === 'low' && (
                  <p className="text-xs text-yellow-700 mt-2">
                    ⚠️ Low confidence - please review this item carefully
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleConfirmItems}
              disabled={editingItems.length === 0}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Import {editingItems.length} Items
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
