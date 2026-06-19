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
  TimeSliceEvent,
  TimeSliceEventType,
  DirectorNote,
  RecentProjectEntry,
  ExportReportData,
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
  recentProjects: RecentProjectEntry[]
  showWelcome: boolean
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
    getEventsNearTime: (routeId: string, time: number, range?: number) => TimeSliceEvent[]
    addDirectorNote: (note: Omit<DirectorNote, 'id' | 'createdAt'>) => void
    updateDirectorNote: (noteId: string, content: string) => void
    deleteDirectorNote: (noteId: string) => void
    jumpToNoteTime: (note: DirectorNote) => void
    loadRecentProject: (filePath: string) => Promise<boolean>
    clearRecentProjects: () => void
    setShowWelcome: (show: boolean) => void
    generateExportReport: () => ExportReportData
    exportReportAsHtml: (report: ExportReportData) => string
    downloadReport: (report: ExportReportData) => void
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
  const [recentProjects, setRecentProjects] = useState<RecentProjectEntry[]>([])
  const [showWelcome, setShowWelcome] = useState(true)
  const eventsCacheRef = useRef<Record<string, TimeSliceEvent[]>>({})

  useEffect(() => {
    const saved = localStorage.getItem('chase-recent-projects')
    if (saved) {
      try {
        setRecentProjects(JSON.parse(saved))
      } catch {}
    }
    const showWelcomeSaved = localStorage.getItem('chase-show-welcome')
    if (showWelcomeSaved === 'false') {
      setShowWelcome(false)
    }
  }, [])

  const saveRecentProjects = useCallback((entries: RecentProjectEntry[]) => {
    setRecentProjects(entries)
    localStorage.setItem('chase-recent-projects', JSON.stringify(entries))
  }, [])

  const updateRecentProjectEntry = useCallback((path: string, updates: Partial<RecentProjectEntry>) => {
    setRecentProjects(prev => {
      const exists = prev.find(p => p.filePath === path)
      let newEntries: RecentProjectEntry[]
      if (exists) {
        newEntries = prev.map(p => p.filePath === path ? { ...p, ...updates, lastOpenedAt: Date.now() } : p)
      } else {
        const parts = path.split(/[\\/]/)
        const fileName = parts[parts.length - 1]
        newEntries = [
          {
            filePath: path,
            fileName,
            projectName: updates.projectName || fileName.replace('.chase.json', ''),
            lastSavedAt: updates.lastSavedAt || Date.now(),
            lastOpenedAt: Date.now(),
            hasUnsavedChanges: updates.hasUnsavedChanges || false,
          },
          ...prev,
        ].slice(0, 10)
      }
      localStorage.setItem('chase-recent-projects', JSON.stringify(newEntries))
      return newEntries
    })
  }, [])

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

  const loadProject = useCallback((data: ProjectData, path?: string) => {
    const safeData: ProjectData = {
      ...data,
      directorNotes: data.directorNotes || [],
      simulationRecords: data.simulationRecords || [],
      tensionCurveVersions: data.tensionCurveVersions || [],
    }
    setProjectState(safeData)
    if (path) {
      setFilePath(path)
      updateRecentProjectEntry(path, {
        projectName: safeData.name,
        hasUnsavedChanges: false,
      })
    }
    setIsDirty(false)
    setSelectedRouteId(safeData.routes[0]?.id || null)
    setSelectedSceneNodeId(null)
    setSimulationFrames({})
    setSimulationResults({})
    setCaughtPoints({})
    setRouteIssues([])
    setTensionCurve([])
    setTensionFeedback([])
    setSelectedCurveVersionIds([])
    eventsCacheRef.current = {}
  }, [updateRecentProjectEntry])

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

  const getEventsForRoute = useCallback((routeId: string): TimeSliceEvent[] => {
    if (eventsCacheRef.current[routeId]) {
      return eventsCacheRef.current[routeId]
    }

    const route = project.routes.find(r => r.id === routeId)
    const frames = simulationFrames[routeId] || []
    const result = simulationResults[routeId]
    const issues = routeIssues.filter(i => i.routeId === routeId)
    if (!route || frames.length === 0) {
      eventsCacheRef.current[routeId] = []
      return []
    }

    const waypoints = route.waypointIds
      .map(wid => project.waypoints.find(w => w.id === wid))
      .filter(Boolean) as MapWaypoint[]

    const events: TimeSliceEvent[] = []

    if (result?.caughtPoint) {
      events.push({
        id: `caught-${routeId}`,
        type: 'caught',
        time: result.caughtPoint.time,
        routeId,
        position: result.caughtPoint.position,
        description: '玩家被怪物追上！',
        severity: 'critical',
      })
    }

    result?.stuckPoints.forEach((sp, idx) => {
      const wp = waypoints.find(w => w.id === sp.waypointId)
      events.push({
        id: `stuck-${routeId}-${idx}`,
        type: 'stuck',
        time: sp.time,
        routeId,
        position: sp.position,
        description: `在${wp?.label || '未知位置'}卡死`,
        severity: 'critical',
        waypointId: sp.waypointId,
        waypointLabel: wp?.label,
      })
    })

    issues.forEach(issue => {
      if (issue.type === 'lost') {
        const frame = frames.find(f => Math.abs(f.time - (issue as any).time) < 0.3)
        events.push({
          id: `lost-${issue.id}`,
          type: 'lost',
          time: (issue as any).time || 0,
          routeId,
          position: issue.position,
          description: issue.description,
          severity: issue.severity as 'warning' | 'critical',
          waypointId: issue.waypointId,
        })
      }
    })

    let dangerCloseIdx = 0
    frames.forEach((f, idx) => {
      if (f.distance < 40 && idx > 0 && frames[idx - 1].distance >= 40) {
        events.push({
          id: `danger-${routeId}-${dangerCloseIdx++}`,
          type: 'danger_close',
          time: f.time,
          routeId,
          position: f.playerPosition,
          description: `怪物接近到 ${f.distance.toFixed(1)} 单位`,
          severity: f.distance < 25 ? 'critical' : 'warning',
          distance: f.distance,
        })
      }
    })

    waypoints.forEach((wp, idx) => {
      const frameAtWaypoint = frames.find(f => f.waypointIndex === idx)
      if (frameAtWaypoint) {
        if (wp.isJunction) {
          events.push({
            id: `junction-${routeId}-${idx}`,
            type: 'junction',
            time: frameAtWaypoint.time,
            routeId,
            position: wp.position,
            description: `岔路点 ${wp.label}`,
            severity: 'info',
            waypointId: wp.id,
            waypointLabel: wp.label,
          })
        }
        if (wp.isDeadEnd) {
          events.push({
            id: `deadend-${routeId}-${idx}`,
            type: 'stuck',
            time: frameAtWaypoint.time,
            routeId,
            position: wp.position,
            description: `死胡同 ${wp.label}`,
            severity: 'warning',
            waypointId: wp.id,
            waypointLabel: wp.label,
          })
        }
        events.push({
          id: `waypoint-${routeId}-${idx}`,
          type: 'waypoint_reached',
          time: frameAtWaypoint.time,
          routeId,
          position: wp.position,
          description: `到达路点 ${wp.label}`,
          severity: 'info',
          waypointId: wp.id,
          waypointLabel: wp.label,
        })
      }
    })

    project.sceneNodes.forEach(node => {
      if (node.doorLockDelay > 0) {
        const doorLockTime = node.startOffset + node.duration * 0.4
        const matchingFrame = frames.find(f => Math.abs(f.time - doorLockTime) < 0.5)
        if (matchingFrame) {
          events.push({
            id: `door-${routeId}-${node.id}`,
            type: 'door_lock',
            time: doorLockTime,
            routeId,
            position: matchingFrame.playerPosition,
            description: `门锁等待 ${node.name} (${node.doorLockDelay}s)`,
            severity: 'warning',
          })
        }
      }
    })

    events.sort((a, b) => a.time - b.time)
    eventsCacheRef.current[routeId] = events
    return events
  }, [project, simulationFrames, simulationResults, routeIssues])

  const getEventsNearTime = useCallback((routeId: string, time: number, range = 1.0): TimeSliceEvent[] => {
    const events = getEventsForRoute(routeId)
    return events.filter(e => Math.abs(e.time - time) <= range)
  }, [getEventsForRoute])

  const addDirectorNote = useCallback((note: Omit<DirectorNote, 'id' | 'createdAt'>) => {
    const newNote: DirectorNote = {
      ...note,
      id: uuidv4(),
      createdAt: Date.now(),
    }
    setProject(prev => ({
      ...prev,
      directorNotes: [...prev.directorNotes, newNote],
    }))
  }, [setProject])

  const updateDirectorNote = useCallback((noteId: string, content: string) => {
    setProject(prev => ({
      ...prev,
      directorNotes: prev.directorNotes.map(n =>
        n.id === noteId ? { ...n, content } : n
      ),
    }))
  }, [setProject])

  const deleteDirectorNote = useCallback((noteId: string) => {
    setProject(prev => ({
      ...prev,
      directorNotes: prev.directorNotes.filter(n => n.id !== noteId),
    }))
  }, [setProject])

  const jumpToNoteTime = useCallback((note: DirectorNote) => {
    actions.setSimulationTimeDirect(note.time)
    if (note.routeId && note.routeId !== selectedRouteId) {
      actions.selectRoute(note.routeId)
    }
  }, [selectedRouteId])

  const loadRecentProject = useCallback(async (path: string): Promise<boolean> => {
    if (isDirty) {
      if (!confirm('当前项目有未保存的更改，确定要打开另一个项目吗？')) {
        return false
      }
    }

    try {
      const fs = (window as any).electronAPI?.fs
      if (!fs) return false

      const content = await fs.promises.readFile(path, 'utf-8')
      const data = JSON.parse(content) as ProjectData
      if (!data.directorNotes) data.directorNotes = []
      if (!data.simulationRecords) data.simulationRecords = []
      if (!data.tensionCurveVersions) data.tensionCurveVersions = []

      loadProject(data, path)
      updateRecentProjectEntry(path, { projectName: data.name, hasUnsavedChanges: false })
      setShowWelcome(false)
      return true
    } catch {
      alert('打开文件失败')
      return false
    }
  }, [isDirty, loadProject, updateRecentProjectEntry])

  const clearRecentProjects = useCallback(() => {
    saveRecentProjects([])
  }, [saveRecentProjects])

  const generateExportReport = useCallback((): ExportReportData => {
    const sortedRecords = [...project.simulationRecords]
      .sort((a, b) => a.dangerScore - b.dangerScore)
      .map((record, idx) => ({
        record,
        notes: project.directorNotes.filter(n => n.routeId === record.routeId),
        rank: idx + 1,
      }))

    const allDiffs: TensionVersionDiff[] = []
    for (let i = 0; i < project.tensionCurveVersions.length; i++) {
      for (let j = i + 1; j < project.tensionCurveVersions.length; j++) {
        const diff = calculateVersionDiff(project.tensionCurveVersions[i].id, project.tensionCurveVersions[j].id)
        if (diff) allDiffs.push(diff)
      }
    }

    const avgDanger = sortedRecords.length > 0
      ? sortedRecords.reduce((a, b) => a + b.record.dangerScore, 0) / sortedRecords.length
      : 0

    let overallConclusion = ''
    if (avgDanger >= 80) overallConclusion = '危险度过高，玩家容易产生疲劳感，建议降低怪物速度或增加更多喘息空间。'
    else if (avgDanger >= 50) overallConclusion = '节奏把控良好，紧张与放松的平衡较好，可根据剧情需求微调。'
    else if (avgDanger > 0) overallConclusion = '紧张感不足，考虑提升怪物速度或缩短门锁等待时间。'
    else overallConclusion = '暂无足够数据，请先运行路线模拟。'

    const recommendations: string[] = []
    const criticalRoutes = sortedRecords.filter(r => r.record.dangerScore >= 70)
    if (criticalRoutes.length > 0) {
      recommendations.push(`高危险路线 (${criticalRoutes.length}条)：${criticalRoutes.map(r => r.record.routeName).join('、')}，建议优先优化。`)
    }
    if (project.tensionCurveVersions.length >= 2) {
      const latestDiff = allDiffs[allDiffs.length - 1]
      if (latestDiff && latestDiff.peakValueChange > 10) {
        recommendations.push(`最新版本峰值提升 ${latestDiff.peakValueChange > 0 ? '+' : ''}${latestDiff.peakValueChange}，注意是否过于密集。`)
      }
    }
    if (project.sceneNodes.some(n => n.doorLockDelay > 3)) {
      recommendations.push('存在较长的门锁等待(>3s)，确保玩家有足够的心理铺垫。')
    }

    return {
      generatedAt: Date.now(),
      projectName: project.name,
      filePath,
      routeRecords: sortedRecords,
      versionDiffs: allDiffs,
      overallConclusion,
      recommendations,
    }
  }, [project, filePath, calculateVersionDiff])

  const exportReportAsHtml = useCallback((report: ExportReportData): string => {
    const formatTime = (ms: number) => new Date(ms).toLocaleString('zh-CN')
    const getDangerColor = (score: number) => {
      if (score >= 70) return '#ef4444'
      if (score >= 40) return '#f59e0b'
      return '#22c55e'
    }

    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${report.projectName} - 追逐段落复盘报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, "Segoe UI", sans-serif; background: #0f0f1a; color: #e5e5e5; padding: 40px; }
    .container { max-width: 1200px; margin: 0 auto; }
    header { border-bottom: 2px solid #a855f7; padding-bottom: 20px; margin-bottom: 30px; }
    h1 { color: #a855f7; font-size: 28px; margin-bottom: 8px; }
    .subtitle { color: #9ca3af; font-size: 14px; }
    .section { background: #1a1a2e; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #2a2a4a; }
    h2 { color: #c084fc; font-size: 20px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .conclusion { background: linear-gradient(135deg, #7c3aed20, #ec489920); border-left: 4px solid #a855f7; padding: 16px; border-radius: 8px; }
    .route-card { background: #252545; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .route-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .route-name { font-weight: 600; font-size: 16px; }
    .danger-badge { padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 14px; }
    .route-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 12px; }
    .meta-item { text-align: center; padding: 8px; background: #1a1a2e; border-radius: 6px; }
    .meta-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; }
    .meta-value { font-size: 18px; font-weight: 600; margin-top: 2px; }
    .moments { margin-top: 12px; }
    .moment { display: flex; gap: 12px; padding: 8px; background: #1a1a2e; border-radius: 6px; margin-bottom: 6px; font-size: 13px; }
    .moment-time { color: #a855f7; font-weight: 600; min-width: 60px; }
    .notes { margin-top: 12px; padding: 12px; background: #0f0f1a; border-radius: 6px; border-left: 3px solid #f59e0b; }
    .recommendation { padding: 10px 14px; background: #2a2a4a; border-radius: 6px; margin-bottom: 8px; font-size: 14px; }
    .diff-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .diff-table th, .diff-table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #2a2a4a; font-size: 14px; }
    .diff-table th { color: #a855f7; font-weight: 600; }
    .positive { color: #22c55e; }
    .negative { color: #ef4444; }
    .director-notes { margin-top: 16px; }
    .note-item { padding: 10px 14px; background: #1a1a2e; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #a855f7; }
    .note-header { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; color: #9ca3af; }
    .note-content { font-size: 14px; }
  </style>
</head>
<body>
<div class="container">
  <header>
    <h1>🎬 ${report.projectName}</h1>
    <div class="subtitle">追逐段落复盘报告 · 生成于 ${formatTime(report.generatedAt)}</div>
    ${report.filePath ? `<div class="subtitle" style="margin-top: 4px;">文件: ${report.filePath}</div>` : ''}
  </header>

  <div class="section">
    <h2>📋 总体结论</h2>
    <div class="conclusion">${report.overallConclusion}</div>
  </div>

  ${report.recommendations.length > 0 ? `
  <div class="section">
    <h2>💡 优化建议</h2>
    ${report.recommendations.map(r => `<div class="recommendation">• ${r}</div>`).join('')}
  </div>
  ` : ''}

  <div class="section">
    <h2>🏆 路线危险排名</h2>
    ${report.routeRecords.map(({ record, notes, rank }) => `
      <div class="route-card">
        <div class="route-header">
          <div>
            <span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:${getDangerColor(record.dangerScore)};color:white;text-align:center;line-height:24px;font-size:12px;font-weight:700;margin-right:10px;">${rank}</span>
            <span class="route-name" style="color:${record.routeColor};">${record.routeName}</span>
          </div>
          <span class="danger-badge" style="background:${getDangerColor(record.dangerScore)}20;color:${getDangerColor(record.dangerScore)};">
            危险分数 ${record.dangerScore}
          </span>
        </div>
        <div style="color:#9ca3af;font-size:13px;margin-bottom:8px;">
          ${record.success ? '✅ 成功逃脱' : '❌ 被捕获'} · 总时长 ${record.totalTime.toFixed(1)}s · 最近距离 ${record.minDistance.toFixed(1)}
        </div>
        <div class="route-meta">
          <div class="meta-item">
            <div class="meta-label">玩家速度</div>
            <div class="meta-value">${record.playerSpeed}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">怪物速度</div>
            <div class="meta-value">${record.monsterSpeed}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">严重问题</div>
            <div class="meta-value" style="color:#ef4444;">${record.criticalIssues}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">警告问题</div>
            <div class="meta-value" style="color:#f59e0b;">${record.warningIssues}</div>
          </div>
        </div>
        ${record.keyMoments.length > 0 ? `
        <div class="moments">
          <div style="font-size:12px;color:#a855f7;margin-bottom:6px;">🎯 关键时刻</div>
          ${record.keyMoments.slice(0, 5).map(m => `
            <div class="moment">
              <span class="moment-time">${m.time.toFixed(1)}s</span>
              <span>${m.label}</span>
              <span style="margin-left:auto;color:${m.value >= 80 ? '#ef4444' : m.value >= 50 ? '#f59e0b' : '#22c55e'};">${m.value}</span>
            </div>
          `).join('')}
        </div>
        ` : ''}
        ${record.notes ? `<div class="notes"><strong>备注:</strong> ${record.notes}</div>` : ''}
        ${notes.length > 0 ? `
        <div class="director-notes">
          <div style="font-size:12px;color:#a855f7;margin-bottom:6px;">📝 导演批注 (${notes.length})</div>
          ${notes.map(n => `
            <div class="note-item">
              <div class="note-header">
                <span>${n.time.toFixed(1)}s</span>
                <span>${new Date(n.createdAt).toLocaleString('zh-CN')}</span>
              </div>
              <div class="note-content">${n.content}</div>
            </div>
          `).join('')}
        </div>
        ` : ''}
      </div>
    `).join('')}
  </div>

  ${report.versionDiffs.length > 0 ? `
  <div class="section">
    <h2>📊 版本差异分析</h2>
    ${report.versionDiffs.slice(-3).map(diff => `
      <div style="margin-bottom:20px;">
        <div style="color:#c084fc;font-weight:600;margin-bottom:8px;">
          ${diff.baseName} → ${diff.targetName}
          <span style="color:#9ca3af;font-weight:400;font-size:12px;margin-left:8px;">
            间隔 ${Math.round(diff.timeDiff / 60)} 分 ${diff.timeDiff % 60} 秒
          </span>
        </div>
        <table class="diff-table">
          <tr><th>指标</th><th>变化</th></tr>
          <tr><td>峰值</td><td class="${diff.peakValueChange > 0 ? 'negative' : diff.peakValueChange < 0 ? 'positive' : ''}">${diff.peakValueChange > 0 ? '+' : ''}${diff.peakValueChange}</td></tr>
          <tr><td>峰值位置</td><td>${diff.peakTimeChange > 0 ? '+' : ''}${diff.peakTimeChange}s</td></tr>
          <tr><td>平均紧张</td><td class="${diff.avgValueChange > 0 ? 'negative' : diff.avgValueChange < 0 ? 'positive' : ''}">${diff.avgValueChange > 0 ? '+' : ''}${diff.avgValueChange}</td></tr>
          <tr><td>恢复时间</td><td class="${diff.recoveryTimeChange > 0 ? 'negative' : diff.recoveryTimeChange < 0 ? 'positive' : ''}">${diff.recoveryTimeChange > 0 ? '+' : ''}${diff.recoveryTimeChange}s</td></tr>
          <tr><td>门锁影响</td><td class="${diff.doorLockImpactChange > 0 ? 'negative' : diff.doorLockImpactChange < 0 ? 'positive' : ''}">${diff.doorLockImpactChange > 0 ? '+' : ''}${diff.doorLockImpactChange}</td></tr>
          <tr><td>爆发点数量</td><td class="${diff.peakCountChange > 0 ? 'negative' : diff.peakCountChange < 0 ? 'positive' : ''}">${diff.peakCountChange > 0 ? '+' : ''}${diff.peakCountChange}</td></tr>
        </table>
        ${diff.significantChanges.length > 0 ? `
          <div style="margin-top:12px;font-size:12px;color:#9ca3af;">显著变化点 (${diff.significantChanges.length}):</div>
          ${diff.significantChanges.slice(0, 5).map(c => `
            <div style="padding:6px 10px;background:#2a2a4a;border-radius:4px;margin-top:4px;font-size:13px;">
              ${c.time.toFixed(1)}s: ${c.label} <span class="${c.valueDiff > 0 ? 'negative' : 'positive'}">(${c.valueDiff > 0 ? '+' : ''}${c.valueDiff})</span>
              <span style="color:#6b7280;margin-left:8px;">[${c.type}]</span>
            </div>
          `).join('')}
        ` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
</div>
</body>
</html>`

    return html
  }, [])

  const downloadReport = useCallback((report: ExportReportData) => {
    const html = exportReportAsHtml(report)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.projectName}_复盘报告_${new Date().toISOString().slice(0, 10)}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [exportReportAsHtml])

  useEffect(() => {
    eventsCacheRef.current = {}
  }, [simulationFrames, simulationResults, routeIssues])

  const markAsSaved = useCallback((savedPath?: string) => {
    setIsDirty(false)
    if (savedPath) {
      setFilePath(savedPath)
      setProjectState(prev => ({ ...prev, filePath: savedPath }))
      updateRecentProjectEntry(savedPath, {
        projectName: project.name,
        lastSavedAt: Date.now(),
        hasUnsavedChanges: false,
      })
    }
  }, [project.name, updateRecentProjectEntry])

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

  const newProject = useCallback(() => {
    const newProj: ProjectData = {
      name: '未命名项目',
      sceneNodes: [],
      waypoints: [],
      routes: [],
      tensionCurveVersions: [],
      simulationRecords: [],
      directorNotes: [],
    }
    loadProject(newProj)
    setFilePath(undefined)
    setShowWelcome(false)
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

    const unsubNew = api.onNewProject(() => {
      if (isDirty) {
        if (!confirm('当前项目有未保存的更改，确定要新建项目吗？')) {
          return
        }
      }
      newProject()
    })
    const unsubLoad = api.onLoadProject((data: ProjectData, path?: string) => {
      if (isDirty) {
        if (!confirm('当前项目有未保存的更改，确定要打开另一个项目吗？')) {
          return
        }
      }
      loadProject(data, path)
      setShowWelcome(false)
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
  }, [isDirty, newProject, loadProject, saveProject, runFullAnalysis, startSimulation, saveTensionCurveVersion, project.tensionCurveVersions.length])

  const actions = {
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
    getEventsNearTime,
    addDirectorNote,
    updateDirectorNote,
    deleteDirectorNote,
    jumpToNoteTime,
    loadRecentProject,
    clearRecentProjects,
    setShowWelcome,
    generateExportReport,
    exportReportAsHtml,
    downloadReport,
  }

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
        recentProjects,
        showWelcome,
        actions,
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
