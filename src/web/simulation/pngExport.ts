const DEFAULT_EXPORT_SCALE = 5
const MAX_EXPORT_SIDE = 16000
const FALLBACK_EXPORT_SCALES = [5, 4, 3, 2, 1]
const SVG_STYLE_PROPERTIES = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'letter-spacing',
  'text-anchor',
]

function getSvgExportSize(svg: SVGSVGElement, scale = DEFAULT_EXPORT_SCALE) {
  const rect = svg.getBoundingClientRect()
  const viewBox = svg.viewBox.baseVal
  const baseWidth = viewBox.width > 0 ? viewBox.width : rect.width
  const baseHeight = viewBox.height > 0 ? viewBox.height : rect.height
  const safeWidth = Math.max(1, baseWidth)
  const safeHeight = Math.max(1, baseHeight)
  const sideScale = Math.min(scale, MAX_EXPORT_SIDE / safeWidth, MAX_EXPORT_SIDE / safeHeight)
  const width = Math.round(safeWidth * sideScale)

  return {
    width,
    height: Math.max(1, Math.round(width * (safeHeight / safeWidth))),
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function appendScaleToFilename(filename: string, scale: number) {
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex <= 0) {
    return `${filename}-${scale}x`
  }
  return `${filename.slice(0, dotIndex)}-${scale}x${filename.slice(dotIndex)}`
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('PNG로 변환할 SVG 이미지를 불러오지 못했습니다.'))
    image.src = source
  })
}

function createFallbackScales(scale: number) {
  const safeScale = Math.min(scale, getBrowserSafeMaxScale())

  return [
    safeScale,
    ...FALLBACK_EXPORT_SCALES.filter((fallbackScale) => fallbackScale < safeScale),
  ]
}

function getBrowserSafeMaxScale() {
  const userAgent = navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent)

  return isIos || isSafari ? 3 : DEFAULT_EXPORT_SCALE
}

function waitForBrowserCleanup() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(resolve, 0)
    })
  })
}

function inlineComputedSvgStyles(source: SVGSVGElement, target: SVGSVGElement) {
  const sourceElements = [source, ...Array.from(source.querySelectorAll('*'))]
  const targetElements = [target, ...Array.from(target.querySelectorAll('*'))]

  sourceElements.forEach((sourceElement, index) => {
    const targetElement = targetElements[index] as SVGElement | undefined
    if (!targetElement || sourceElement.tagName.toLowerCase().startsWith('animate')) {
      return
    }

    const computedStyle = window.getComputedStyle(sourceElement)
    SVG_STYLE_PROPERTIES.forEach((property) => {
      const value = computedStyle.getPropertyValue(property)
      if (value) {
        targetElement.style.setProperty(property, value)
      }
    })
  })
}

export async function downloadSvgAsPng(
  svg: SVGSVGElement,
  filename: string,
  options: {
    backgroundColor?: string
    scale?: number
  } = {},
) {
  const scales = createFallbackScales(options.scale ?? DEFAULT_EXPORT_SCALE)
  let lastError: unknown = null

  for (const scale of scales) {
    const { width, height } = getSvgExportSize(svg, scale)
    const clonedSvg = svg.cloneNode(true) as SVGSVGElement
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clonedSvg.setAttribute('width', String(width))
    clonedSvg.setAttribute('height', String(height))
    clonedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    clonedSvg.removeAttribute('class')
    clonedSvg.removeAttribute('style')
    clonedSvg.style.width = `${width}px`
    clonedSvg.style.height = `${height}px`
    clonedSvg.style.maxWidth = 'none'
    clonedSvg.style.maxHeight = 'none'
    inlineComputedSvgStyles(svg, clonedSvg)

    const serializedSvg = new XMLSerializer().serializeToString(clonedSvg)
    const svgBlob = new Blob([serializedSvg], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    let image: HTMLImageElement | null = null
    let canvas: HTMLCanvasElement | null = null

    try {
      image = await loadImage(svgUrl)
      canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('PNG 인코딩을 위한 Canvas를 만들지 못했습니다.')
      }

      if (options.backgroundColor) {
        context.fillStyle = options.backgroundColor
        context.fillRect(0, 0, width, height)
      }
      context.drawImage(image, 0, 0, width, height)
      const exportCanvas = canvas

      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        exportCanvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error(`${scale}배율 PNG 인코딩에 실패했습니다.`))
          }
        }, 'image/png')
      })

      downloadBlob(pngBlob, appendScaleToFilename(filename, scale))
      return
    } catch (error) {
      lastError = error
    } finally {
      if (image) {
        image.src = ''
        image.removeAttribute('src')
      }
      if (canvas) {
        canvas.width = 0
        canvas.height = 0
      }
      URL.revokeObjectURL(svgUrl)
    }

    await waitForBrowserCleanup()
  }

  throw lastError instanceof Error ? lastError : new Error('PNG 인코딩에 실패했습니다.')
}
