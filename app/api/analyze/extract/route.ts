import { NextRequest, NextResponse } from 'next/server'
import { recordApiKeyUsage } from '@/lib/db'
import {
  genAIs,
  runStage,
  distributeImages,
  urlToBase64,
  buildBaseContext,
  getKeyOrder,
  type ImagePart,
  type ExamMeta,
} from '@/lib/gemini'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ExamMeta & {
      currentImageUrl?: string
      currentImageUrls?: string[]
    }
    const currentUrls = body.currentImageUrls ?? (body.currentImageUrl ? [body.currentImageUrl] : [])
    if (currentUrls.length === 0) {
      return NextResponse.json({ error: '시험지 이미지가 없습니다.' }, { status: 400 })
    }
    if (genAIs.length === 0) {
      return NextResponse.json({ error: 'API 키가 등록되어 있지 않습니다.' }, { status: 503 })
    }

    const currentImages = await Promise.all(currentUrls.map(urlToBase64))
    const currentImageParts: ImagePart[] = currentImages.map((img) => ({ inlineData: img }))

    const totalImages = currentImageParts.length
    const baseContext = buildBaseContext(body, totalImages)

    const chunkCount = Math.min(totalImages, genAIs.length)
    const chunks = distributeImages(currentImageParts, chunkCount).filter((c) => c.length > 0)

    const phase1Prompt = (chunkSize: number) => `${baseContext}

[Phase 1: 문제 추출 작업]
당신에게 전체 ${totalImages}장 중 일부인 ${chunkSize}장의 이미지가 주어집니다.
이 이미지들에 보이는 문제만 빠짐없이 추출하여 JSON으로 응답하세요. JSON 외 다른 텍스트는 절대 포함하지 마세요.

{"questions": [{"number": 1, "type": "객관식 | 단답형 | 서술형", "mainUnit": "대단원명", "subUnit": "중단원명", "intent": "출제자 의도", "expectedCorrectRate": 75, "difficulty": "상 | 중상 | 중 | 중하 | 하", "score": "배점 숫자 또는 \\"-\\""}]}

규칙:
- 문제 번호(number)는 시험지에 인쇄된 번호 그대로 사용하세요. 1부터 다시 매기지 마세요.
- 이 이미지들에 보이지 않는 문제는 절대 추가하지 마세요.
- 잘려서 부분만 보이는 문제도 번호가 보이면 추출하세요.`

    const phase1Settled = await Promise.all(
      chunks.map(async (chunk, idx) => {
        const keyOrder = await getKeyOrder(idx % genAIs.length)
        return runStage(chunk, phase1Prompt(chunk.length), keyOrder)
      }),
    )

    const allQuestions: Record<string, unknown>[] = []
    for (const r of phase1Settled) {
      const qs = r.data.questions
      if (Array.isArray(qs)) allQuestions.push(...qs)
      recordApiKeyUsage(r.keyIndex, 'success').catch(() => {})
    }
    allQuestions.sort((a, b) => Number(a.number ?? 0) - Number(b.number ?? 0))

    if (allQuestions.length === 0) {
      return NextResponse.json({ error: '문제를 한 개도 추출하지 못했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ questions: allQuestions, totalImages })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Phase 1 extract error:', message)
    return NextResponse.json({ error: `추출 오류: ${message}` }, { status: 500 })
  }
}
