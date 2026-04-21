import { NextRequest, NextResponse } from 'next/server'
import { recordApiKeyUsage } from '@/lib/db'
import {
  genAIs,
  runStage,
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
      questions: Record<string, unknown>[]
      prevImageUrls?: string[]
      totalImages?: number
    }
    if (!Array.isArray(body.questions) || body.questions.length === 0) {
      return NextResponse.json({ error: '문제 데이터가 없습니다.' }, { status: 400 })
    }
    if (genAIs.length === 0) {
      return NextResponse.json({ error: 'API 키가 등록되어 있지 않습니다.' }, { status: 503 })
    }

    const prevImages = body.prevImageUrls && body.prevImageUrls.length > 0
      ? await Promise.all(body.prevImageUrls.map(urlToBase64))
      : []
    const prevImageParts: ImagePart[] = prevImages.map((img) => ({ inlineData: img }))

    const baseContext = buildBaseContext(body, body.totalImages ?? 0)
    const hasPrev = prevImageParts.length > 0
    const prevBlock = hasPrev
      ? `\n\n[전년도 시험지 첨부]
이번 호출에 이번 시험의 추출된 문제 데이터(JSON)와 함께, 전년도 시험지 ${prevImageParts.length}개의 이미지/PDF가 첨부되어 있습니다.
전년도 시험지 내용을 직접 읽어서 이번 시험과 비교하고, yearOverYearComparison 필드에 변화 분석을 작성하세요 (출제 경향 변화 / 난이도 변화 / 새로 등장한 유형 / 사라진 유형 등 2~3문장).`
      : ''

    const phase2Prompt = `${baseContext}${prevBlock}

[Phase 2: 시험 종합 분석 작업]
다음은 Phase 1에서 추출한 이번 시험의 모든 문제 정보입니다 (JSON 배열).
이 정보를 바탕으로 시험 총평 / 킬러문항 / 출제경향·전략을 한 번에 JSON으로 응답하세요. JSON 외 다른 텍스트는 포함하지 마세요.

[추출된 문제 데이터]
${JSON.stringify(body.questions, null, 2)}

응답 JSON 형식:
{
  "keyFeatures": ["특징1", "특징2", "특징3", "특징4"],
  "examSummary": "시험 전체 종합 총평 3~5문장. 난이도 수준, 출제 경향, 변별력 포인트 포함.",
  "aiDifficulty": "상 | 중상 | 중 | 중하 | 하",
  "aiDifficultyReason": "AI 판단 난이도의 근거 2~3문장",
  "commonMistakes": [{"area": "실수가 잦은 영역/단원", "description": "학생들이 어떤 실수를 왜 하는지", "tip": "실수 방지 팁"}],
  "yearOverYearComparison": "${hasPrev ? '전년도 시험지와 비교한 변화 분석 2~3문장' : '전년도 시험지 없음. 이번 시험 특성만 서술.'}",
  "killerQuestions": [{"number": 8, "subUnit": "중단원명", "intent": "출제자 의도", "difficulty": "상", "rate": 42, "reason": "킬러문항인 이유"}],
  "strategies": [{"trend": "출제 경향", "strategy": "대응 학습 전략"}]
}

규칙:
- aiDifficulty는 강사 사전 정보(범위/예상난이도/메모)와 추출된 문제 데이터를 종합 판단.
- examSummary는 학부모·학생이 읽을 수 있도록 명확하게 작성.
- commonMistakes는 3~5개 항목.
- killerQuestions는 난이도 상 + 정답률 낮은 순으로 최대 5개. number는 추출된 문제 번호 중에서만 선택.
- strategies는 4~5개.`

    const preferred = Math.min(3, genAIs.length - 1)
    const keyOrder = await getKeyOrder(preferred)
    const phase2 = await runStage(prevImageParts, phase2Prompt, keyOrder)
    recordApiKeyUsage(phase2.keyIndex, 'success').catch(() => {})

    return NextResponse.json(phase2.data)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Phase 2 synthesize error:', message)
    return NextResponse.json({ error: `종합 오류: ${message}` }, { status: 500 })
  }
}
