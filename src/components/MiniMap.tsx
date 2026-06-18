import React, { useEffect, useRef, useState } from 'react'
import { useEditor } from '../context/EditorContext'
import type { MapWaypoint, MapPosition } from '../types'

const MAP_WIDTH = 1000
const MAP_HEIGHT = 500

export const MiniMap: React.FC = () => {
  const { project, selectedRouteId, simulationFrames, simulationTime, isSimulating, actions, routeIssues } = useEditor()
  const svgRef = useRef<SVGSVGElement>(null)
  const [draggingWaypoint, setDraggingWaypoint] = useState<string | null>(null)

  useEffect(() => {
    if (!isSimulating) return
    let frame: number
    let startTime = performance.now()
    const maxFrames = simulationFrames[selectedRouteId ?? '']?.length ?? 0
    const totalDuration = maxFrames * 0.1

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
  }, [isSimulating, simulationFrames, selectedRouteId, actions])

  const selectedRoute = project.routes.find(r => r.id === selectedRouteId)
  const frames = selectedRoute ? simulationFrames[selectedRoute.id] ?? [] : []
  const frameIndex = Math.min(Math.floor(simulationTime / 0.1), frames.length - 1)
  const currentFrame = frames[frameIndex]

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

  return (
    <div className="flex-1 flex flex-col bg-gray-900/40 rounded-lg border border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-900/80">
        <div>
          <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wider">玩家路线预览</h3>
          <p className="text-xs text-gray-400">双击添加路点 · 拖动调整位置</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              actions.setSimulationTime(0)
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
          <span className="text-xs text-gray-400 font-mono">
            {simulationTime.toFixed(1)}s
          </span>
        </div>
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
    </div>
  )
}
