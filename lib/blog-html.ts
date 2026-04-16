interface BlogData {
  subject: string
  grade: string
  school: string
  examYear: number
  examTerm: string
  keyFeatures: string[]
  yearOverYearComparison: string
  killerQuestions: {
    number: number
    subUnit: string
    intent: string
    rate: number
    reason: string
  }[]
  strategies: {
    trend: string
    strategy: string
  }[]
  questions: {
    number: number
    type: string
    mainUnit: string
    subUnit: string
    difficulty: string
    expectedCorrectRate: number
  }[]
}

function difficultyStats(questions: BlogData['questions']) {
  const counts: Record<string, number> = {}
  for (const q of questions) {
    counts[q.difficulty] = (counts[q.difficulty] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([d, c]) => `${d} ${c}문항`)
    .join(' / ')
}

function avgRate(questions: BlogData['questions']) {
  if (questions.length === 0) return 0
  const sum = questions.reduce((s, q) => s + q.expectedCorrectRate, 0)
  return Math.round(sum / questions.length)
}

export function generateBlogHtml(data: BlogData): string {
  const title = `${data.examYear}년 ${data.school} ${data.grade} ${data.examTerm} ${data.subject} 분석`

  const featuresHtml = data.keyFeatures
    .map((f) => `  <li>✅ ${f}</li>`)
    .join('\n')

  const killerHtml = data.killerQuestions
    .map(
      (k) =>
        `<p><strong>${k.number}번 문항</strong> (${k.subUnit} · ${k.intent} · 예상정답률 ${k.rate}%)</p>\n<p>${k.reason}</p>`,
    )
    .join('\n\n')

  const strategyHtml = data.strategies
    .map((s, i) => `  <li><strong>${s.trend}</strong> — ${s.strategy}</li>`)
    .join('\n')

  const stats = difficultyStats(data.questions)
  const avg = avgRate(data.questions)

  return `<h1>${title}</h1>

<p>안녕하세요, <strong>품격에듀</strong>입니다! ${data.examTerm} ${data.subject} 시험을 분석한 결과를 공유합니다.</p>

<h2>📊 시험 개요</h2>

<p>총 <strong>${data.questions.length}문항</strong> · 난이도 분포: ${stats} · 예상 평균정답률 <strong>${avg}%</strong></p>

<h2>📋 이번 시험의 주요 특징</h2>

<ul>
${featuresHtml}
</ul>

<h2>📈 전년도 비교</h2>

<p>${data.yearOverYearComparison}</p>

<h2>🔥 킬러문항 분석</h2>

${killerHtml}

<h2>💡 다음 시험 대비 전략</h2>

<ol>
${strategyHtml}
</ol>

<p>&nbsp;</p>
<p><em>품격에듀 AI 시험 분석 리포트</em></p>
`
}
