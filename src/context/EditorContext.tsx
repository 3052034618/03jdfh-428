import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { ProjectData, SceneNode, MapWaypoint, EscapeRoute, TensionCurvePoint, TensionFeedback, RouteIssue, ChaseSimulationFrame } from '../types'
import { createSampleProject } from '../data/sampleProject'
import { calculateTensionCurve, analyzeTensionCurve } from '../utils/tensionAnalysis'
import { simulateChase, analyzeRouteIssues } from '../utils/routeSimulation'

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
    startSimulation: () => void
    stopSimulation: () => void
    setSimulationTime: (time: number) => void
    runFullAnalysis: () => void
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
      routes: prev.routes.map(r => r.id === id ? { ...r, ...updates } : r),
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

  const runFullAnalysis = useCallback(() => {
    const curve = calculateTensionCurve(project.sceneNodes)
    setTensionCurve(curve)
    setTensionFeedback(analyzeTensionCurve(curve))

    const frames: Record<string, ChaseSimulationFrame[]> = {}
    const allIssues: RouteIssue[] = []

    project.routes.forEach(route => {
      const waypoints = route.waypointIds
        .map(wid => project.waypoints.find(w => w.id === wid))
        .filter(Boolean) as MapWaypoint[]
      const routeFrames = simulateChase(waypoints, route.playerSpeed, route.monsterSpeed)
      frames[route.id] = routeFrames
      allIssues.push(...analyzeRouteIssues(routeFrames, route, waypoints))
    })

    setSimulationFrames(frames)
    setRouteIssues(allIssues)
  }, [project])

  const startSimulation = useCallback(() => {
    setIsSimulating(true)
  }, [])

  const stopSimulation = useCallback(() => {
    setIsSimulating(false)
  }, [])

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
          startSimulation,
          stopSimulation,
          setSimulationTime,
          runFullAnalysis,
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
