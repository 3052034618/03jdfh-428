import type { SceneType, TensionLevel } from '../types'

export const SCENE_TYPE_CONFIG: Record<SceneType, {
  label: string
  icon: string
  defaultDuration: number
  defaultTension: TensionLevel
  description: string
}> = {
  corridor: {
    label: '走廊',
    icon: '⬛',
    defaultDuration: 15,
    defaultTension: 'pressure',
    description: '长直通道，适合持续压迫感',
  },
  staircase: {
    label: '楼梯间',
    icon: '🔺',
    defaultDuration: 20,
    defaultTension: 'burst',
    description: '垂直空间，节奏感强',
  },
  storage: {
    label: '储藏室',
    icon: '📦',
    defaultDuration: 10,
    defaultTension: 'safe',
    description: '可躲避的封闭空间',
  },
  room: {
    label: '房间',
    icon: '🏠',
    defaultDuration: 12,
    defaultTension: 'safe',
    description: '普通房间，可设置埋伏',
  },
  junction: {
    label: '岔路口',
    icon: '🔀',
    defaultDuration: 8,
    defaultTension: 'pressure',
    description: '多方向选择点',
  },
  deadend: {
    label: '死胡同',
    icon: '🚫',
    defaultDuration: 6,
    defaultTension: 'burst',
    description: '绝境，反转点',
  },
  door: {
    label: '门',
    icon: '🚪',
    defaultDuration: 5,
    defaultTension: 'pressure',
    description: '门锁延迟机制',
  },
}

export const TENSION_COLORS: Record<TensionLevel, {
  bg: string
  bgLight: string
  border: string
  text: string
  gradient: string
}> = {
  safe: {
    bg: 'bg-green-900/60',
    bgLight: 'bg-green-800/40',
    border: 'border-green-500',
    text: 'text-green-300',
    gradient: 'from-green-900/80 to-green-700/60',
  },
  pressure: {
    bg: 'bg-amber-900/60',
    bgLight: 'bg-amber-800/40',
    border: 'border-amber-500',
    text: 'text-amber-300',
    gradient: 'from-amber-900/80 to-amber-700/60',
  },
  burst: {
    bg: 'bg-red-900/60',
    bgLight: 'bg-red-800/40',
    border: 'border-red-500',
    text: 'text-red-300',
    gradient: 'from-red-900/80 to-red-700/60',
  },
}

export const TENSION_LABELS: Record<TensionLevel, string> = {
  safe: '安全段',
  pressure: '压迫段',
  burst: '爆发段',
}

export const PX_PER_SECOND = 30

export const TIMELINE_HEIGHT = 80

export const TENSION_MAX = 100
export const TENSION_SAFE_MAX = 35
export const TENSION_PRESSURE_MIN = 36
export const TENSION_PRESSURE_MAX = 70
export const TENSION_BURST_MIN = 71
