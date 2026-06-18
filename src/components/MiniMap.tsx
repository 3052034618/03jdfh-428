import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useEditor } from '../context/EditorContext'
import type { MapWaypoint, MapPosition, CaughtPoint } from '../types'

const MAP_WIDTH = 1000
const MAP_HEIGHT = 500

export const MiniMap: React.FC = () => {
  const {
    project,
    selectedRouteId,
    simulationFrames,
    simulationTime,
    isSimulating,
    actions,
    routeIssues,
    caughtPoints,
    simulationResults,
  } = useEditor()
  const svgRef = useRef<SVGSVGElement>(null)
  const [draggingWaypoint, setDraggingWaypoint] = useState<string | null>(null)

  const selectedRoute = project.routes.find(r => r.id === selectedRouteId)
  const result = selectedRoute ? simulationResults[selectedRoute.id] : null
  const frames = selectedRoute ? simulationFrames[selectedRoute.id] ?? [] : []
  const frameIndex = Math.min(Math.floor(simulationTime / 0.1), frames.length - 1)
  const currentFrame = frames[frameIndex]
  const caughtPoint = selectedRoute ? caughtPoints[selectedRoute.id] : null
  const stuckPoints = result?.stuckPoints ?? []
  const waypoints = selectedRoute
    ? selectedRoute.waypointIds
        .map(wid => project.waypoints.find(w => w.id === wid))
        .filter(Boolean) as MapWaypoint[]
    : []

  useEffect(() => {
    if (!isSimulating) return
    let frame: number
    let startTime = performance.now()
    const totalDuration = frames.length * 0.1

    const animate = (now: number) => {
      const elapsed = (now - startTime) / 1000
      const t = Math.min(elapsed, totalDuration)
      actions.setSimulationTime(t)
      if (t < totalDuration) {
        frame = requestAnimationFrame(animate)
      } else {
        actions.stopSimulation()
      }
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [isSimulating, frames.length, actions])

  const getScreenPos = (pos: MapPosition): MapPosition => ({
    x: pos.x + 50,
    y: pos.y + 50,
  })

  const handleSvgClick = (e: React.MouseEvent) => {
    if (!svgRef.current || draggingWaypoint) return
    const rect = svgRef.current.getBoundingClientRect()
    const scaleX = (MAP_WIDTH + 100) / rect.width
    const scaleY = (MAP_HEIGHT + 100) / rect.height
    const x = (e.clientX - rect.left) * scaleX - 50
    const y = (e.clientY - rect.top) * scaleY - 50

    if (e.detail === 2) {
      actions.addWaypoint({
        position: { x, y },
        label: `节点${project.waypoints.length + 1}`,
        difficulty: 'medium',
        isJunction: false,
        isDeadEnd: false,
      })
    }
  }

  const handleWaypointMouseDown = (e: React.MouseEvent, wp: MapWaypoint) => {
    e.stopPropagation()
    setDraggingWaypoint(wp.id)
  }

  useEffect(() => {
    if (!draggingWaypoint || !svgRef.current) return

    const handleMove = (e: MouseEvent) => {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const scaleX = (MAP_WIDTH + 100) / rect.width
      const scaleY = (MAP_HEIGHT + 100) / rect.height
      const x = Math.max(0, Math.min(MAP_WIDTH, (e.clientX - rect.left) * scaleX - 50))
      const y = Math.max(0, Math.min(MAP_HEIGHT, (e.clientY - rect.top) * scaleY - 50))
      actions.updateWaypoint(draggingWaypoint, { position: { x, y } })
    }

    const handleUp = () => setDraggingWaypoint(null)

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [draggingWaypoint, actions])

  const waypointIssues = routeIssues.filter(i => selectedRouteId && i.routeId === selectedRouteId)

  const stats = useMemo(() => {
    if (!result || frames.length === 0) return null
    const distValues = frames.map(f => f.distance)
    const minDist = Math.min(...distValues)
    const avgDist = distValues.reduce((a, b) => a + b, 0) / distValues.length
    return {
      totalTime: result.totalTime,
      success: result.success,
      finalDistance: result.finalDistance,
      minDistance: minDist,
      avgDistance: Math.round(avgDist),
      stuckCount: result.stuckPoints.length,
    }
  }, [result, frames])

  const allRouteSummaries = useMemo(() => {
    return project.routes.map(route => {
      const r = simulationResults[route.id]
      const issues = routeIssues.filter(i => i.routeId === route.id)
      const criticalCount = issues.filter(i => i.severity === 'critical').length
      const distValues = r?.frames.map(f => f.distance) ?? []
      const minDist = distValues.length > 0 ? Math.min(...distValues) : 0
      let dangerScore = 0
      if (r) {
        if (!r.success) dangerScore += 100
        dangerScore += criticalCount * 30
        if (minDist < 30) dangerScore += 25
        else if (minDist < 60) dangerScore += 10
        dangerScore += r.stuckPoints.length * 20
      }
      return {
        route,
        result: r,
        dangerScore: Math.min(100, dangerScore),
        criticalCount,
        warningCount: issues.length - criticalCount,
        minDistance: minDist,
        totalTime: r?.totalTime ?? 0,
      }
    }).sort((a, b) => b.dangerScore - a.dangerScore)
  }, [project.routes, simulationResults, routeIssues])

  return (
    <div className="flex-1 flex flex-col bg-gray-900/40 rounded-lg border border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-900/80">
        <div>
          <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wider">玩家路线预览</h3>
          <p className="text-xs text-gray-400">双击添加路点 · 拖动调整位置 · 点击播放追逐</p>
        </div>
        <div className="flex items-center gap-2">
          {stats && (
            <div className="flex items-center gap-3 mr-2 text-xs">
              <span className={stats.success ? 'text-green-400' : 'text-red-400'}>
                {stats.success ? '✓ 成功逃脱' : '✗ 被捕获'}
              </span>
              <span className="text-gray-400">
                总时长: <span className="text-white font-mono">{stats.totalTime.toFixed(1)}s</span>
              </span>
              <span className="text-gray-400">
                最近距离: <span className={stats.minDistance < 30 ? 'text-red-400 font-mono' : 'text-white font-mono'}>{stats.minDistance}</span>
              </span>
              {stats.stuckCount > 0 && (
                <span className="text-red-400">
                  🚫 卡死点: {stats.stuckCount}
                </span>
              )}
            </div>
          )}
          <button
            onClick={() => {
              actions.setSimulationTime(0)
              if (selectedRouteId) {
                actions.simulateRoute(selectedRouteId)
              }
              actions.startSimulation()
            }}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-xs font-medium transition-colors"
          >
            ▶ 播放追逐
          </button>
          <button
            onClick={() => actions.stopSimulation()}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium transition-colors"
          >
            ■ 停止
          </button>
          <div className="flex-1 flex items-center gap-2 mx-3">
            <span className="text-[10px] text-gray-500 w-8 text-right">0.0s</span>
            <input
              type="range"
              min={0}
              max={frames.length > 0 ? frames[frames.length - 1].time : 0}
              step={0.1}
              value={simulationTime}
              onChange={e => {
                const time = parseFloat(e.target.value)
                actions.setSimulationTimeDirect(time)
              }}
              onMouseDown={() => actions.stopSimulation()}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <span className="text-[10px] text-gray-500 w-12 text-left">
              {frames.length > 0 ? frames[frames.length - 1].time.toFixed(1) : 0}s
            </span>
          </div>
          <span className="text-xs text-gray-400 font-mono w-14 text-right">
            {simulationTime.toFixed(1)}s
          </span>
        </div>
        {currentFrame && (
          <div className="px-4 py-2 border-t border-gray-700 bg-gray-900/60 flex items-center gap-4 text-xs flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-blue-400">🟢 玩家</span>
              <span className="text-gray-400 font-mono">
                ({currentFrame.playerPosition.x.toFixed(0)}, {currentFrame.playerPosition.y.toFixed(0)})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-400">🔴 怪物</span>
              <span className="text-gray-400 font-mono">
                ({currentFrame.monsterPosition.x.toFixed(0)}, {currentFrame.monsterPosition.y.toFixed(0)})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">最近距离:</span>
              <span
                className={`font-mono font-bold ${
                  currentFrame.distance < 30 ? 'text-red-400' : currentFrame.distance < 60 ? 'text-amber-400' : 'text-green-400'
                }`}
              >
                {currentFrame.distance.toFixed(1)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">紧张值:</span>
              <span className="text-purple-400 font-mono font-bold">
                {currentFrame.tension}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">路点:</span>
              <span className="text-gray-300 font-mono">
                #{currentFrame.waypointIndex + 1} / {waypoints.length}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 bg-gray-950">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${MAP_WIDTH + 100} ${MAP_HEIGHT + 100}`}
          className="w-full h-full cursor-crosshair"
          style={{ minHeight: '400px' }}
          onClick={handleSvgClick}
        >
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#1f2937" strokeWidth="1" />
            </pattern>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect x="0" y="0" width={MAP_WIDTH + 100} height={MAP_HEIGHT + 100} fill="url(#grid)" />

          {project.routes.map(route => {
            const waypoints = route.waypointIds
              .map(wid => project.waypoints.find(w => w.id === wid))
              .filter(Boolean) as MapWaypoint[]
            if (waypoints.length < 2) return null

            const pathD = waypoints
              .map((wp, i) => {
                const p = getScreenPos(wp.position)
                return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
              })
              .join(' ')

            const isSelected = route.id === selectedRouteId

            return (
              <g key={route.id}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={route.color}
                  strokeWidth={isSelected ? 4 : 2}
                  strokeOpacity={isSelected ? 0.9 : 0.4}
                  strokeDasharray={isSelected ? 'none' : '8 4'}
                />
                {isSelected && waypoints.length >= 2 && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke={route.color}
                    strokeWidth={8}
                    strokeOpacity={0.15}
                    filter="url(#glow)"
                  />
                )}
              </g>
            )
          })}

          {stuckPoints.map(sp => {
            const pos = getScreenPos(sp.position)
            return (
              <g key={sp.id}>
                <circle cx={pos.x} cy={pos.y} r={24} fill="#7f1d1d" opacity={0.2} />
                <circle cx={pos.x} cy={pos.y} r={16} fill="#7f1d1d" stroke="#ef4444" strokeWidth={2} />
                <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">
                  🚫
                </text>
                <text x={pos.x} y={pos.y + 40} textAnchor="middle" fill="#fca5a5" fontSize="10">
                  卡死点 {sp.time.toFixed(1)}s
                </text>
              </g>
            )
          })}

          {caughtPoint && (
            <g>
              <circle
                cx={getScreenPos(caughtPoint.position).x}
                cy={getScreenPos(caughtPoint.position).y}
                r={32}
                fill="#dc2626"
                opacity={0.15}
              >
                <animate attributeName="r" values="28;36;28" dur="1.5s" repeatCount="indefinite" />
              </circle>
              <circle
                cx={getScreenPos(caughtPoint.position).x}
                cy={getScreenPos(caughtPoint.position).y}
                r={20}
                fill="#7f1d1d"
                stroke="#ef4444"
                strokeWidth={3}
              />
              <text
                x={getScreenPos(caughtPoint.position).x}
                y={getScreenPos(caughtPoint.position).y + 5}
                textAnchor="middle"
                fill="#fff"
                fontSize="16"
                fontWeight="bold"
              >
                💀
              </text>
              <text
                x={getScreenPos(caughtPoint.position).x}
                y={getScreenPos(caughtPoint.position).y + 45}
                textAnchor="middle"
                fill="#fca5a5"
                fontSize="11"
                fontWeight="bold"
              >
                追上点 {caughtPoint.time.toFixed(1)}s
              </text>
            </g>
          )}

          {project.waypoints.map(wp => {
            const pos = getScreenPos(wp.position)
            const relatedIssue = waypointIssues.find(i => i.waypointId === wp.id)
            const fillColor = wp.isDeadEnd
              ? '#dc2626'
              : wp.isJunction
                ? '#f59e0b'
                : '#6b7280'

            return (
              <g
                key={wp.id}
                onMouseDown={e => handleWaypointMouseDown(e, wp)}
                className="cursor-move"
              >
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={relatedIssue ? 18 : 14}
                  fill={relatedIssue ? (relatedIssue.severity === 'critical' ? '#7f1d1d' : '#78350f') : '#1f2937'}
                  stroke={relatedIssue ? (relatedIssue.severity === 'critical' ? '#ef4444' : '#f59e0b') : fillColor}
                  strokeWidth={2}
                />
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={8}
                  fill={fillColor}
                />
                <text
                  x={pos.x}
                  y={pos.y - 22}
                  textAnchor="middle"
                  fill="#d1d5db"
                  fontSize="11"
                  fontWeight="500"
                >
                  {wp.label}
                </text>
                {relatedIssue && (
                  <text
                    x={pos.x}
                    y={pos.y + 4}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="12"
                    fontWeight="bold"
                  >
                    {relatedIssue.type === 'caught' ? '💀' : relatedIssue.type === 'stuck' ? '🚫' : '❓'}
                  </text>
                )}
                {wp.isJunction && !relatedIssue && (
                  <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="#fff" fontSize="10">
                    🔀
                  </text>
                )}
                {wp.isDeadEnd && !relatedIssue && (
                  <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="#fff" fontSize="10">
                    🚫
                  </text>
                )}
              </g>
            )
          })}

          {currentFrame && (
            <g filter="url(#glow)">
              <circle
                cx={getScreenPos(currentFrame.monsterPosition).x}
                cy={getScreenPos(currentFrame.monsterPosition).y}
                r={16}
                fill="#7f1d1d"
                opacity={0.6}
              >
                <animate attributeName="r" values="16;22;16" dur="0.8s" repeatCount="indefinite" />
              </circle>
              <circle
                cx={getScreenPos(currentFrame.monsterPosition).x}
                cy={getScreenPos(currentFrame.monsterPosition).y}
                r={10}
                fill="#dc2626"
              />
              <text
                x={getScreenPos(currentFrame.monsterPosition).x}
                y={getScreenPos(currentFrame.monsterPosition).y + 4}
                textAnchor="middle"
                fill="#fff"
                fontSize="12"
                fontWeight="bold"
              >
                👹
              </text>

              <circle
                cx={getScreenPos(currentFrame.playerPosition).x}
                cy={getScreenPos(currentFrame.playerPosition).y}
                r={10}
                fill="#2563eb"
                stroke="#60a5fa"
                strokeWidth={2}
              />
              <text
                x={getScreenPos(currentFrame.playerPosition).x}
                y={getScreenPos(currentFrame.playerPosition).y + 4}
                textAnchor="middle"
                fill="#fff"
                fontSize="11"
                fontWeight="bold"
              >
                🏃
              </text>

              <line
                x1={getScreenPos(currentFrame.playerPosition).x}
                y1={getScreenPos(currentFrame.playerPosition).y}
                x2={getScreenPos(currentFrame.monsterPosition).x}
                y2={getScreenPos(currentFrame.monsterPosition).y}
                stroke={currentFrame.distance < 50 ? '#ef4444' : currentFrame.distance < 100 ? '#f59e0b' : '#4b5563'}
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.6}
              />
            </g>
          )}
        </svg>
      </div>

      {allRouteSummaries.length >= 1 && (
        <div className="border-t border-gray-700 bg-gray-900/80 px-4 py-3 flex-shrink-0">
          <h4 className="text-xs font-semibold text-purple-300 mb-2 uppercase tracking-wider">路线调度复盘 · 危险度排名</h4>
          <div className="flex gap-2 flex-wrap">
            {allRouteSummaries.map((summary, idx) => {
              const isSelected = summary.route.id === selectedRouteId
              const dangerColor = summary.dangerScore >= 70
                ? '#ef4444'
                : summary.dangerScore >= 40
                  ? '#f59e0b'
                  : '#22c55e'
              return (
                <button
                  key={summary.route.id}
                  onClick={() => actions.selectRoute(summary.route.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded text-xs transition-all ${
                    isSelected
                      ? 'bg-purple-900/50 border border-purple-500 ring-1 ring-purple-400/50'
                      : 'bg-gray-800/60 border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <span className="text-[10px] font-mono text-gray-500">#{idx + 1}</span>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: summary.route.color }} />
                  <span className="text-gray-200 font-medium max-w-16 truncate">{summary.route.name}</span>
                  {summary.result ? (
                    <>
                      <span className={summary.result.success ? 'text-green-400' : 'text-red-400'}>
                        {summary.result.success ? '逃脱' : '被抓'}
                      </span>
                      <span className="text-gray-400 font-mono">{summary.totalTime.toFixed(1)}s</span>
                      <span className="text-gray-400">
                        最近:<span className={summary.minDistance < 30 ? 'text-red-400 font-mono' : 'text-gray-300 font-mono'}>{summary.minDistance}</span>
                      </span>
                      {summary.criticalCount > 0 && (
                        <span className="text-red-400">💀{summary.criticalCount}</span>
                      )}
                      <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${summary.dangerScore}%`, backgroundColor: dangerColor }}
                        />
                      </div>
                      <span className="font-mono" style={{ color: dangerColor }}>
                        {summary.dangerScore}
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-500">未模拟</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
