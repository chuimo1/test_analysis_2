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
  examSummary?: string
  commonMistakes?: {
    area: string
    description: string
    tip: string
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
    score: string | number
  }[]
  teacherComment?: string
}

const DIFF_COLORS: Record<string, string> = {
  상: '#ef4444', 중상: '#f97316', 중: '#eab308', 중하: '#22c55e', 하: '#3b82f6',
}

const DIFF_BG: Record<string, string> = {
  상: '#fef2f2', 중상: '#fff7ed', 중: '#fefce8', 중하: '#f0fdf4', 하: '#eff6ff',
}

function difficultyTable(questions: BlogData['questions']) {
  const counts: Record<string, number> = {}
  for (const q of questions) {
    counts[q.difficulty] = (counts[q.difficulty] ?? 0) + 1
  }
  const total = questions.length
  const rows = Object.entries(counts)
    .map(([d, c]) => {
      const pct = Math.round((c / total) * 100)
      return `<tr>
  <td style="padding:8px 16px;font-weight:600;color:${DIFF_COLORS[d] ?? '#333'};background:${DIFF_BG[d] ?? '#f9f9f9'};border:1px solid #e5e7eb">${d}</td>
  <td style="padding:8px 16px;text-align:center;border:1px solid #e5e7eb">${c}문항</td>
  <td style="padding:8px 16px;border:1px solid #e5e7eb">
    <div style="background:#e5e7eb;border-radius:8px;height:16px;width:100%">
      <div style="background:${DIFF_COLORS[d] ?? '#888'};border-radius:8px;height:16px;width:${pct}%"></div>
    </div>
  </td>
  <td style="padding:8px 16px;text-align:center;border:1px solid #e5e7eb;font-weight:600">${pct}%</td>
</tr>`
    })
    .join('\n')

  return `<table style="width:100%;border-collapse:collapse;margin:16px 0">
<thead><tr style="background:#f3f4f6">
  <th style="padding:8px 16px;text-align:left;border:1px solid #e5e7eb;font-size:13px">난이도</th>
  <th style="padding:8px 16px;text-align:center;border:1px solid #e5e7eb;font-size:13px">문항 수</th>
  <th style="padding:8px 16px;text-align:left;border:1px solid #e5e7eb;font-size:13px;min-width:120px">비율</th>
  <th style="padding:8px 16px;text-align:center;border:1px solid #e5e7eb;font-size:13px">%</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>`
}

function questionsTable(questions: BlogData['questions']) {
  const rows = questions
    .map((q) => {
      const diffColor = DIFF_COLORS[q.difficulty] ?? '#333'
      const diffBg = DIFF_BG[q.difficulty] ?? '#f9f9f9'
      const rateColor = q.expectedCorrectRate <= 40 ? '#ef4444' : q.expectedCorrectRate <= 60 ? '#f97316' : '#22c55e'
      return `<tr>
  <td style="padding:6px 12px;text-align:center;border:1px solid #e5e7eb;font-weight:600">${q.number}</td>
  <td style="padding:6px 12px;border:1px solid #e5e7eb">${q.type}</td>
  <td style="padding:6px 12px;border:1px solid #e5e7eb">${q.mainUnit}</td>
  <td style="padding:6px 12px;border:1px solid #e5e7eb">${q.subUnit}</td>
  <td style="padding:6px 12px;text-align:center;border:1px solid #e5e7eb;color:${diffColor};background:${diffBg};font-weight:600">${q.difficulty}</td>
  <td style="padding:6px 12px;text-align:center;border:1px solid #e5e7eb;color:${rateColor};font-weight:600">${q.expectedCorrectRate}%</td>
  <td style="padding:6px 12px;text-align:center;border:1px solid #e5e7eb">${q.score === '-' ? '-' : q.score}</td>
</tr>`
    })
    .join('\n')

  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px">
<thead><tr style="background:#f3f4f6">
  <th style="padding:6px 12px;text-align:center;border:1px solid #e5e7eb">번호</th>
  <th style="padding:6px 12px;text-align:left;border:1px solid #e5e7eb">유형</th>
  <th style="padding:6px 12px;text-align:left;border:1px solid #e5e7eb">대단원</th>
  <th style="padding:6px 12px;text-align:left;border:1px solid #e5e7eb">중단원</th>
  <th style="padding:6px 12px;text-align:center;border:1px solid #e5e7eb">난이도</th>
  <th style="padding:6px 12px;text-align:center;border:1px solid #e5e7eb">예상정답률</th>
  <th style="padding:6px 12px;text-align:center;border:1px solid #e5e7eb">배점</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>`
}

function mainUnitSummary(questions: BlogData['questions']) {
  const map: Record<string, { count: number; avgRate: number; diffs: Record<string, number> }> = {}
  for (const q of questions) {
    const unit = q.mainUnit || '기타'
    if (!map[unit]) map[unit] = { count: 0, avgRate: 0, diffs: {} }
    map[unit].count++
    map[unit].avgRate += q.expectedCorrectRate
    map[unit].diffs[q.difficulty] = (map[unit].diffs[q.difficulty] ?? 0) + 1
  }

  const rows = Object.entries(map)
    .map(([unit, info]) => {
      const avg = Math.round(info.avgRate / info.count)
      const diffStr = Object.entries(info.diffs).map(([d, c]) => `<span style="color:${DIFF_COLORS[d] ?? '#333'}">${d}(${c})</span>`).join(' ')
      return `<tr>
  <td style="padding:8px 16px;font-weight:600;border:1px solid #e5e7eb">${unit}</td>
  <td style="padding:8px 16px;text-align:center;border:1px solid #e5e7eb">${info.count}문항</td>
  <td style="padding:8px 16px;text-align:center;border:1px solid #e5e7eb;font-weight:600">${avg}%</td>
  <td style="padding:8px 16px;border:1px solid #e5e7eb">${diffStr}</td>
</tr>`
    })
    .join('\n')

  return `<table style="width:100%;border-collapse:collapse;margin:16px 0">
<thead><tr style="background:#f3f4f6">
  <th style="padding:8px 16px;text-align:left;border:1px solid #e5e7eb;font-size:13px">단원</th>
  <th style="padding:8px 16px;text-align:center;border:1px solid #e5e7eb;font-size:13px">문항 수</th>
  <th style="padding:8px 16px;text-align:center;border:1px solid #e5e7eb;font-size:13px">평균정답률</th>
  <th style="padding:8px 16px;text-align:left;border:1px solid #e5e7eb;font-size:13px">난이도 분포</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>`
}

export function generateBlogHtml(data: BlogData): string {
  const title = `${data.examYear}년 ${data.school} ${data.grade} ${data.examTerm} ${data.subject} 분석`
  const total = data.questions.length
  const avgR = total > 0 ? Math.round(data.questions.reduce((s, q) => s + q.expectedCorrectRate, 0) / total) : 0

  const featuresHtml = data.keyFeatures
    .map((f) => `  <li style="padding:4px 0">✅ ${f}</li>`)
    .join('\n')

  const killerHtml = data.killerQuestions
    .map(
      (k) => `<div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;margin:12px 0;border-radius:0 8px 8px 0">
  <p style="margin:0 0 4px 0"><strong style="color:#dc2626;font-size:16px">${k.number}번</strong> &nbsp;${k.subUnit} · ${k.intent} · 예상정답률 <strong>${k.rate}%</strong></p>
  <p style="margin:0;color:#666;font-size:14px">${k.reason}</p>
</div>`,
    )
    .join('\n')

  const strategyHtml = data.strategies
    .map(
      (s) => `<div style="background:#eef2ff;border-left:4px solid #6366f1;padding:12px 16px;margin:10px 0;border-radius:0 8px 8px 0">
  <p style="margin:0 0 4px 0"><strong style="color:#4f46e5">📌 ${s.trend}</strong></p>
  <p style="margin:0;color:#555;font-size:14px">→ ${s.strategy}</p>
</div>`,
    )
    .join('\n')

  return `<h1 style="color:#1e1b4b;border-bottom:3px solid #6366f1;padding-bottom:12px">${title}</h1>

<p>안녕하세요, <strong>품격에듀</strong>입니다! ${data.examTerm} ${data.subject} 시험을 분석한 결과를 공유합니다.</p>

<div style="background:#f0f9ff;border-radius:12px;padding:20px;margin:20px 0">
  <p style="margin:0;font-size:18px;font-weight:700;color:#1e40af">📊 시험 개요</p>
  <p style="margin:8px 0 0 0;font-size:15px">총 <strong>${total}문항</strong> · 예상 평균정답률 <strong>${avgR}%</strong></p>
</div>

<h2 style="color:#1e1b4b;margin-top:32px">📊 난이도 분포</h2>
${difficultyTable(data.questions)}

<h2 style="color:#1e1b4b;margin-top:32px">📚 단원별 분석</h2>
${mainUnitSummary(data.questions)}

<h2 style="color:#1e1b4b;margin-top:32px">📋 출제 현황 (전체 문항)</h2>
${questionsTable(data.questions)}

<h2 style="color:#1e1b4b;margin-top:32px">📋 이번 시험의 주요 특징</h2>
<ul style="padding-left:20px">
${featuresHtml}
</ul>

${data.examSummary ? `<h2 style="color:#1e1b4b;margin-top:32px">📝 종합 총평</h2>
<div style="background:#f8fafc;border-radius:12px;padding:16px 20px;margin:12px 0;border:1px solid #e2e8f0">
  <p style="margin:0;line-height:1.8;color:#333;font-size:15px">${data.examSummary}</p>
</div>` : ''}

${data.commonMistakes && data.commonMistakes.length > 0 ? `<h2 style="color:#1e1b4b;margin-top:32px">⚠️ 학생 실수 포인트</h2>
${data.commonMistakes.map((m) => `<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;margin:10px 0;border-radius:0 8px 8px 0">
  <p style="margin:0 0 4px 0"><strong style="color:#b45309;font-size:15px">${m.area}</strong></p>
  <p style="margin:0 0 6px 0;color:#555;font-size:14px">${m.description}</p>
  <p style="margin:0;color:#d97706;font-size:13px;font-weight:600">💡 ${m.tip}</p>
</div>`).join('\n')}` : ''}

<h2 style="color:#1e1b4b;margin-top:32px">📈 전년도 비교</h2>
<div style="background:#f8fafc;border-radius:12px;padding:16px 20px;margin:12px 0;border:1px solid #e2e8f0">
  <p style="margin:0;line-height:1.8">${data.yearOverYearComparison}</p>
</div>

<h2 style="color:#1e1b4b;margin-top:32px">🔥 킬러문항 분석</h2>
${killerHtml}

<h2 style="color:#1e1b4b;margin-top:32px">💡 다음 시험 대비 전략</h2>
${strategyHtml}

${data.teacherComment ? `<h2 style="color:#1e1b4b;margin-top:32px">✏️ 강사 코멘트</h2>
<div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:12px 16px;margin:12px 0;border-radius:0 8px 8px 0">
  <p style="margin:0;line-height:1.8;color:#555">${data.teacherComment}</p>
</div>` : ''}

<p style="text-align:center;color:#9ca3af;margin-top:40px;font-size:13px">─ 품격에듀 AI 시험 분석 리포트 ─</p>
`
}
