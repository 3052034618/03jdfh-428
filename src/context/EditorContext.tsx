import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
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
} from '../types'
import { createSampleProject } from '../data/sampleProject'
import { calculateTensionCurve, analyzeTensionCurve } from '../utils/tensionAnalysis'
import { simulateChase, analyzeRouteIssues, type SimulationResult } from '../utils/routeSimulation'

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
    loadProject: (data: ProjectData) => void
    newProject: () => void
  }
}

const EditorContext = createContext<EditorContextType | null>(null)

export const EditorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [project, setProject] = useState<ProjectData>(createSampleProject())
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
    setIsSimulating(true)
  }, [selectedRouteId, simulateRoute])

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
      return (window as any).electronAPI.saveProject(project)
    }
    return { success: false }
  }, [project])

  const loadProject = useCallback((data: ProjectData) => {
    setProject(data)
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
    }
    loadProject(newProj)
  }, [loadProject])

  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) return
    const api = (window as any).electronAPI

    const unsubNew = api.onNewProject(() => newProject())
    const unsubLoad = api.onLoadProject((data: ProjectData) => loadProject(data))
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
