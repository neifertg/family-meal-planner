import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OpenAI_Whisper
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/m4a', 'audio/ogg']
    if (!validTypes.includes(audioFile.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Supported types: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate file size (max 25MB for Whisper API)
    const maxSize = 25 * 1024 * 1024 // 25MB
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 25MB' },
        { status: 400 }
      )
    }

    console.log('Transcribing audio file:', audioFile.name, audioFile.type, `${(audioFile.size / 1024 / 1024).toFixed(2)}MB`)

    // Transcribe with OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
      response_format: 'verbose_json'
    })

    console.log('Transcription completed:', transcription.text.substring(0, 100) + '...')

    return NextResponse.json({
      text: transcription.text,
      duration: transcription.duration || 0
    })
  } catch (error: any) {
    console.error('Error transcribing audio:', error)

    // Handle OpenAI specific errors
    if (error.response) {
      return NextResponse.json(
        { error: `OpenAI API error: ${error.response.data?.error?.message || 'Unknown error'}` },
        { status: error.response.status }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to transcribe audio' },
      { status: 500 }
    )
  }
}
