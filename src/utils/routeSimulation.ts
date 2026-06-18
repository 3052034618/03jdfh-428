import { v4 as uuidv4 } from 'uuid'
import type { MapWaypoint, MapPosition, EscapeRoute, ChaseSimulationFrame, RouteIssue, CaughtPoint } from '../types'

export interface SimulationResult {
  frames: ChaseSimulationFrame[]
  caughtPoint: CaughtPoint | null
  stuckPoints: { id: string; position: MapPosition; waypointId: string; time: number }[]
  totalTime: number
  success: boolean
  finalDistance: number
}

const distance = (a: MapPosition, b: MapPosition) =>
  Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2))

const lerpPos = (a: MapPosition, b: MapPosition, t: number): MapPosition => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})

export const simulateChase = (
  waypoints: MapWaypoint[],
  playerSpeed: number,
  monsterSpeed: number,
): SimulationResult => {
  if (waypoints.length < 2) {
    return { frames: [], caughtPoint: null, stuckPoints: [], totalTime: 0, success: false, finalDistance: 0 }
  }

  const frames: ChaseSimulationFrame[] = []
  const step = 0.1
  const monsterHeadStart = waypoints.length > 2 ? 1.5 : 0
  const stuckPoints: { id: string; position: MapPosition; waypointId: string; time: number }[] = []

  let playerDist = 0
  let monsterDist = -monsterHeadStart * monsterSpeed
  let totalDist = 0
  let caughtPoint: CaughtPoint | null = null
  let success = true

  const segments: { from: MapWaypoint; to: MapWaypoint; length: number; startDist: number }[] = []
  for (let i = 0; i < waypoints.length - 1; i++) {
    const len = distance(waypoints[i].position, waypoints[i + 1].position)
    segments.push({
      from: waypoints[i],
      to: waypoints[i + 1],
      length: len,
      startDist: totalDist,
    })
    totalDist += len
  }

  const getPosFromDist = (d: number): { pos: MapPosition; waypointIndex: number } => {
    if (d <= 0) return { pos: waypoints[0].position, waypointIndex: 0 }
    if (d >= totalDist) return { pos: waypoints[waypoints.length - 1].position, waypointIndex: waypoints.length - 1 }

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      if (d >= seg.startDist && d <= seg.startDist + seg.length) {
        const t = (d - seg.startDist) / seg.length
        return { pos: lerpPos(seg.from.position, seg.to.position, t), waypointIndex: i }
      }
    }
    return { pos: waypoints[waypoints.length - 1].position, waypointIndex: waypoints.length - 1 }
  }

  let time = 0
  const maxTime = (totalDist / playerSpeed) * 1.5 + 5

  while (time <= maxTime) {
    const playerInfo = getPosFromDist(playerDist)
    const monsterInfo = getPosFromDist(Math.max(0, monsterDist))
    const dist = Math.max(0, playerDist - monsterDist)

    const maxDist = 300
    const minDist = 20
    const tension = dist < minDist
      ? 100
      : dist > maxDist
        ? 20
        : 100 - ((dist - minDist) / (maxDist - minDist)) * 80

    const currentWaypoint = waypoints[playerInfo.waypointIndex]
    if (currentWaypoint?.isDeadEnd && !stuckPoints.some(s => s.waypointId === currentWaypoint.id)) {
      stuckPoints.push({
        id: uuidv4(),
        position: playerInfo.pos,
        waypointId: currentWaypoint.id,
        time: Math.round(time * 10) / 10,
      })
    }

    frames.push({
      time: Math.round(time * 10) / 10,
      playerPosition: playerInfo.pos,
      monsterPosition: monsterInfo.pos,
      distance: Math.round(dist),
      tension: Math.round(tension),
      waypointIndex: playerInfo.waypointIndex,
    })

    if (monsterDist >= playerDist && time > 1 && !caughtPoint) {
      caughtPoint = {
        id: uuidv4(),
        position: { ...playerInfo.pos },
        time: Math.round(time * 10) / 10,
        routeId: '',
      }
      success = false
      break
    }

    if (playerDist >= totalDist) {
      break
    }

    time += step
    playerDist += playerSpeed * step
    monsterDist += monsterSpeed * step
  }

  return {
    frames,
    caughtPoint,
    stuckPoints,
    totalTime: Math.round(time * 10) / 10,
    success,
    finalDistance: Math.max(0, playerDist - monsterDist),
  }
}

export const analyzeRouteIssues = (
  result: SimulationResult,
  route: EscapeRoute,
  waypoints: MapWaypoint[],
): RouteIssue[] => {
  const issues: RouteIssue[] = []
  const { frames, caughtPoint, stuckPoints } = result

  if (frames.length === 0) return issues

  if (caughtPoint) {
    const idx = Math.min(
      frames.findIndex(f => f.time >= caughtPoint.time),
      waypoints.length - 1
    )
    issues.push({
      id: uuidv4(),
      type: 'caught',
      position: caughtPoint.position,
      waypointId: waypoints[Math.max(0, idx)]?.id ?? '',
      routeId: route.id,
      description: `玩家在第 ${caughtPoint.time.toFixed(1)} 秒被怪物追上`,
      severity: 'critical',
    })
  }

  stuckPoints.forEach(sp => {
    const wp = waypoints.find(w => w.id === sp.waypointId)
    issues.push({
      id: uuidv4(),
      type: 'stuck',
      position: sp.position,
      waypointId: sp.waypointId,
      routeId: route.id,
      description: `卡死在死胡同：${wp?.label ?? '未知位置'} (${sp.time.toFixed(1)}s)`,
      severity: 'critical',
    })
  })

  waypoints.forEach((wp, idx) => {
    if (wp.isJunction && idx < waypoints.length - 1) {
      const nextWp = waypoints[idx + 1]
      issues.push({
        id: uuidv4(),
        type: 'lost',
        position: wp.position,
        waypointId: wp.id,
        routeId: route.id,
        description: `岔路口选择困难：${wp.label} → ${nextWp.label}`,
        severity: 'warning',
      })
    }
  })

  for (let i = 10; i < frames.length; i += 10) {
    if (frames[i].distance < 40 && !caughtPoint) {
      issues.push({
        id: uuidv4(),
        type: 'caught',
        position: frames[i].playerPosition,
        waypointId: waypoints[Math.min(frames[i].waypointIndex, waypoints.length - 1)]?.id ?? '',
        routeId: route.id,
        description: `在 ${frames[i].time.toFixed(1)} 秒时，怪物距离玩家仅 ${frames[i].distance} 像素，距离过近`,
        severity: 'warning',
      })
      break
    }
  }

  return issues
}

