import { v4 as uuidv4 } from 'uuid'
import type { MapWaypoint, MapPosition, EscapeRoute, ChaseSimulationFrame, RouteIssue } from '../types'

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
): ChaseSimulationFrame[] => {
  if (waypoints.length < 2) return []

  const frames: ChaseSimulationFrame[] = []
  const step = 0.1
  const monsterHeadStart = waypoints.length > 2 ? 1.5 : 0

  let playerDist = 0
  let monsterDist = -monsterHeadStart * monsterSpeed
  let totalDist = 0

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

    frames.push({
      time: Math.round(time * 10) / 10,
      playerPosition: playerInfo.pos,
      monsterPosition: monsterInfo.pos,
      distance: Math.round(dist),
      tension: Math.round(tension),
      waypointIndex: playerInfo.waypointIndex,
    })

    if (monsterDist >= playerDist && time > 1) {
      break
    }

    time += step
    playerDist += playerSpeed * step
    monsterDist += monsterSpeed * step
  }

  return frames
}

export const analyzeRouteIssues = (
  frames: ChaseSimulationFrame[],
  route: EscapeRoute,
  waypoints: MapWaypoint[],
): RouteIssue[] => {
  const issues: RouteIssue[] = []

  if (frames.length === 0) return issues

  const caughtFrame = frames.find(f => f.distance < 15 && f.time > 2)
  if (caughtFrame) {
    const idx = Math.min(caughtFrame.waypointIndex, waypoints.length - 1)
    issues.push({
      id: uuidv4(),
      type: 'caught',
      position: caughtFrame.playerPosition,
      waypointId: waypoints[idx]?.id ?? '',
      routeId: route.id,
      description: `玩家在第 ${caughtFrame.time.toFixed(1)} 秒被怪物追上`,
      severity: 'critical',
    })
  }

  waypoints.forEach((wp, idx) => {
    if (wp.isDeadEnd) {
      issues.push({
        id: uuidv4(),
        type: 'stuck',
        position: wp.position,
        waypointId: wp.id,
        routeId: route.id,
        description: `路线进入死胡同：${wp.label}`,
        severity: 'critical',
      })
    }
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
    if (frames[i].distance < 40 && !issues.some(iss => iss.type === 'caught')) {
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
