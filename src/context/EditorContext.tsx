import React, { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type {
  ProjectData,
  SceneNode,
  MapWaypoint,
  EscapeRoute,
  TensionCurvePoint,
  TensionFeedback,
  RouteIssue,
  ChaseSimulationFrame,
  TensionCurveVersion,
  CaughtPoint,
  RouteSimulationRecord,
  TensionVersionDiff,
} from '../types'
import { createSampleProject } from '../data/sampleProject'
import { calculateTensionCurve, analyzeTensionCurve } from '../utils/tensionAnalysis'
import { simulateChase, analyzeRouteIssues, type SimulationResult } from '../utils/routeSimulation'
import { TENSION_BURST_MIN } from '../constants/config'

interface SimulationResults {
  [routeId: string]: SimulationResult
}

interface EditorContextType {
  project: ProjectData
  selectedSceneNodeId: string | null
  selectedRouteId: string | null
  isSimulating: boolean
  simulationTime: number
  tensionCurve: TensionCurvePoint[]
  tensionFeedback: TensionFeedback[]
  routeIssues: RouteIssue[]
  simulationFrames: Record<string, ChaseSimulationFrame[]>
  simulationResults: SimulationResults
  caughtPoints: Record<string, CaughtPoint | null>
  selectedCurveVersionIds: string[]
  showAllVersions: boolean
  isDirty: boolean
  filePath: string | undefined
  actions: {
    setProject: (project: ProjectData) => void
    selectSceneNode: (id: string | null) => void
    selectRoute: (id: string | null) => void
    addSceneNode: (node: Omit<SceneNode, 'id'>) => void
    updateSceneNode: (id: string, updates: Partial<SceneNode>) => void
    removeSceneNode: (id: string) => void
    moveSceneNode: (id: string, newStartOffset: number) => void
    addWaypoint: (waypoint: Omit<MapWaypoint, 'id'>) => void
    updateWaypoint: (id: string, updates: Partial<MapWaypoint>) => void
    removeWaypoint: (id: string) => void
    addRoute: (route: Omit<EscapeRoute, 'id'>) => void
    updateRoute: (id: string, updates: Partial<EscapeRoute>) => void
    removeRoute: (id: string) => void
    reorderRouteWaypoint: (routeId: string, fromIndex: number, toIndex: number) => void
    toggleWaypointJunction: (waypointId: string) => void
    toggleWaypointDeadEnd: (waypointId: string) => void
    startSimulation: () => void
    stopSimulation: () => void
    setSimulationTime: (time: number) => void
    runFullAnalysis: () => void
    simulateRoute: (routeId: string) => void
    saveTensionCurveVersion: (name: string, description: string) => void
    deleteTensionCurveVersion: (versionId: string) => void
    toggleCurveVersion: (versionId: string) => void
    setShowAllVersions: (show: boolean) => void
    saveProject: () => Promise<{ success: boolean; path?: string }>
    loadProject: (data: ProjectData, path?: string) => void
    newProject: () => void
    saveSimulationRecord: (routeId: string, notes: string) => void
    deleteSimulationRecord: (recordId: string) => void
    updateSimulationRecordNotes: (recordId: string, notes: string) => void
    calculateVersionDiff: (baseId: string, targetId: string) => TensionVersionDiff | null
    checkUnsavedChanges: () => boolean
    setSimulationTimeDirect: (time: number) => void
  }
}

const EditorContext = createContext<EditorContextType | null>(null)

export const EditorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [project, setProjectState] = useState<ProjectData>(createSampleProject())
  const [selectedSceneNodeId, setSelectedSceneNodeId] = useState<string | null>(null)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(project.routes[0]?.id || null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationTime, setSimulationTime] = useState(0)
  const [tensionCurve, setTensionCurve] = useState<TensionCurvePoint[]>([])
  const [tensionFeedback, setTensionFeedback] = useState<TensionFeedback[]>([])
  const [routeIssues, setRouteIssues] = useState<RouteIssue[]>([])
  const [simulationFrames, setSimulationFrames] = useState<Record<string, ChaseSimulationFrame[]>>({})
  const [simulationResults, setSimulationResults] = useState<SimulationResults>({})
  const [caughtPoints, setCaughtPoints] = useState<Record<string, CaughtPoint | null>>({})
  const [selectedCurveVersionIds, setSelectedCurveVersionIds] = useState<string[]>([])
  const [showAllVersions, setShowAllVersions] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [filePath, setFilePath] = useState<string | undefined>(undefined)

  const setProject = useCallback((updater: ProjectData | ((prev: ProjectData) => ProjectData), markAsDirty = true) => {
    if (typeof updater === 'function') {
      setProjectState(prev => {
        const newState = (updater as (prev: ProjectData) => ProjectData)(prev)
        return newState
      })
    } else {
      setProjectState(updater)
    }
    if (markAsDirty) setIsDirty(true)
  }, [])

  const markAsSaved = useCallback((savedPath?: string) => {
    setIsDirty(false)
    if (savedPath) {
      setFilePath(savedPath)
      setProjectState(prev => ({ ...prev, filePath: savedPath }))
    }
  }, [])

  const saveSimulationRecord = useCallback((routeId: string, notes: string) => {
    const route = project.routes.find(r => r.id === routeId)
    const result = simulationResults[routeId]
    const frames = simulationFrames[routeId]
    if (!route || !result || frames.length === 0) return

    const distValues = frames.map(f => f.distance)
    const minDist = Math.min(...distValues)
    const avgDist = distValues.reduce((a, b) => a + b, 0) / distValues.length
    const issues = routeIssues.filter(i => i.routeId === routeId)
    const criticalCount = issues.filter(i => i.severity === 'critical').length
    const warningCount = issues.length - criticalCount

    let dangerScore = 0
    if (!result.success) dangerScore += 100
    dangerScore += criticalCount * 30
    if (minDist < 30) dangerScore += 25
    else if (minDist < 60) dangerScore += 10
    dangerScore += result.stuckPoints.length * 20

    const keyMoments: { time: number; label: string; value: number }[] = []
    if (result.caughtPoint) {
      keyMoments.push({ time: result.caughtPoint.time, label: '被捕获', value: 100 })
    }
    result.stuckPoints.forEach(sp => {
      keyMoments.push({ time: sp.time, label: '卡死', value: 80 })
    })
    frames.forEach((f, idx) => {
      if (idx > 0 && f.distance < distValues[idx - 1] && f.distance < 40) {
        const prevHigh = frames.slice(Math.max(0, idx - 10), idx).every(ff => ff.distance > f.distance + 10)
        if (prevHigh) {
          keyMoments.push({ time: f.time, label: '危险接近', value: Math.round(100 - f.distance) })
        }
      }
    })

    const waypointSnapshot = route.waypointIds
      .map(wid => project.waypoints.find(w => w.id === wid))
      .filter(Boolean) as MapWaypoint[]

    const record: RouteSimulationRecord = {
      id: uuidv4(),
      routeId: route.id,
      routeName: route.name,
      routeColor: route.color,
      createdAt: Date.now(),
      playerSpeed: route.playerSpeed,
      monsterSpeed: route.monsterSpeed,
      totalTime: result.totalTime,
      success: result.success,
      finalDistance: result.finalDistance,
      minDistance: minDist,
      avgDistance: Math.round(avgDist),
      caughtPoint: result.caughtPoint ? { ...result.caughtPoint, routeId } : null,
      stuckPoints: result.stuckPoints.map(sp => ({
        position: sp.position,
        waypointId: sp.waypointId,
        time: sp.time,
      })),
      criticalIssues: criticalCount,
      warningIssues: warningCount,
      dangerScore: Math.min(100, dangerScore),
      notes,
      keyMoments,
      waypointSnapshot,
    }

    setProject(prev => ({
      ...prev,
      simulationRecords: [...prev.simulationRecords, record],
    }))
  }, [project, simulationResults, simulationFrames, routeIssues, setProject])

  const deleteSimulationRecord = useCallback((recordId: string) => {
    setProject(prev => ({
      ...prev,
      simulationRecords: prev.simulationRecords.filter(r => r.id !== recordId),
    }))
  }, [setProject])

  const updateSimulationRecordNotes = useCallback((recordId: string, notes: string) => {
    setProject(prev => ({
      ...prev,
      simulationRecords: prev.simulationRecords.map(r =>
        r.id === recordId ? { ...r, notes } : r
      ),
    }))
  }, [setProject])

  const calculateVersionDiff = useCallback((baseId: string, targetId: string): TensionVersionDiff | null => {
    const base = project.tensionCurveVersions.find(v => v.id === baseId)
    const target = project.tensionCurveVersions.find(v => v.id === targetId)
    if (!base || !target) return null

    const basePeak = Math.max(...base.curve.map(p => p.value))
    const targetPeak = Math.max(...target.curve.map(p => p.value))
    const basePeakTime = base.curve.find(p => p.value === basePeak)?.time ?? 0
    const targetPeakTime = target.curve.find(p => p.value === targetPeak)?.time ?? 0
    const baseAvg = base.curve.reduce((a, b) => a + b.value, 0) / base.curve.length
    const targetAvg = target.curve.reduce((a, b) => a + b.value, 0) / target.curve.length

    const basePeakCount = base.curve.filter(p => p.value >= TENSION_BURST_MIN).length
    const targetPeakCount = target.curve.filter(p => p.value >= TENSION_BURST_MIN).length

    const findRecoveryTime = (curve: TensionCurvePoint[]) => {
      for (let i = curve.length - 1; i >= 0; i--) {
        if (curve[i].value >= TENSION_BURST_MIN) {
          for (let j = i; j < curve.length; j++) {
            if (curve[j].value <= 35) {
              return curve[j].time - curve[i].time
            }
          }
        }
      }
      return 0
    }
    const baseRecovery = findRecoveryTime(base.curve)
    const targetRecovery = findRecoveryTime(target.curve)

    const findDoorLockImpact = (curve: TensionCurvePoint[], sceneNodes: SceneNode[]) => {
      let maxImpact = 0
      sceneNodes.forEach(node => {
        if (node.doorLockDelay > 0) {
          const doorStart = node.startOffset + node.duration * 0.4
          const doorEnd = doorStart + node.doorLockDelay
          const pointsNearDoor = curve.filter(p => p.time >= doorStart - 1 && p.time <= doorEnd + 1)
          if (pointsNearDoor.length >= 2) {
            const peak = Math.max(...pointsNearDoor.map(p => p.value))
            const before = curve.filter(p => p.time < doorStart - 2).slice(-3)
            const beforeAvg = before.length > 0 ? before.reduce((a, b) => a + b.value, 0) / before.length : 0
            maxImpact = Math.max(maxImpact, peak - beforeAvg)
          }
        }
      })
      return maxImpact
    }
    const baseDoorImpact = findDoorLockImpact(base.curve, base.sceneNodes)
    const targetDoorImpact = findDoorLockImpact(target.curve, target.sceneNodes)

    const significantChanges: TensionVersionDiff['significantChanges'] = []
    const maxTime = Math.max(base.curve[base.curve.length - 1].time, target.curve[target.curve.length - 1].time)
    for (let t = 0; t <= maxTime; t += 0.5) {
      const baseP = base.curve.find(p => Math.abs(p.time - t) < 0.3)
      const targetP = target.curve.find(p => Math.abs(p.time - t) < 0.3)
      if (baseP && targetP) {
        const diff = targetP.value - baseP.value
        if (Math.abs(diff) >= 10) {
          let type: 'peak' | 'valley' | 'door' | 'recovery' = 'peak'
          if (diff < 0) type = 'valley'
          if (targetP.label.includes('门') || targetP.label.includes('door')) type = 'door'
          if (targetP.value <= 40 && baseP.value > 40) type = 'recovery'
          significantChanges.push({
            time: t,
            valueDiff: Math.round(diff),
            baseValue: baseP.value,
            targetValue: targetP.value,
            label: targetP.label,
            type,
          })
        }
      }
    }

    return {
      baseId,
      targetId,
      baseName: base.name,
      targetName: target.name,
      peakValueChange: Math.round(targetPeak - basePeak),
      peakTimeChange: Math.round((targetPeakTime - basePeakTime) * 10) / 10,
      avgValueChange: Math.round((targetAvg - baseAvg) * 10) / 10,
      recoveryTimeChange: Math.round((targetRecovery - baseRecovery) * 10) / 10,
      doorLockImpactChange: Math.round(targetDoorImpact - baseDoorImpact),
      peakCountChange: targetPeakCount - basePeakCount,
      significantChanges,
      timeDiff: Math.round((target.createdAt - base.createdAt) / 1000),
    }
  }, [project.tensionCurveVersions])

  const refreshAllRouteSimulations = useCallback((proj: ProjectData) => {
    const frames: Record<string, ChaseSimulationFrame[]> = {}
    const results: SimulationResults = {}
    const caught: Record<string, CaughtPoint | null> = {}
    const allIssues: RouteIssue[] = []

    proj.routes.forEach(route => {
      const waypoints = route.waypointIds
        .map(wid => proj.waypoints.find(w => w.id === wid))
        .filter(Boolean) as MapWaypoint[]
      const result = simulateChase(waypoints, route.playerSpeed, route.monsterSpeed)
      results[route.id] = result
      frames[route.id] = result.frames
      caught[route.id] = result.caughtPoint ? { ...result.caughtPoint, routeId: route.id } : null
      allIssues.push(...analyzeRouteIssues(result, route, waypoints))
    })

    setSimulationFrames(frames)
    setSimulationResults(results)
    setCaughtPoints(caught)
    setRouteIssues(allIssues)
  }, [])

  const refreshTensionAnalysis = useCallback((proj: ProjectData) => {
    const curve = calculateTensionCurve(proj.sceneNodes)
    setTensionCurve(curve)
    setTensionFeedback(analyzeTensionCurve(curve))
  }, [])

  const runFullAnalysis = useCallback(() => {
    const curve = calculateTensionCurve(project.sceneNodes)
    setTensionCurve(curve)
    setTensionFeedback(analyzeTensionCurve(curve))

    const frames: Record<string, ChaseSimulationFrame[]> = {}
    const results: SimulationResults = {}
    const caught: Record<string, CaughtPoint | null> = {}
    const allIssues: RouteIssue[] = []

    project.routes.forEach(route => {
      const waypoints = route.waypointIds
        .map(wid => project.waypoints.find(w => w.id === wid))
        .filter(Boolean) as MapWaypoint[]
      const result = simulateChase(waypoints, route.playerSpeed, route.monsterSpeed)
      results[route.id] = result
      frames[route.id] = result.frames
      caught[route.id] = result.caughtPoint ? { ...result.caughtPoint, routeId: route.id } : null
      allIssues.push(...analyzeRouteIssues(result, route, waypoints))
    })

    setSimulationFrames(frames)
    setSimulationResults(results)
    setCaughtPoints(caught)
    setRouteIssues(allIssues)
  }, [project])

  const simulateRoute = useCallback((routeId: string) => {
    const route = project.routes.find(r => r.id === routeId)
    if (!route) return

    const waypoints = route.waypointIds
      .map(wid => project.waypoints.find(w => w.id === wid))
      .filter(Boolean) as MapWaypoint[]
    const result = simulateChase(waypoints, route.playerSpeed, route.monsterSpeed)
    const issues = analyzeRouteIssues(result, route, waypoints)

    setSimulationResults(prev => ({ ...prev, [routeId]: result }))
    setSimulationFrames(prev => ({ ...prev, [routeId]: result.frames }))
    setCaughtPoints(prev => ({
      ...prev,
      [routeId]: result.caughtPoint ? { ...result.caughtPoint, routeId } : null,
    }))
    setRouteIssues(prev => [
      ...prev.filter(i => i.routeId !== routeId),
      ...issues,
    ])
  }, [project])

  const updateSceneNode = useCallback((id: string, updates: Partial<SceneNode>) => {
    setProject(prev => ({
      ...prev,
      sceneNodes: prev.sceneNodes.map(n => n.id === id ? { ...n, ...updates } : n),
    }))
  }, [])

  const addSceneNode = useCallback((node: Omit<SceneNode, 'id'>) => {
    const newNode: SceneNode = { ...node, id: uuidv4() }
    setProject(prev => ({
      ...prev,
      sceneNodes: [...prev.sceneNodes, newNode],
    }))
  }, [])

  const removeSceneNode = useCallback((id: string) => {
    setProject(prev => ({
      ...prev,
      sceneNodes: prev.sceneNodes.filter(n => n.id !== id),
    }))
    if (selectedSceneNodeId === id) {
      setSelectedSceneNodeId(null)
    }
  }, [selectedSceneNodeId])

  const moveSceneNode = useCallback((id: string, newStartOffset: number) => {
    setProject(prev => ({
      ...prev,
      sceneNodes: prev.sceneNodes.map(n => n.id === id ? { ...n, startOffset: Math.max(0, newStartOffset) } : n),
    }))
  }, [])

  const addWaypoint = useCallback((waypoint: Omit<MapWaypoint, 'id'>) => {
    const newWaypoint: MapWaypoint = { ...waypoint, id: uuidv4() }
    setProject(prev => ({
      ...prev,
      waypoints: [...prev.waypoints, newWaypoint],
    }))
  }, [])

  const updateWaypoint = useCallback((id: string, updates: Partial<MapWaypoint>) => {
    setProject(prev => ({
      ...prev,
      waypoints: prev.waypoints.map(w => w.id === id ? { ...w, ...updates } : w),
    }))
  }, [])

  const removeWaypoint = useCallback((id: string) => {
    setProject(prev => ({
      ...prev,
      waypoints: prev.waypoints.filter(w => w.id !== id),
      routes: prev.routes.map(r => ({
        ...r,
        waypointIds: r.waypointIds.filter(wid => wid !== id),
      })),
    }))
  }, [])

  const toggleWaypointJunction = useCallback((waypointId: string) => {
    setProject(prev => ({
      ...prev,
      waypoints: prev.waypoints.map(w =>
        w.id === waypointId ? { ...w, isJunction: !w.isJunction } : w
      ),
    }))
  }, [])

  const toggleWaypointDeadEnd = useCallback((waypointId: string) => {
    setProject(prev => ({
      ...prev,
      waypoints: prev.waypoints.map(w =>
        w.id === waypointId ? { ...w, isDeadEnd: !w.isDeadEnd } : w
      ),
    }))
  }, [])

  const addRoute = useCallback((route: Omit<EscapeRoute, 'id'>) => {
    const newRoute: EscapeRoute = { ...route, id: uuidv4() }
    setProject(prev => ({
      ...prev,
      routes: [...prev.routes, newRoute],
    }))
  }, [])

  const updateRoute = useCallback((id: string, updates: Partial<EscapeRoute>) => {
    setProject(prev => ({
      ...prev,
      routes: prev.routes.map(r => (r.id === id ? { ...r, ...updates } : r)),
    }))
  }, [])

  const removeRoute = useCallback((id: string) => {
    setProject(prev => ({
      ...prev,
      routes: prev.routes.filter(r => r.id !== id),
    }))
    if (selectedRouteId === id) {
      setSelectedRouteId(null)
    }
  }, [selectedRouteId])

  const reorderRouteWaypoint = useCallback((routeId: string, fromIndex: number, toIndex: number) => {
    setProject(prev => ({
      ...prev,
      routes: prev.routes.map(r => {
        if (r.id !== routeId) return r
        const newIds = [...r.waypointIds]
        const [removed] = newIds.splice(fromIndex, 1)
        newIds.splice(toIndex, 0, removed)
        return { ...r, waypointIds: newIds }
      }),
    }))
  }, [])

  const startSimulation = useCallback(() => {
    if (selectedRouteId) {
      simulateRoute(selectedRouteId)
    }
    setSimulationTime(0)
    setTimeout(() => setIsSimulating(true), 50)
  }, [selectedRouteId, simulateRoute])

  useEffect(() => {
    refreshAllRouteSimulations(project)
  }, [project.routes, project.waypoints, refreshAllRouteSimulations])

  useEffect(() => {
    refreshTensionAnalysis(project)
  }, [project.sceneNodes, refreshTensionAnalysis])

  const stopSimulation = useCallback(() => {
    setIsSimulating(false)
  }, [])

  const saveTensionCurveVersion = useCallback((name: string, description: string) => {
    const curve = calculateTensionCurve(project.sceneNodes)
    const feedback = analyzeTensionCurve(curve)
    const version: TensionCurveVersion = {
      id: uuidv4(),
      name,
      description,
      createdAt: Date.now(),
      curve,
      feedback,
      sceneNodes: JSON.parse(JSON.stringify(project.sceneNodes)),
    }
    setProject(prev => ({
      ...prev,
      tensionCurveVersions: [...prev.tensionCurveVersions, version],
    }))
    setTensionCurve(curve)
    setTensionFeedback(feedback)
  }, [project.sceneNodes])

  const deleteTensionCurveVersion = useCallback((versionId: string) => {
    setProject(prev => ({
      ...prev,
      tensionCurveVersions: prev.tensionCurveVersions.filter(v => v.id !== versionId),
    }))
    setSelectedCurveVersionIds(prev => prev.filter(id => id !== versionId))
  }, [])

  const toggleCurveVersion = useCallback((versionId: string) => {
    setSelectedCurveVersionIds(prev =>
      prev.includes(versionId)
        ? prev.filter(id => id !== versionId)
        : [...prev, versionId]
    )
  }, [])

  const saveProject = useCallback(async () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const result = await (window as any).electronAPI.saveProject(project)
      if (result.success && result.path) {
        markAsSaved(result.path)
      }
      return result
    }
    return { success: false }
  }, [project, markAsSaved])

  const loadProject = useCallback((data: ProjectData, path?: string) => {
    setProjectState(data)
    if (path) {
      setFilePath(path)
    }
    setIsDirty(false)
    setSelectedRouteId(data.routes[0]?.id || null)
    setSelectedSceneNodeId(null)
    setSimulationFrames({})
    setSimulationResults({})
    setCaughtPoints({})
    setRouteIssues([])
    setTensionCurve([])
    setTensionFeedback([])
    setSelectedCurveVersionIds([])
  }, [])

  const newProject = useCallback(() => {
    const newProj: ProjectData = {
      name: '未命名项目',
      sceneNodes: [],
      waypoints: [],
      routes: [],
      tensionCurveVersions: [],
      simulationRecords: [],
    }
    loadProject(newProj)
    setFilePath(undefined)
  }, [loadProject])

  const checkUnsavedChanges = useCallback((): boolean => {
    return isDirty
  }, [isDirty])

  const setSimulationTimeDirect = useCallback((time: number) => {
    setIsSimulating(false)
    setSimulationTime(time)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) return
    const api = (window as any).electronAPI

    const unsubNew = api.onNewProject(() => newProject())
    const unsubLoad = api.onLoadProject((data: ProjectData, path?: string) => {
      if (isDirty) {
        if (!confirm('当前项目有未保存的更改，确定要打开另一个项目吗？')) {
          return
        }
      }
      loadProject(data, path)
    })
    const unsubSave = api.onRequestSave(() => saveProject())
    const unsubAnalysis = api.onRunAnalysis(() => runFullAnalysis())
    const unsubPlay = api.onPlayChase(() => startSimulation())
    const unsubSaveVer = api.onSaveCurveVersion(() => {
      const name = prompt('版本名称：', `版本 ${project.tensionCurveVersions.length + 1}`)
      if (name) {
        const desc = prompt('版本描述（可选）：', '') || ''
        saveTensionCurveVersion(name, desc)
      }
    })

    return () => {
      unsubNew()
      unsubLoad()
      unsubSave()
      unsubAnalysis()
      unsubPlay()
      unsubSaveVer()
    }
  }, [newProject, loadProject, saveProject, runFullAnalysis, startSimulation, saveTensionCurveVersion, project.tensionCurveVersions.length])

  return (
    <EditorContext.Provider
      value={{
        project,
        selectedSceneNodeId,
        selectedRouteId,
        isSimulating,
        simulationTime,
        tensionCurve,
        tensionFeedback,
        routeIssues,
        simulationFrames,
        simulationResults,
        caughtPoints,
        selectedCurveVersionIds,
        showAllVersions,
        isDirty,
        filePath,
        actions: {
          setProject,
          selectSceneNode: setSelectedSceneNodeId,
          selectRoute: setSelectedRouteId,
          addSceneNode,
          updateSceneNode,
          removeSceneNode,
          moveSceneNode,
          addWaypoint,
          updateWaypoint,
          removeWaypoint,
          addRoute,
          updateRoute,
          removeRoute,
          reorderRouteWaypoint,
          toggleWaypointJunction,
          toggleWaypointDeadEnd,
          startSimulation,
          stopSimulation,
          setSimulationTime,
          runFullAnalysis,
          simulateRoute,
          saveTensionCurveVersion,
          deleteTensionCurveVersion,
          toggleCurveVersion,
          setShowAllVersions,
          saveProject,
          loadProject,
          newProject,
          saveSimulationRecord,
          deleteSimulationRecord,
          updateSimulationRecordNotes,
          calculateVersionDiff,
          checkUnsavedChanges,
          setSimulationTimeDirect,
        },
      }}
    >
      {children}
    </EditorContext.Provider>
  )
}

export const useEditor = () => {
  const ctx = useContext(EditorContext)
  if (!ctx) {
    throw new Error('useEditor must be used within EditorProvider')
  }
  return ctx
}
