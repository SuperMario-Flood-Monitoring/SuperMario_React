type PipeOrientation = 'horizontal' | 'vertical'

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

export function PipeBlockageDebrisSvg({
  blockagePercent,
  orientation,
  innerX,
  innerY,
  innerWidth,
  innerHeight,
}: {
  blockagePercent: number
  orientation: PipeOrientation
  innerX: number
  innerY: number
  innerWidth: number
  innerHeight: number
}) {
  const safeBlockagePercent = clampNumber(blockagePercent, 0, 100)
  if (safeBlockagePercent <= 0 || innerWidth <= 0 || innerHeight <= 0) {
    return null
  }

  const ratio = safeBlockagePercent / 100
  const crossAxisLength = orientation === 'horizontal' ? innerHeight : innerWidth
  const minVisibleFill = Math.min(crossAxisLength, Math.max(3, crossAxisLength * 0.1))
  const fillSize = clampNumber(crossAxisLength * ratio, minVisibleFill, crossAxisLength)
  const pileOpacity = clampNumber(0.28 + ratio * 0.42, 0.28, 0.72)
  const clumpCount = Math.round(clampNumber(2 + ratio * 7, 2, 9))
  const debrisWidth = orientation === 'horizontal' ? innerWidth : fillSize
  const debrisHeight = orientation === 'horizontal' ? fillSize : innerHeight
  const debrisX = innerX
  const debrisY = orientation === 'horizontal' ? innerY + innerHeight - debrisHeight : innerY

  return (
    <g pointerEvents="none">
      <rect
        x={debrisX}
        y={debrisY}
        width={debrisWidth}
        height={debrisHeight}
        rx={Math.min(8, Math.max(2, Math.min(debrisWidth, debrisHeight) * 0.18))}
        fill="#7c2d12"
        opacity={pileOpacity}
      />
      {Array.from({ length: clumpCount }, (_, index) => {
        const xRatio = 0.12 + (((index * 37) % 76) / 100)
        const yRatio = 0.18 + (((index * 53) % 64) / 100)
        const radius = clampNumber(Math.min(innerWidth, innerHeight) * (0.08 + (index % 3) * 0.025), 2.5, 10)

        return (
          <ellipse
            key={`pipe-blockage-debris-${index}`}
            cx={debrisX + debrisWidth * xRatio}
            cy={debrisY + debrisHeight * yRatio}
            rx={radius * (1.15 + (index % 2) * 0.25)}
            ry={radius * (0.72 + (index % 3) * 0.08)}
            fill={index % 3 === 0 ? '#451a03' : '#92400e'}
            opacity={clampNumber(0.42 + ratio * 0.38, 0.42, 0.84)}
          />
        )
      })}
    </g>
  )
}
