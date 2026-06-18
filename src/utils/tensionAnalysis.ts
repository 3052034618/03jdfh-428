import { v4 as uuidv4 } from 'uuid'
import type { SceneNode, TensionCurvePoint, TensionFeedback, TensionLevel } from '../types'
import { TENSION_MAX, TENSION_SAFE_MAX, TENSION_PRESSURE_MAX, TENSION_BURST_MIN } from '../constants/config'

const TENSION_BASE_VALUES: Record<TensionLevel, number> = {
  safe: 20,
  pressure: 55,
  burst: 85,
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const calculateTensionCurve = (sceneNodes: SceneNode[]): TensionCurvePoint[] => {
  if (sceneNodes.length === 0) return []

  const sorted = [...sceneNodes].sort((a, b) => a.startOffset - b.startOffset)
  const totalDuration = Math.max(...sorted.map(n => n.startOffset + n.duration))
  const points: TensionCurvePoint[] = []
  const step = 0.5

  for (let time = 0; time <= totalDuration; time += step) {
    const currentNode = sorted.find(n => time >= n.startOffset && time < n.startOffset + n.duration)
    const prevNode = [...sorted].reverse().find(n => n.startOffset + n.duration <= time)
    const nextNode = sorted.find(n => n.startOffset >= time)

    let tension: number
    let label: string
    let sceneNodeId: string | undefined

    if (currentNode) {
      sceneNodeId = currentNode.id
      const nodeProgress = (time - currentNode.startOffset) / currentNode.duration
      const baseValue = TENSION_BASE_VALUES[currentNode.tensionLevel]
      const monsterInfluence = time >= currentNode.startOffset + currentNode.monsterSpawnDelay
        ? Math.min(1, (time - currentNode.startOffset - currentNode.monsterSpawnDelay) / 3) * 15
        : 0
      const breathInfluence = currentNode.breathIntensity * 10
      const flickerInfluence = currentNode.lightFlickerIntensity * 8
      const burstBoost = currentNode.tensionLevel === 'burst'
        ? Math.sin(nodeProgress * Math.PI) * 15
        : 0

      tension = Math.min(TENSION_MAX, baseValue + monsterInfluence + breathInfluence + flickerInfluence + burstBoost)
      label = currentNode.name
    } else if (prevNode && nextNode) {
      const gapStart = prevNode.startOffset + prevNode.duration
      const gapProgress = (time - gapStart) / (nextNode.startOffset - gapStart)
      const prevTension = TENSION_BASE_VALUES[prevNode.tensionLevel]
      const nextTension = TENSION_BASE_VALUES[nextNode.tensionLevel]
      tension = lerp(prevTension, nextTension, gapProgress)
      label = '过渡'
    } else if (prevNode) {
      tension = TENSION_BASE_VALUES[prevNode.tensionLevel] * 0.8
      label = '尾声'
    } else {
      tension = 10
      label = '前奏'
    }

    points.push({ time: Math.round(time * 10) / 10, value: Math.round(tension), label, sceneNodeId })
  }

  return points
}

export const analyzeTensionCurve = (curve: TensionCurvePoint[]): TensionFeedback[] => {
  const feedback: TensionFeedback[] = []

  if (curve.length < 10) {
    feedback.push({
      id: uuidv4(),
      type: 'flat_zone',
      startTime: 0,
      endTime: 10,
      message: '段落太短或数据不足',
      suggestion: '添加更多场景节点，建议总时长不少于30秒',
      severity: 'warning',
    })
    return feedback
  }

  const burstThreshold = TENSION_BURST_MIN
  const safeThreshold = TENSION_SAFE_MAX

  let burstSegments: { start: number; end: number; peak: number }[] = []
  let currentBurst: { start: number; end: number; peak: number } | null = null

  curve.forEach(point => {
    if (point.value >= burstThreshold) {
      if (!currentBurst) {
        currentBurst = { start: point.time, end: point.time, peak: point.value }
      } else {
        currentBurst.end = point.time
        currentBurst.peak = Math.max(currentBurst.peak, point.value)
      }
    } else {
      if (currentBurst) {
        burstSegments.push(currentBurst)
        currentBurst = null
      }
    }
  })
  if (currentBurst) burstSegments.push(currentBurst)

  for (let i = 1; i < burstSegments.length; i++) {
    const gap = burstSegments[i].start - burstSegments[i - 1].end
    if (gap < 8) {
      feedback.push({
        id: uuidv4(),
        type: 'peak_density',
        startTime: burstSegments[i - 1].start,
        endTime: burstSegments[i].end,
        message: `恐惧峰值过于密集：两个爆发段仅间隔 ${gap.toFixed(1)} 秒`,
        suggestion: '在两个爆发段之间插入8秒以上的压迫段或安全段，给玩家喘息空间',
        severity: 'critical',
      })
    }
  }

  let inPressure = false
  let pressureStart = 0
  let hasRecovery = false
  let recoveryGap = 0

  curve.forEach(point => {
    if (point.value >= TENSION_PRESSURE_MAX - 10 && !inPressure) {
      inPressure = true
      pressureStart = point.time
      hasRecovery = false
      recoveryGap = 0
    }
    if (inPressure && point.value <= safeThreshold) {
      hasRecovery = true
      recoveryGap++
    }
    if (inPressure && point.value > safeThreshold && hasRecovery && recoveryGap < 6) {
      feedback.push({
        id: uuidv4(),
        type: 'recovery_insufficient',
        startTime: pressureStart,
        endTime: point.time,
        message: `喘息恢复不足：在 ${pressureStart.toFixed(1)}s 起的高压段后，安全恢复仅持续约 ${recoveryGap * 0.5} 秒`,
        suggestion: '确保每次高压后至少有6秒以上的低紧张安全段',
        severity: 'warning',
      })
      inPressure = false
    }
    if (inPressure && point.value > safeThreshold) {
      recoveryGap = 0
      hasRecovery = false
    }
  })

  let flatStart = 0
  let flatPrevValue = curve[0]?.value ?? 0
  let inFlat = false

  curve.forEach((point, idx) => {
    if (Math.abs(point.value - flatPrevValue) < 5 && idx > 0) {
      if (!inFlat) {
        inFlat = true
        flatStart = curve[idx - 1].time
      }
    } else {
      if (inFlat && point.time - flatStart > 15) {
        feedback.push({
          id: uuidv4(),
          type: 'flat_zone',
          startTime: flatStart,
          endTime: point.time,
          message: `平坦区域过长：${flatStart.toFixed(1)}s - ${point.time.toFixed(1)}s 紧张值变化小于5`,
          suggestion: '在该区域加入门锁延迟、灯光闪烁等元素来打破单调',
          severity: 'warning',
        })
      }
      inFlat = false
    }
    flatPrevValue = point.value
  })

  if (feedback.length === 0) {
    feedback.push({
      id: uuidv4(),
      type: 'good',
      startTime: 0,
      endTime: curve[curve.length - 1]?.time ?? 0,
      message: '紧张曲线节奏良好',
      suggestion: '峰值分布合理，喘息充分，继续保持！',
      severity: 'success',
    })
  }

  return feedback
}
