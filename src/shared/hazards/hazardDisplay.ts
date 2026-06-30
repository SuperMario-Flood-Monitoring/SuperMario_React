const HAZARD_TYPE_LABELS: Record<string, string> = {
  BLOCKAGE_CLOSED: '완전 막힘',
  BLOCKAGE_HIGH: '막힘 위험',
  CAPACITY_EXCEEDED: '용량 초과',
  FULL_PIPE: '만관',
  NODE_FLOODING: '노드 월류',
  PREDICTED_BLOCKAGE_CLOSED: '막힘 예측',
  PREDICTED_BLOCKAGE_HIGH: '막힘 위험 예측',
  PREDICTED_FULL_PIPE: '만관 예측',
  REVERSE_FLOW: '역류',
  SURCHARGE: '수위 상승',
}

function trimFixedNumber(value: number, digits: number) {
  return value.toFixed(digits).replace(/\.?0+$/, '')
}

function formatFlowCms(value: string) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return `${value}m³/s`
  }

  const absoluteValue = Math.abs(numericValue)
  const digits = absoluteValue >= 1 ? 2 : absoluteValue >= 0.001 ? 4 : 5
  return `${trimFixedNumber(numericValue, digits)}m³/s`
}

export function formatHazardTypeLabel(type: string) {
  return HAZARD_TYPE_LABELS[type] ?? type.replaceAll('_', ' ').toLowerCase()
}

export function formatHazardDetail(detail: string) {
  return detail
    .replace(/\b([A-Za-z][A-Za-z0-9_:-]*)\(\1\)/g, '$1')
    .replace(/현재\s*flowCms=(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)입니다\.?/gi, (_, value: string) => (
      `유량 ${formatFlowCms(value)}입니다.`
    ))
    .replace(/flowCms=(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gi, (_, value: string) => formatFlowCms(value))
}
