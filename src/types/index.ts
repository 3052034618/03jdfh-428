export type TensionLevel = 'safe' | 'pressure' | 'burst'

export type SceneType =
  | 'corridor'
  | 'staircase'
  | 'storage'
  | 'room'
  | 'junction'
  | 'deadend'
  | 'door'

export interface SceneNode {
  id: string
  type: SceneType
  name: string
  duration: number
  startOffset: number
  tensionLevel: TensionLevel
  monsterSpawnDelay: number
  doorLockDelay: number
  lightFlickerIntensity: number
  breathIntensity: number
  notes: string
}

export interface MapPosition {
  x: number
  y: number
}

export interface MapWaypoint {
  id: string
  position: MapPosition
  label: string
  sceneNodeId?: string
  difficulty: 'easy' | 'medium' | 'hard'
  isJunction: boolean
  isDeadEnd: boolean
}

export interface EscapeRoute {
  id: string
  name: string
  color: string
  waypointIds: string[]
  playerSpeed: number
  monsterSpeed: number
}

export interface RouteIssue {
  id: string
  type: 'lost' | 'stuck' | 'caught'
  position: MapPosition
  waypointId: string
  routeId: string
  description: string
  severity: 'warning' | 'critical'
}

export interface ChaseSimulationFrame {
  time: number
  playerPosition: MapPosition
  monsterPosition: MapPosition
  distance: number
  tension: number
  waypointIndex: number
}

export interface TensionCurvePoint {
  time: number
  value: number
  label: string
  sceneNodeId?: string
}

export interface TensionFeedback {
  id: string
  type: 'peak_density' | 'recovery_insufficient' | 'flat_zone' | 'good'
  startTime: number
  endTime: number
  message: string
  suggestion: string
  severity: 'warning' | 'critical' | 'success'
}

export interface TensionCurveVersion {
  id: string
  name: string
  createdAt: number
  curve: TensionCurvePoint[]
  feedback: TensionFeedback[]
  sceneNodes: SceneNode[]
  description: string
}

export interface CaughtPoint {
  id: string
  position: MapPosition
  time: number
  routeId: string
}

export interface ProjectData {
  name: string
  sceneNodes: SceneNode[]
  waypoints: MapWaypoint[]
  routes: EscapeRoute[]
  tensionCurveVersions: TensionCurveVersion[]
}
