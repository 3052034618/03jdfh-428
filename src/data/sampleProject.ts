import { v4 as uuidv4 } from 'uuid'
import type { ProjectData, SceneNode, MapWaypoint, EscapeRoute } from '../types'

export const createSampleProject = (): ProjectData => {
  const sceneNodes: SceneNode[] = [
    {
      id: uuidv4(),
      type: 'room',
      name: '起始卧室',
      duration: 10,
      startOffset: 0,
      tensionLevel: 'safe',
      monsterSpawnDelay: 8,
      doorLockDelay: 0,
      lightFlickerIntensity: 0.1,
      breathIntensity: 0.2,
      notes: '玩家从这里醒来，听到远处脚步声',
    },
    {
      id: uuidv4(),
      type: 'corridor',
      name: '昏暗走廊',
      duration: 20,
      startOffset: 10,
      tensionLevel: 'pressure',
      monsterSpawnDelay: 3,
      doorLockDelay: 0,
      lightFlickerIntensity: 0.6,
      breathIntensity: 0.6,
      notes: '走廊尽头有闪烁的灯光',
    },
    {
      id: uuidv4(),
      type: 'junction',
      name: '三岔路口',
      duration: 10,
      startOffset: 30,
      tensionLevel: 'pressure',
      monsterSpawnDelay: 2,
      doorLockDelay: 0,
      lightFlickerIntensity: 0.4,
      breathIntensity: 0.7,
      notes: '三条路，只有一条通向出口',
    },
    {
      id: uuidv4(),
      type: 'staircase',
      name: '逃生楼梯',
      duration: 25,
      startOffset: 40,
      tensionLevel: 'burst',
      monsterSpawnDelay: 1,
      doorLockDelay: 0,
      lightFlickerIntensity: 0.9,
      breathIntensity: 0.95,
      notes: '怪物紧跟在身后',
    },
    {
      id: uuidv4(),
      type: 'door',
      name: '出口铁门',
      duration: 8,
      startOffset: 65,
      tensionLevel: 'burst',
      monsterSpawnDelay: 0,
      doorLockDelay: 5,
      lightFlickerIntensity: 0.3,
      breathIntensity: 1,
      notes: '需要5秒开锁，怪物即将到达',
    },
  ]

  const waypoints: MapWaypoint[] = [
    { id: 'wp1', position: { x: 100, y: 200 }, label: '卧室', sceneNodeId: sceneNodes[0].id, difficulty: 'easy', isJunction: false, isDeadEnd: false },
    { id: 'wp2', position: { x: 250, y: 200 }, label: '走廊入口', sceneNodeId: sceneNodes[1].id, difficulty: 'easy', isJunction: false, isDeadEnd: false },
    { id: 'wp3', position: { x: 400, y: 200 }, label: '走廊中段', difficulty: 'medium', isJunction: false, isDeadEnd: false },
    { id: 'wp4', position: { x: 500, y: 200 }, label: '三岔路口', sceneNodeId: sceneNodes[2].id, difficulty: 'medium', isJunction: true, isDeadEnd: false },
    { id: 'wp5', position: { x: 600, y: 100 }, label: '储物间(死路)', difficulty: 'hard', isJunction: false, isDeadEnd: true },
    { id: 'wp6', position: { x: 600, y: 300 }, label: '错误走廊', difficulty: 'hard', isJunction: false, isDeadEnd: true },
    { id: 'wp7', position: { x: 650, y: 200 }, label: '楼梯口', difficulty: 'medium', isJunction: false, isDeadEnd: false },
    { id: 'wp8', position: { x: 750, y: 200 }, label: '楼梯中段', sceneNodeId: sceneNodes[3].id, difficulty: 'hard', isJunction: false, isDeadEnd: false },
    { id: 'wp9', position: { x: 850, y: 200 }, label: '出口铁门', sceneNodeId: sceneNodes[4].id, difficulty: 'hard', isJunction: false, isDeadEnd: false },
  ]

  const routes: EscapeRoute[] = [
    {
      id: 'route1',
      name: '正确路线',
      color: '#22c55e',
      waypointIds: ['wp1', 'wp2', 'wp3', 'wp4', 'wp7', 'wp8', 'wp9'],
      playerSpeed: 50,
      monsterSpeed: 45,
    },
    {
      id: 'route2',
      name: '误入储物间',
      color: '#f59e0b',
      waypointIds: ['wp1', 'wp2', 'wp3', 'wp4', 'wp5'],
      playerSpeed: 50,
      monsterSpeed: 45,
    },
    {
      id: 'route3',
      name: '走错走廊',
      color: '#ef4444',
      waypointIds: ['wp1', 'wp2', 'wp3', 'wp4', 'wp6'],
      playerSpeed: 50,
      monsterSpeed: 45,
    },
  ]

  return {
    name: '示例追逐段落 - 公寓逃生',
    sceneNodes,
    waypoints,
    routes,
    tensionCurveVersions: [],
  }
}
