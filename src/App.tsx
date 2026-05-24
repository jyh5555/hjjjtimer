import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from 'react'
import { puzzles } from 'cubing/puzzles'
import './App.css'

type Phase = 'loading' | 'ready' | 'armed' | 'running'
type PlayerSide = 'left' | 'right'
type SettingsSide = 'top' | 'bottom' | null

type EventOption = {
  id: string
  name: string
  eventId: string
  puzzleId: string
}

type ResultState = {
  leftMs: number | null
  rightMs: number | null
}

type MatchScore = {
  left: number
  right: number
}

type SolveHistory = {
  left: number[]
  right: number[]
}

type HoldState = {
  leftPressed: boolean
  rightPressed: boolean
}

type PointerState = {
  left: number | null
  right: number | null
}

type ScrambowResult = {
  scramble_string: string
}

type ScrambowInstance = {
  setType: (type: string) => ScrambowInstance
  get: (count?: number) => ScrambowResult[]
}

type PlayerStats = {
  recent: number[]
  best: number | null
  mo3: number | null
  ao5: number | null
  ao12: number | null
}

declare global {
  interface Window {
    scrambow?: {
      Scrambow: new () => ScrambowInstance
    }
  }
}

const STORAGE_KEY = 'hjjj-timer-selected-event'
const SCRAMBLE_FONT_SCALE_KEY = 'hjjj-timer-scramble-font-scale'
const GENERATING_TEXT = '\u6b63\u5728\u751f\u6210\u6253\u4e71...'
const FAILED_TEXT = '\u751f\u6210\u5931\u8d25\uff0c\u70b9\u51fb\u4e0b\u4e00\u8f6e\u91cd\u8bd5'
const DEFAULT_FONT_SCALE = 1.08
const MOVE_SUFFIXES = ['', "'", '2']
const PREVIEW_SUPPORTED = new Set(Object.keys(puzzles))
const CUBE_PREVIEW_IDS = new Set([
  '2x2x2',
  '3x3x3',
  '4x4x4',
  '5x5x5',
  '6x6x6',
  '7x7x7',
])
const BIG_CUBE_PREVIEW_IDS = new Set(['4x4x4', '5x5x5', '6x6x6', '7x7x7'])

const EVENTS: EventOption[] = [
  { id: '333', name: '\u4e09\u9636\u901f\u62e7', eventId: '333', puzzleId: '3x3x3' },
  { id: '222', name: '\u4e8c\u9636\u901f\u62e7', eventId: '222', puzzleId: '2x2x2' },
  { id: '444', name: '\u56db\u9636\u901f\u62e7', eventId: '444', puzzleId: '4x4x4' },
  { id: '555', name: '\u4e94\u9636\u901f\u62e7', eventId: '555', puzzleId: '5x5x5' },
  { id: '666', name: '\u516d\u9636\u901f\u62e7', eventId: '666', puzzleId: '6x6x6' },
  { id: '777', name: '\u4e03\u9636\u901f\u62e7', eventId: '777', puzzleId: '7x7x7' },
  { id: '333oh', name: '\u4e09\u9636\u5355\u624b', eventId: '333oh', puzzleId: '3x3x3' },
  { id: '333bf', name: '\u4e09\u9636\u76f2\u62e7', eventId: '333bf', puzzleId: '3x3x3' },
  { id: 'clock', name: '\u9b54\u8868', eventId: 'clock', puzzleId: 'clock' },
  { id: 'minx', name: '\u4e94\u9b54', eventId: 'minx', puzzleId: 'megaminx' },
  { id: 'pyram', name: '\u91d1\u5b57\u5854', eventId: 'pyram', puzzleId: 'pyraminx' },
  { id: 'skewb', name: '\u659c\u8f6c', eventId: 'skewb', puzzleId: 'skewb' },
  { id: 'sq1', name: 'SQ-1', eventId: 'sq1', puzzleId: 'square1' },
  { id: 'fto', name: 'FTO', eventId: 'fto', puzzleId: 'fto' },
]

const EMPTY_HOLD_STATE: HoldState = {
  leftPressed: false,
  rightPressed: false,
}

function loadInitialSelectedId(): string {
  if (typeof window === 'undefined') {
    return EVENTS[0].id
  }

  try {
    const storedId = window.localStorage.getItem(STORAGE_KEY)
    const matched = EVENTS.find((event) => event.id === storedId)
    return matched?.id ?? EVENTS[0].id
  } catch {
    return EVENTS[0].id
  }
}

function loadInitialFontScale(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_FONT_SCALE
  }

  try {
    const raw = window.localStorage.getItem(SCRAMBLE_FONT_SCALE_KEY)
    const parsed = Number(raw)
    if (Number.isFinite(parsed) && parsed >= 0.75 && parsed <= 1.45) {
      return parsed
    }
  } catch {
    return DEFAULT_FONT_SCALE
  }

  return DEFAULT_FONT_SCALE
}

function formatTime(ms: number | null): string {
  if (ms === null) {
    return '0.000'
  }

  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = ms % 1000

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds
      .toString()
      .padStart(3, '0')}`
  }

  return `${seconds}.${milliseconds.toString().padStart(3, '0')}`
}

function formatMetric(ms: number | null): string {
  return ms === null ? '--' : formatTime(ms)
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function pickMove(pool: string[], previousAxis: string | null): string {
  let move = randomItem(pool)
  while (move[0] === previousAxis) {
    move = randomItem(pool)
  }
  return move + randomItem(MOVE_SUFFIXES)
}

function fallbackCubeScramble(pool: string[], length: number): string {
  const moves: string[] = []
  let previousAxis: string | null = null

  for (let index = 0; index < length; index += 1) {
    const move = pickMove(pool, previousAxis)
    previousAxis = move[0]
    moves.push(move)
  }

  return moves.join(' ')
}

function fallbackClockScramble(): string {
  const pins = ['UR', 'DR', 'DL', 'UL']
  const parts = pins.map(
    (pin) => `${pin}${Math.floor(Math.random() * 6)}${Math.random() > 0.5 ? '+' : '-'}`,
  )
  parts.push(`U${Math.floor(Math.random() * 6)}${Math.random() > 0.5 ? '+' : '-'}`)
  parts.push(`R${Math.floor(Math.random() * 6)}${Math.random() > 0.5 ? '+' : '-'}`)
  parts.push(`D${Math.floor(Math.random() * 6)}${Math.random() > 0.5 ? '+' : '-'}`)
  parts.push(`L${Math.floor(Math.random() * 6)}${Math.random() > 0.5 ? '+' : '-'}`)
  parts.push(`ALL${Math.floor(Math.random() * 6)}${Math.random() > 0.5 ? '+' : '-'}`)
  parts.push('y2')
  return parts.join(' ')
}

function fallbackMinxScramble(): string {
  const lines: string[] = []
  for (let line = 0; line < 7; line += 1) {
    const row: string[] = []
    for (let index = 0; index < 10; index += 1) {
      row.push(`${index % 2 === 0 ? 'R' : 'D'}${Math.random() > 0.5 ? '++' : '--'}`)
    }
    row.push(Math.random() > 0.5 ? 'U' : "U'")
    lines.push(row.join(' '))
  }
  return lines.join('\n')
}

function fallbackSq1Scramble(): string {
  const parts: string[] = []
  for (let index = 0; index < 12; index += 1) {
    const top = Math.floor(Math.random() * 13) - 6
    const bottom = Math.floor(Math.random() * 13) - 6
    parts.push(`(${top}, ${bottom})`)
    if (index < 11) {
      parts.push('/')
    }
  }
  return parts.join(' ')
}

function fallbackFTOScramble(): string {
  return fallbackCubeScramble(['U', 'D', 'L', 'R', 'F', 'B', 'BR', 'BL'], 30)
}

function fallbackScrambleForEvent(eventId: string): string {
  switch (eventId) {
    case '222':
      return fallbackCubeScramble(['R', 'U', 'F'], 10)
    case '333':
    case '333oh':
    case '333bf':
      return fallbackCubeScramble(['R', 'L', 'U', 'D', 'F', 'B'], 20)
    case '444':
      return fallbackCubeScramble(
        ['R', 'L', 'U', 'D', 'F', 'B', 'Rw', 'Lw', 'Uw', 'Dw', 'Fw', 'Bw'],
        40,
      )
    case '555':
      return fallbackCubeScramble(
        ['R', 'L', 'U', 'D', 'F', 'B', 'Rw', 'Lw', 'Uw', 'Dw', 'Fw', 'Bw'],
        60,
      )
    case '666':
      return fallbackCubeScramble(
        [
          'R',
          'L',
          'U',
          'D',
          'F',
          'B',
          'Rw',
          'Lw',
          'Uw',
          'Dw',
          'Fw',
          'Bw',
          '3Rw',
          '3Lw',
          '3Uw',
          '3Dw',
          '3Fw',
          '3Bw',
        ],
        80,
      )
    case '777':
      return fallbackCubeScramble(
        [
          'R',
          'L',
          'U',
          'D',
          'F',
          'B',
          'Rw',
          'Lw',
          'Uw',
          'Dw',
          'Fw',
          'Bw',
          '3Rw',
          '3Lw',
          '3Uw',
          '3Dw',
          '3Fw',
          '3Bw',
        ],
        100,
      )
    case 'clock':
      return fallbackClockScramble()
    case 'minx':
      return fallbackMinxScramble()
    case 'pyram':
      return fallbackCubeScramble(['R', 'L', 'U', 'B', 'r', 'l', 'u', 'b'], 12)
    case 'skewb':
      return fallbackCubeScramble(['R', 'L', 'U', 'B'], 10)
    case 'sq1':
      return fallbackSq1Scramble()
    case 'fto':
      return fallbackFTOScramble()
    default:
      return fallbackCubeScramble(['R', 'L', 'U', 'D', 'F', 'B'], 20)
  }
}

function getScrambleType(eventId: string): string {
  switch (eventId) {
    case '333oh':
    case '333bf':
      return '333'
    case 'minx':
      return 'megaminx'
    case 'pyram':
      return 'pyraminx'
    case 'sq1':
      return 'square1'
    default:
      return eventId
  }
}

function isScrambleRenderable(scramble: string): boolean {
  return !!scramble && scramble !== GENERATING_TEXT && scramble !== FAILED_TEXT
}

function getScrambleStyle(scramble: string, fontScale: number): CSSProperties {
  let fontSize = 1.08
  let lineHeight = 1.18

  if (scramble.length > 170) {
    fontSize = 0.74
    lineHeight = 1.03
  } else if (scramble.length > 110) {
    fontSize = 0.9
    lineHeight = 1.1
  }

  return {
    fontSize: `${fontSize * fontScale}rem`,
    lineHeight,
  }
}


function rotateArrayPoints(arr: [number[], number[]], theta: number): [number[], number[]] {
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const outX: number[] = []
  const outY: number[] = []
  for (let i = 0; i < arr[0].length; i += 1) {
    outX.push(arr[0][i] * cos - arr[1][i] * sin)
    outY.push(arr[0][i] * sin + arr[1][i] * cos)
  }
  return [outX, outY]
}

function scaleTranslateArrayPoints(
  arr: [number[], number[]],
  scale: number,
  tx: number,
  ty: number,
): [number[], number[]] {
  return [
    arr[0].map((x) => x * scale + tx * scale),
    arr[1].map((y) => y * scale + ty * scale),
  ]
}

function circleShift<T>(arr: T[], ...indices: number[]) {
  const temp = arr[indices[indices.length - 1]]
  for (let i = indices.length - 1; i > 0; i -= 1) {
    arr[indices[i]] = arr[indices[i - 1]]
  }
  arr[indices[0]] = temp
}

function drawCanvasPolygon(
  ctx: CanvasRenderingContext2D,
  color: string,
  arr: [number[], number[]],
  trans: [number, number, number],
) {
  const transformed = scaleTranslateArrayPoints(arr, trans[0], trans[1], trans[2])
  ctx.beginPath()
  ctx.fillStyle = color
  ctx.moveTo(transformed[0][0], transformed[1][0])
  for (let index = 1; index < transformed[0].length; index += 1) {
    ctx.lineTo(transformed[0][index], transformed[1][index])
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function renderClockPreviewCanvas(canvas: HTMLCanvasElement, scramble: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }

  canvas.width = 420
  canvas.height = 180
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const moveArr = [
    [0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
    [1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
    [11, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 1, 1, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 1, 1, 0, 1],
    [0, 0, 11, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0],
    [11, 0, 11, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
    [11, 0, 0, 0, 0, 0, 11, 0, 0, 1, 0, 1, 1, 1],
    [0, 0, 0, 0, 0, 0, 11, 0, 11, 0, 1, 1, 1, 1],
    [0, 0, 11, 0, 0, 0, 0, 0, 11, 1, 1, 1, 0, 1],
    [11, 0, 11, 0, 0, 0, 11, 0, 11, 1, 1, 1, 1, 1],
  ]
  const moveNames = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL']
  const moveRe = /([UD][RL]|ALL|[UDRLy])(\d[+-]?)?/
  let flip = 9
  const buttons = [0, 0, 0, 0]
  const clks = new Array<number>(14).fill(0)

  for (const move of scramble.split(/\s+/)) {
    const match = moveRe.exec(move)
    if (!match) {
      continue
    }
    if (match[0] === 'y2') {
      flip = 0
      continue
    }
    const axis = moveNames.indexOf(match[1]) + flip
    if (match[2] === undefined) {
      buttons[axis % 9] = 1
      continue
    }
    const power = match[2][1] === '+' ? Number(match[2][0]) : 12 - Number(match[2][0])
    for (let index = 0; index < 14; index += 1) {
      clks[index] = (clks[index] + moveArr[axis][index] * power) % 12
    }
  }

  const shownClocks = [
    clks[0], clks[3], clks[6], clks[1], clks[4], clks[7], clks[2], clks[5], clks[8],
    12 - clks[2], clks[10], 12 - clks[8], clks[9], clks[11], clks[13], 12 - clks[0], clks[12], 12 - clks[6],
  ]
  const handBase: [number[], number[]] = [
    [1, 1, 0, -1, -1, -1, 1, 0],
    [0, -1, -8, -1, 0, 1, 1, 0],
  ]

  const drawDial = (
    cx: number,
    cy: number,
    radius: number,
    angle: number,
    faceColor: string,
    handColor: string,
  ) => {
    ctx.beginPath()
    ctx.fillStyle = faceColor
    ctx.strokeStyle = '#e6eef8'
    ctx.lineWidth = 2.2
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    const rotated = rotateArrayPoints(handBase, (angle / 6) * Math.PI)
    const transformed = scaleTranslateArrayPoints(rotated, radius / 9, cx / (radius / 9), cy / (radius / 9))
    ctx.beginPath()
    ctx.fillStyle = handColor
    ctx.strokeStyle = handColor
    ctx.lineWidth = 1.4
    ctx.moveTo(transformed[0][0], transformed[1][0])
    for (let index = 1; index < transformed[0].length - 1; index += 1) {
      ctx.lineTo(transformed[0][index], transformed[1][index])
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    ctx.beginPath()
    ctx.fillStyle = '#6e4200'
    ctx.arc(cx, cy, radius * 0.16, 0, Math.PI * 2)
    ctx.fill()
  }

  const leftX = [56, 102, 148]
  const rightX = [272, 318, 364]
  const rowY = [44, 90, 136]
  for (let index = 0; index < 18; index += 1) {
    const column = Math.floor(index / 3) % 3
    const cx = index < 9 ? leftX[column] : rightX[column]
    const cy = rowY[index % 3]
    if (index < 9) {
      drawDial(cx, cy, 18, shownClocks[index], '#4c7ec9', '#ffef58')
    } else {
      drawDial(cx, cy, 18, shownClocks[index], '#68c7f4', '#ffef58')
    }
  }

}

function renderSquare1PreviewCanvas(canvas: HTMLCanvasElement, scramble: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }

  canvas.width = 495
  canvas.height = 284
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.lineJoin = 'round'
  ctx.lineWidth = 1.8
  ctx.strokeStyle = '#000000'

  const hsq3 = Math.sqrt(3) / 2
  const ep: [number[], number[]] = [
    [0, -0.5, 0.5],
    [0, -hsq3 - 1, -hsq3 - 1],
  ]
  const cp: [number[], number[]] = [
    [0, -0.5, -hsq3 - 1, -hsq3 - 1],
    [0, -hsq3 - 1, -hsq3 - 1, -0.5],
  ]
  const cpr: [number[], number[]] = [
    [0, -0.5, -hsq3 - 1],
    [0, -hsq3 - 1, -hsq3 - 1],
  ]
  const cpl: [number[], number[]] = [
    [0, -hsq3 - 1, -hsq3 - 1],
    [0, -hsq3 - 1, -0.5],
  ]
  const eps = scaleTranslateArrayPoints(ep, 0.66, 0, 0)
  const cps = scaleTranslateArrayPoints(cp, 0.66, 0, 0)

  const colors = {
    U: '#ffec47',
    R: '#ff9800',
    F: '#30d158',
    D: '#ffffff',
    L: '#ff3b30',
    B: '#2563eb',
  }
  const udcol = 'UD'
  const ecol = '-B-R-F-L-B-R-F-L'
  const ccol = 'LBBRRFFLBLRBFRLF'
  const width = 45
  const movere = /^\s*\(\s*(-?\d+),\s*(-?\d+)\s*\)\s*$/
  let posit = [0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 12, 12, 13, 14, 14, 15]
  let mid = 0

  const doMove = (move: [number, number, number]) => {
    const next = [] as number[]
    for (let i = 0; i < 12; i += 1) {
      next[(i + move[0]) % 12] = posit[i]
      next[i + 12] = posit[((i + move[1]) % 12) + 12]
    }
    if (move[2]) {
      mid = 1 - mid
      for (let i = 0; i < 6; i += 1) {
        circleShift(next, i + 6, 23 - i)
      }
    }
    posit = next
  }

  for (const move of scramble.split('/')) {
    if (/^\s*$/.test(move)) {
      doMove([0, 0, 1])
      continue
    }
    const match = movere.exec(move)
    if (!match) {
      continue
    }
    doMove([Number(match[1]) + 12, Number(match[2]) + 12, 1])
  }
  doMove([0, 0, 1])

  const topTrans: [number, number, number] = [width, 2.7, 2.7]
  const bottomTrans: [number, number, number] = [width, 8.1, 2.7]
  const midTrans: [number, number, number] = [width, 5.4, 5.7]

  for (let i = 0; i < 12; i += 1) {
    if (posit[i] % 2 === 0) {
      if (posit[i] !== posit[(i + 1) % 12]) {
        continue
      }
      drawCanvasPolygon(ctx, colors[ccol[posit[i]] as keyof typeof colors], rotateArrayPoints(cpl, (i - 3) * Math.PI / 6), topTrans)
      drawCanvasPolygon(ctx, colors[ccol[posit[i] + 1] as keyof typeof colors], rotateArrayPoints(cpr, (i - 3) * Math.PI / 6), topTrans)
      drawCanvasPolygon(ctx, colors[udcol[posit[i] >= 8 ? 1 : 0] as keyof typeof colors], rotateArrayPoints(cps, (i - 3) * Math.PI / 6), topTrans)
    } else {
      drawCanvasPolygon(ctx, colors[ecol[posit[i]] as keyof typeof colors], rotateArrayPoints(ep, (i - 5) * Math.PI / 6), topTrans)
      drawCanvasPolygon(ctx, colors[udcol[posit[i] >= 8 ? 1 : 0] as keyof typeof colors], rotateArrayPoints(eps, (i - 5) * Math.PI / 6), topTrans)
    }
  }

  for (let i = 12; i < 24; i += 1) {
    if (posit[i] % 2 === 0) {
      if (posit[i] !== posit[((i + 1) % 12) + 12]) {
        continue
      }
      drawCanvasPolygon(ctx, colors[ccol[posit[i]] as keyof typeof colors], rotateArrayPoints(cpl, -i * Math.PI / 6), bottomTrans)
      drawCanvasPolygon(ctx, colors[ccol[posit[i] + 1] as keyof typeof colors], rotateArrayPoints(cpr, -i * Math.PI / 6), bottomTrans)
      drawCanvasPolygon(ctx, colors[udcol[posit[i] >= 8 ? 1 : 0] as keyof typeof colors], rotateArrayPoints(cps, -i * Math.PI / 6), bottomTrans)
    } else {
      drawCanvasPolygon(ctx, colors[ecol[posit[i]] as keyof typeof colors], rotateArrayPoints(ep, (-1 - i) * Math.PI / 6), bottomTrans)
      drawCanvasPolygon(ctx, colors[udcol[posit[i] >= 8 ? 1 : 0] as keyof typeof colors], rotateArrayPoints(eps, (-1 - i) * Math.PI / 6), bottomTrans)
    }
  }

  drawCanvasPolygon(
    ctx,
    colors.L,
    [[-hsq3 - 1, -hsq3 - 1, -0.5, -0.5], [0.5, -0.5, -0.5, 0.5]],
    midTrans,
  )
  drawCanvasPolygon(
    ctx,
    mid === 0 ? colors.L : colors.R,
    mid === 0
      ? [[hsq3 + 1, hsq3 + 1, -0.5, -0.5], [0.5, -0.5, -0.5, 0.5]]
      : [[hsq3, hsq3, -0.5, -0.5], [0.5, -0.5, -0.5, 0.5]],
    midTrans,
  )
}

function normalizePreviewSvg(svgElement: SVGElement, puzzleId: string) {
  svgElement.querySelectorAll('title, desc').forEach((node) => node.remove())

  if (CUBE_PREVIEW_IDS.has(puzzleId)) {
    svgElement.querySelectorAll('.hint-facelet').forEach((node) => node.remove())
  }

  svgElement.removeAttribute('width')
  svgElement.removeAttribute('height')
  svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  svgElement.style.width = '100%'
  svgElement.style.height = '100%'
  svgElement.style.display = 'block'
}

function averageTimes(times: number[]): number | null {
  if (times.length === 0) {
    return null
  }

  return Math.round(times.reduce((sum, value) => sum + value, 0) / times.length)
}

function wcaAverage(times: number[]): number | null {
  if (times.length < 5) {
    return null
  }

  const sorted = [...times].sort((a, b) => a - b)
  return averageTimes(sorted.slice(1, -1))
}

function computePlayerStats(times: number[]): PlayerStats {
  return {
    recent: times.slice(-5).reverse(),
    best: times.length > 0 ? Math.min(...times) : null,
    mo3: times.length >= 3 ? averageTimes(times.slice(-3)) : null,
    ao5: times.length >= 5 ? wcaAverage(times.slice(-5)) : null,
    ao12: times.length >= 12 ? wcaAverage(times.slice(-12)) : null,
  }
}

function HistoryPanel({ history }: { history: number[] }) {
  const stats = useMemo(() => computePlayerStats(history), [history])
  const placeholders = Math.max(0, 5 - stats.recent.length)

  return (
    <div className="history-card">
      <div className="history-card-header">{'\u6700\u8fd15\u628a'}</div>
      <div className="history-list">
        {stats.recent.map((value, index) => (
          <div key={`${value}-${index}`} className="history-row">
            <span>{index + 1}</span>
            <strong>{formatTime(value)}</strong>
          </div>
        ))}
        {Array.from({ length: placeholders }, (_, index) => (
          <div key={`empty-${index}`} className="history-row is-empty">
            <span>{stats.recent.length + index + 1}</span>
            <strong>--</strong>
          </div>
        ))}
      </div>

      <div className="history-stats-grid">
        <div className="history-stat-item">
          <span>mo3</span>
          <strong>{formatMetric(stats.mo3)}</strong>
        </div>
        <div className="history-stat-item">
          <span>ao5</span>
          <strong>{formatMetric(stats.ao5)}</strong>
        </div>
        <div className="history-stat-item">
          <span>ao12</span>
          <strong>{formatMetric(stats.ao12)}</strong>
        </div>
        <div className="history-stat-item">
          <span>{'\u5355\u6b21'}</span>
          <strong>{formatMetric(stats.best)}</strong>
        </div>
      </div>
    </div>
  )
}

function ScramblePreview({
  puzzleId,
  scramble,
}: {
  puzzleId: string
  scramble: string
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const supported = PREVIEW_SUPPORTED.has(puzzleId)
  const canRender = supported && isScrambleRenderable(scramble)
  const hostClassName = `scramble-preview-host${
    puzzleId === 'clock'
      ? ' is-clock'
      : puzzleId === 'square1'
        ? ' is-square1'
        : BIG_CUBE_PREVIEW_IDS.has(puzzleId)
          ? ' is-big-cube'
          : ''
  }`

  useEffect(() => {
    const host = hostRef.current
    if (!host) {
      return
    }

    host.innerHTML = ''

    if (!canRender) {
      return
    }

    let cancelled = false

    void (async () => {
      try {
        if (puzzleId === 'clock' || puzzleId === 'square1') {
          if (cancelled || !hostRef.current) {
            return
          }

          const canvas = document.createElement('canvas')
          const image = document.createElement('img')
          image.className = 'scramble-preview-player'
          hostRef.current.innerHTML = ''

          if (puzzleId === 'clock') {
            renderClockPreviewCanvas(canvas, scramble)
          } else {
            renderSquare1PreviewCanvas(canvas, scramble)
          }

          image.src = canvas.toDataURL('image/png')
          hostRef.current.appendChild(image)
          return
        }

        const loader = puzzles[puzzleId]
        if (!loader?.svg) {
          return
        }

        const [kpuzzle, svgSource] = await Promise.all([loader.kpuzzle(), loader.svg()])
        if (cancelled || !hostRef.current) {
          return
        }

        const parser = new DOMParser()
        const svgDoc = parser.parseFromString(svgSource, 'image/svg+xml')
        const svgElement = svgDoc.querySelector('svg')
        if (!svgElement) {
          return
        }

        const pattern = kpuzzle.defaultPattern().applyAlg(scramble)
        const originalColors: Record<string, string> = {}

        const elementId = (orbitName: string, pieceIdx: number, orientation: number) =>
          `${orbitName}-l${pieceIdx}-o${orientation}`

        for (const orbitDefinition of kpuzzle.definition.orbits) {
          for (let idx = 0; idx < orbitDefinition.numPieces; idx += 1) {
            for (let orientation = 0; orientation < orbitDefinition.numOrientations; orientation += 1) {
              const id = elementId(orbitDefinition.orbitName, idx, orientation)
              const elem = svgElement.querySelector<SVGElement>(`#${CSS.escape(id)}`)
              if (!elem) {
                continue
              }

              const inlineStyle = elem.getAttribute('style') ?? ''
              const fillMatch = inlineStyle.match(/fill:\s*([^;]+)/i)
              originalColors[id] = fillMatch?.[1]?.trim() ?? '#888888'
            }
          }
        }

        for (const orbitDefinition of kpuzzle.definition.orbits) {
          const orbit = pattern.patternData[orbitDefinition.orbitName]
          for (let idx = 0; idx < orbitDefinition.numPieces; idx += 1) {
            for (let orientation = 0; orientation < orbitDefinition.numOrientations; orientation += 1) {
              const targetId = elementId(orbitDefinition.orbitName, idx, orientation)
              const fromId = elementId(
                orbitDefinition.orbitName,
                orbit.pieces[idx],
                (orbitDefinition.numOrientations - orbit.orientation[idx] + orientation) %
                  orbitDefinition.numOrientations,
              )

              const elem = svgElement.querySelector<SVGElement>(`#${CSS.escape(targetId)}`)
              const fill = originalColors[fromId]
              if (!elem || !fill) {
                continue
              }

              elem.style.fill = fill
            }
          }
        }

        normalizePreviewSvg(svgElement, puzzleId)
        svgElement.classList.add('scramble-preview-player')

        hostRef.current.innerHTML = ''
        hostRef.current.appendChild(svgElement)
      } catch (error) {
        console.error(error)
      }
    })()

    return () => {
      cancelled = true
      host.innerHTML = ''
    }
  }, [canRender, puzzleId, scramble])

  if (!canRender) {
    return null
  }

  return <div ref={hostRef} className={hostClassName} />
}

function App() {
  const [selectedEventId, setSelectedEventId] = useState(loadInitialSelectedId)
  const [scrambleFontScale, setScrambleFontScale] = useState(loadInitialFontScale)
  const [sharedScramble, setSharedScramble] = useState(GENERATING_TEXT)
  const [phase, setPhase] = useState<Phase>('loading')
  const [results, setResults] = useState<ResultState>({ leftMs: null, rightMs: null })
  const [score, setScore] = useState<MatchScore>({ left: 0, right: 0 })
  const [history, setHistory] = useState<SolveHistory>({ left: [], right: [] })
  const [displayNow, setDisplayNow] = useState(0)
  const [holdState, setHoldState] = useState<HoldState>(EMPTY_HOLD_STATE)
  const [settingsSide, setSettingsSide] = useState<SettingsSide>(null)

  const raceStartRef = useRef<number | null>(null)
  const finishedAtRef = useRef<ResultState>({ leftMs: null, rightMs: null })
  const nextRoundTokenRef = useRef(0)
  const pressedRef = useRef<HoldState>(EMPTY_HOLD_STATE)
  const pointerIdsRef = useRef<PointerState>({ left: null, right: null })
  const scrambowRef = useRef<ScrambowInstance | null>(null)

  const selectedEvent = useMemo(
    () => EVENTS.find((event) => event.id === selectedEventId) ?? EVENTS[0],
    [selectedEventId],
  )

  const scrambleStyle = useMemo(
    () => getScrambleStyle(sharedScramble, scrambleFontScale),
    [sharedScramble, scrambleFontScale],
  )

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, selectedEventId)
  }, [selectedEventId])

  useEffect(() => {
    window.localStorage.setItem(SCRAMBLE_FONT_SCALE_KEY, scrambleFontScale.toFixed(2))
  }, [scrambleFontScale])

  useEffect(() => {
    if (phase !== 'running') {
      return undefined
    }

    let frameId = 0
    const tick = () => {
      setDisplayNow(performance.now())
      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [phase])

  useEffect(() => {
    void generateRound({ resetScore: true, clearResults: true, clearHistory: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent.id])

  function getScrambow(): ScrambowInstance | null {
    if (scrambowRef.current) {
      return scrambowRef.current
    }

    const ctor = window.scrambow?.Scrambow
    if (!ctor) {
      return null
    }

    scrambowRef.current = new ctor()
    return scrambowRef.current
  }

  async function ensureScrambowLoaded(): Promise<void> {
    if (window.scrambow?.Scrambow) {
      return
    }

    await new Promise<void>((resolve) => {
      const startedAt = performance.now()
      const timer = window.setInterval(() => {
        if (window.scrambow?.Scrambow || performance.now() - startedAt > 3000) {
          window.clearInterval(timer)
          resolve()
        }
      }, 50)
    })
  }

  function stopPropagation(event: SyntheticEvent) {
    event.stopPropagation()
  }

  function clearTouchState() {
    setHoldState(EMPTY_HOLD_STATE)
    pressedRef.current = EMPTY_HOLD_STATE
    pointerIdsRef.current = { left: null, right: null }
  }

  async function generateRound(options?: {
    resetScore?: boolean
    clearResults?: boolean
    clearHistory?: boolean
  }) {
    nextRoundTokenRef.current += 1
    const token = nextRoundTokenRef.current

    if (options?.resetScore) {
      setScore({ left: 0, right: 0 })
    }
    if (options?.clearHistory) {
      setHistory({ left: [], right: [] })
    }
    if (options?.clearResults) {
      setResults({ leftMs: null, rightMs: null })
      finishedAtRef.current = { leftMs: null, rightMs: null }
    }

    setPhase('loading')
    setSettingsSide(null)
    setSharedScramble(GENERATING_TEXT)
    raceStartRef.current = null
    setDisplayNow(0)
    clearTouchState()

    try {
      await ensureScrambowLoaded()
      const scrambow = getScrambow()
      const scramble = scrambow
        ? scrambow.setType(getScrambleType(selectedEvent.eventId)).get()[0].scramble_string.trim()
        : fallbackScrambleForEvent(selectedEvent.eventId)

      if (token !== nextRoundTokenRef.current) {
        return
      }

      setSharedScramble(scramble)
      setPhase('ready')
    } catch (error) {
      console.error(error)
      if (token !== nextRoundTokenRef.current) {
        return
      }

      setSharedScramble(FAILED_TEXT)
      setPhase('ready')
    }
  }

  function handleEventChange(nextEventId: string) {
    if (nextEventId === selectedEventId) {
      setSettingsSide(null)
      return
    }

    setSettingsSide(null)
    setSelectedEventId(nextEventId)
  }

  function toggleSettings(side: Exclude<SettingsSide, null>) {
    setSettingsSide((current) => (current === side ? null : side))
  }

  function startRace() {
    const startAt = performance.now()
    raceStartRef.current = startAt
    finishedAtRef.current = { leftMs: null, rightMs: null }
    setResults({ leftMs: null, rightMs: null })
    setDisplayNow(startAt)
    setPhase('running')
    setSettingsSide(null)
    clearTouchState()
  }

  function setPressed(side: PlayerSide, value: boolean) {
    const key = side === 'left' ? 'leftPressed' : 'rightPressed'
    const next = {
      ...pressedRef.current,
      [key]: value,
    }
    pressedRef.current = next
    setHoldState(next)
  }

  function handlePressStart(side: PlayerSide) {
    if (phase === 'running') {
      handleStop(side)
      return
    }

    if (phase !== 'ready' && phase !== 'armed') {
      return
    }

    setPhase('armed')
    setSettingsSide(null)
    setPressed(side, true)
  }

  function handlePressEnd(side: PlayerSide) {
    if (phase !== 'ready' && phase !== 'armed') {
      return
    }

    const wasBothPressed = pressedRef.current.leftPressed && pressedRef.current.rightPressed
    setPressed(side, false)

    if (wasBothPressed) {
      startRace()
      return
    }

    if (!pressedRef.current.leftPressed && !pressedRef.current.rightPressed) {
      setPhase('ready')
    }
  }

  function handleStop(side: PlayerSide) {
    if (phase !== 'running') {
      return
    }

    const start = raceStartRef.current
    if (start === null) {
      return
    }

    const key = side === 'left' ? 'leftMs' : 'rightMs'
    if (finishedAtRef.current[key] !== null) {
      return
    }

    const currentMs = Math.round(performance.now() - start)
    const nextResults = {
      ...finishedAtRef.current,
      [key]: currentMs,
    }

    finishedAtRef.current = nextResults
    setResults(nextResults)

    if (nextResults.leftMs !== null && nextResults.rightMs !== null) {
      if (nextResults.leftMs < nextResults.rightMs) {
        setScore((current) => ({ left: current.left + 1, right: current.right }))
      } else if (nextResults.rightMs < nextResults.leftMs) {
        setScore((current) => ({ left: current.left, right: current.right + 1 }))
      }

      setHistory((current) => ({
        left: [...current.left, nextResults.leftMs as number],
        right: [...current.right, nextResults.rightMs as number],
      }))

      void generateRound()
    }
  }

  function currentDisplay(side: PlayerSide): string {
    const stored = side === 'left' ? results.leftMs : results.rightMs
    if (stored !== null) {
      return formatTime(stored)
    }

    if (phase !== 'running' || raceStartRef.current === null) {
      return '0.000'
    }

    return formatTime(Math.max(0, Math.round(displayNow - raceStartRef.current)))
  }

  function renderMenu(side: Exclude<SettingsSide, null>, mirrored = false) {
    if (settingsSide !== side) {
      return null
    }

    return (
      <div
        className={`settings-drawer ${mirrored ? 'is-mirrored' : ''} ${
          side === 'top' ? 'is-top' : 'is-bottom'
        }`}
        onPointerDown={() => setSettingsSide(null)}
      >
        <div className="drawer-sheet" onPointerDown={stopPropagation} onClick={stopPropagation}>
          <div className="drawer-actions">
            <button type="button" className="drawer-action-button" onClick={() => void generateRound()}>
              {'\u4e0b\u4e00\u8f6e'}
            </button>
            <button
              type="button"
              className="drawer-action-button"
              onClick={() => {
                setScore({ left: 0, right: 0 })
                setHistory({ left: [], right: [] })
                setSettingsSide(null)
              }}
            >
              {'\u91cd\u7f6e\u6bd4\u5206'}
            </button>
          </div>

          <label className="drawer-slider-card">
            <span className="drawer-slider-label">
              {'\u6253\u4e71\u5b57\u53f7'}
              <strong>{Math.round(scrambleFontScale * 100)}%</strong>
            </span>
            <input
              className="drawer-slider"
              type="range"
              min="75"
              max="145"
              step="1"
              value={Math.round(scrambleFontScale * 100)}
              onChange={(event) => setScrambleFontScale(Number(event.target.value) / 100)}
            />
          </label>

          <div className="drawer-event-list">
            {EVENTS.map((eventOption) => (
              <button
                key={eventOption.id}
                type="button"
                className={`drawer-event-item${eventOption.id === selectedEventId ? ' is-active' : ''}`}
                onClick={() => handleEventChange(eventOption.id)}
              >
                <span>{eventOption.name}</span>
                <small>{eventOption.eventId}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>, side: PlayerSide) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    const key = side === 'left' ? 'left' : 'right'
    if (pointerIdsRef.current[key] !== null) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointerIdsRef.current = {
      ...pointerIdsRef.current,
      [key]: event.pointerId,
    }
    handlePressStart(side)
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>, side: PlayerSide) {
    const key = side === 'left' ? 'left' : 'right'
    if (pointerIdsRef.current[key] !== event.pointerId) {
      return
    }

    event.preventDefault()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    pointerIdsRef.current = {
      ...pointerIdsRef.current,
      [key]: null,
    }
    handlePressEnd(side)
  }

  const bothPressed = holdState.leftPressed && holdState.rightPressed
  const leftStateClass = bothPressed
    ? ' is-both-pressed'
    : holdState.leftPressed
      ? ' is-one-pressed'
      : ''
  const rightStateClass = bothPressed
    ? ' is-both-pressed'
    : holdState.rightPressed
      ? ' is-one-pressed'
      : ''

  return (
    <main className="app-shell">
      <section className="duel-layout">
        <section className="player-zone player-zone-top">
          <div
            className={`player-pad${leftStateClass}`}
            onPointerDown={(event) => handlePointerDown(event, 'left')}
            onPointerUp={(event) => handlePointerUp(event, 'left')}
            onPointerCancel={(event) => handlePointerUp(event, 'left')}
          >
            <div className="player-content rotated">
              <p className="scramble-block" style={scrambleStyle}>
                {sharedScramble}
              </p>
              <div className="player-side-widget player-side-widget-left">
                <HistoryPanel history={history.left} />
              </div>
              <div className="player-side-widget player-side-widget-right">
                <ScramblePreview puzzleId={selectedEvent.puzzleId} scramble={sharedScramble} />
              </div>
              <div className="timer-face">{currentDisplay('left')}</div>
            </div>
          </div>
          {renderMenu('top', true)}
        </section>

        <section className="center-hub">
          <div className="hud-row is-mirrored">
            <div className="hud-row-main">
              <p className="hud-project">{selectedEvent.name}</p>
              <div className="hud-side">
                <div className="hud-score">
                  <span>{score.left}</span>
                  <span className="hud-divider">:</span>
                  <span>{score.right}</span>
                </div>
                <button
                  type="button"
                  className="hud-menu-button"
                  aria-label="\u6253\u5f00\u4e0a\u65b9\u8bbe\u7f6e"
                  onPointerDown={stopPropagation}
                  onClick={(event) => {
                    stopPropagation(event)
                    toggleSettings('top')
                  }}
                >
                  <span />
                  <span />
                  <span />
                </button>
              </div>
            </div>
          </div>

          <div className="hud-row">
            <div className="hud-row-main">
              <p className="hud-project">{selectedEvent.name}</p>
              <div className="hud-side">
                <div className="hud-score">
                  <span>{score.left}</span>
                  <span className="hud-divider">:</span>
                  <span>{score.right}</span>
                </div>
                <button
                  type="button"
                  className="hud-menu-button"
                  aria-label="\u6253\u5f00\u4e0b\u65b9\u8bbe\u7f6e"
                  onPointerDown={stopPropagation}
                  onClick={(event) => {
                    stopPropagation(event)
                    toggleSettings('bottom')
                  }}
                >
                  <span />
                  <span />
                  <span />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="player-zone player-zone-bottom">
          <div
            className={`player-pad${rightStateClass}`}
            onPointerDown={(event) => handlePointerDown(event, 'right')}
            onPointerUp={(event) => handlePointerUp(event, 'right')}
            onPointerCancel={(event) => handlePointerUp(event, 'right')}
          >
            <div className="player-content">
              <p className="scramble-block" style={scrambleStyle}>
                {sharedScramble}
              </p>
              <div className="player-side-widget player-side-widget-left">
                <HistoryPanel history={history.right} />
              </div>
              <div className="player-side-widget player-side-widget-right">
                <ScramblePreview puzzleId={selectedEvent.puzzleId} scramble={sharedScramble} />
              </div>
              <div className="timer-face">{currentDisplay('right')}</div>
            </div>
          </div>
          {renderMenu('bottom')}
        </section>
      </section>
    </main>
  )
}

export default App
