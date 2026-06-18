import React, { useState } from 'react'
import { useEditor } from '../context/EditorContext'
import type { MapWaypoint } from '../types'

export const RoutePanel: React.FC = () => {
  const { project, selectedRouteId, routeIssues, actions, simulationResults } = useEditor()
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [editingWaypointId, setEditingWaypointId] = useState<string | null>(null)

  const selectedRoute = project.routes.find(r => r.id === selectedRouteId)
  const routeIssueMap: Record<string, typeof routeIssues> = {}
  routeIssues.forEach(issue => {
    if (!routeIssueMap[issue.routeId]) routeIssueMap[issue.routeId] = []
    routeIssueMap[issue.routeId].push(issue)
  })

  const addRoute = () => {
    const colors = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#ec4899']
    const color = colors[project.routes.length % colors.length]
    const newRoute = {
      name: `路线${project.routes.length + 1}`,
      color,
      waypointIds: [],
      playerSpeed: 50,
      monsterSpeed: 45,
    }
    actions.addRoute(newRoute)
  }

  const addWaypointToRoute = (routeId: string, wpId: string) => {
    const route = project.routes.find(r => r.id === routeId)
    if (!route) return
    if (route.waypointIds.includes(wpId)) return
    actions.updateRoute(routeId, { waypointIds: [...route.waypointIds, wpId] })
  }

  const removeWaypointFromRoute = (routeId: string, wpId: string) => {
    const route = project.routes.find(r => r.id === routeId)
    if (!route) return
    actions.updateRoute(routeId, { waypointIds: route.waypointIds.filter(id => id !== wpId) })
  }

  const moveWaypointInRoute = (fromIdx: number, toIdx: number) => {
    if (!selectedRouteId) return
    actions.reorderRouteWaypoint(selectedRouteId, fromIdx, toIdx)
  }

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIndex(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === targetIdx) {
      setDraggedIndex(null)
      return
    }
    moveWaypointInRoute(draggedIndex, targetIdx)
    setDraggedIndex(null)
  }

  const handleSimulateRoute = (routeId: string) => {
    actions.selectRoute(routeId)
    actions.simulateRoute(routeId)
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      <div className="p-4 bg-gray-900/60 rounded-lg border border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wider">逃跑路线</h3>
          <button
            onClick={addRoute}
            className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-500 rounded transition-colors"
          >
            + 新增路线
          </button>
        </div>
        <div className="space-y-2 max-h-[280px] overflow-y-auto">
          {project.routes.map(route => {
            const issues = routeIssueMap[route.id] ?? []
            const result = simulationResults[route.id]
            const criticalCount = issues.filter(i => i.severity === 'critical').length
            const warningCount = issues.filter(i => i.severity === 'warning').length
            const isSelected = route.id === selectedRouteId

            return (
              <div
                key={route.id}
                onClick={() => actions.selectRoute(route.id)}
                className={`p-3 rounded-md border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-purple-900/40 border-purple-500'
                    : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ background: route.color }} />
                  <input
                    type="text"
                    value={route.name}
                    onChange={e => {
                      e.stopPropagation()
                      actions.updateRoute(route.id, { name: e.target.value })
                    }}
                    onClick={e => e.stopPropagation()}
                    className="flex-1 bg-transparent text-sm font-medium text-gray-100 outline-none border-b border-transparent focus:border-purple-500"
                  />
                  {(criticalCount > 0 || warningCount > 0) && (
                    <div className="flex gap-1">
                      {criticalCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-900/60 text-red-300 rounded">
                          {criticalCount}严重
                        </span>
                      )}
                      {warningCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-900/60 text-amber-300 rounded">
                          {warningCount}警告
                        </span>
                      )}
                    </div>
                  )}
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      actions.removeRoute(route.id)
                    }}
                    className="text-gray-500 hover:text-red-400 text-xs"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex gap-3 text-xs text-gray-400 mb-2">
                  <span>节点: {route.waypointIds.length}</span>
                  <span>玩家: {route.playerSpeed}</span>
                  <span>怪物: {route.monsterSpeed}</span>
                  {result && (
                    <span className={result.success ? 'text-green-400' : 'text-red-400'}>
                      {result.success ? '✓ 可逃脱' : '✗ 被捕获'}
                    </span>
                  )}
                </div>

                {isSelected && (
                  <div className="mt-3 space-y-2 border-t border-gray-700 pt-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1 flex justify-between items-center">
                        <span>路点顺序（拖拽调整）</span>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            handleSimulateRoute(route.id)
                          }}
                          className="text-[10px] px-2 py-0.5 bg-purple-700 hover:bg-purple-600 rounded"
                        >
                          🔄 重算
                        </button>
                      </div>
                      <div className="space-y-1">
                        {route.waypointIds.map((wid, idx) => {
                          const wp = project.waypoints.find(w => w.id === wid)
                          if (!wp) return null
                          return (
                            <div
                              key={wid}
                              draggable
                              onDragStart={e => handleDragStart(e, idx)}
                              onDragOver={handleDragOver}
                              onDrop={e => handleDrop(e, idx)}
                              onClick={e => e.stopPropagation()}
                              className={`flex items-center gap-2 p-1.5 rounded text-xs cursor-move transition-all ${
                                draggedIndex === idx
                                  ? 'bg-purple-700/50 opacity-50'
                                  : 'bg-gray-700/50 hover:bg-gray-700'
                              }`}
                            >
                              <span className="text-gray-500 w-5 text-center">⋮⋮</span>
                              <span className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center text-[10px] font-bold">
                                {idx + 1}
                              </span>
                              <span className="text-xs flex-1">
                                {wp.isDeadEnd ? '🚫' : wp.isJunction ? '🔀' : '📍'} {wp.label}
                              </span>
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  removeWaypointFromRoute(route.id, wid)
                                }}
                                className="text-gray-400 hover:text-red-400 px-1"
                              >
                                ✕
                              </button>
                            </div>
                          )
                        })}
                        {route.waypointIds.length === 0 && (
                          <span className="text-xs text-gray-500 block py-2 text-center">
                            从下方列表点击添加节点，拖拽调整顺序
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-400">玩家速度</label>
                        <input
                          type="number"
                          value={route.playerSpeed}
                          onChange={e => {
                            e.stopPropagation()
                            actions.updateRoute(route.id, { playerSpeed: Number(e.target.value) })
                          }}
                          onClick={e => e.stopPropagation()}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
                          min={10}
                          max={100}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">怪物速度</label>
                        <input
                          type="number"
                          value={route.monsterSpeed}
                          onChange={e => {
                            e.stopPropagation()
                            actions.updateRoute(route.id, { monsterSpeed: Number(e.target.value) })
                          }}
                          onClick={e => e.stopPropagation()}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
                          min={10}
                          max={100}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="color"
                        value={route.color}
                        onChange={e => {
                          e.stopPropagation()
                          actions.updateRoute(route.id, { color: e.target.value })
                        }}
                        onClick={e => e.stopPropagation()}
                        className="w-full h-8 bg-gray-800 border border-gray-700 rounded cursor-pointer"
                      />
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          actions.setSimulationTime(0)
                          handleSimulateRoute(route.id)
                          actions.startSimulation()
                        }}
                        className="col-span-2 text-xs py-1.5 bg-purple-600 hover:bg-purple-500 rounded"
                      >
                        ▶ 播放此路线
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {project.routes.length === 0 && (
            <div className="text-center py-6 text-xs text-gray-500">
              点击"新增路线"创建第一条逃跑路线
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-gray-900/60 rounded-lg border border-gray-700 flex-1 overflow-auto">
        <h3 className="text-sm font-semibold text-purple-300 mb-3 uppercase tracking-wider">路点列表</h3>
        <div className="space-y-1 mb-4">
          {project.waypoints.map(wp => {
            const inRoute = selectedRoute?.waypointIds.includes(wp.id)
            const isEditing = editingWaypointId === wp.id

            return (
              <div
                key={wp.id}
                className={`p-2 rounded bg-gray-800/50 hover:bg-gray-800 ${isEditing ? 'ring-2 ring-purple-500' : ''}`}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={wp.label}
                      onChange={e => actions.updateWaypoint(wp.id, { label: e.target.value })}
                      className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => actions.toggleWaypointJunction(wp.id)}
                        className={`text-[10px] px-2 py-1 rounded ${wp.isJunction ? 'bg-amber-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                      >
                        🔀 岔路口 {wp.isJunction ? '✓' : ''}
                      </button>
                      <button
                        onClick={() => actions.toggleWaypointDeadEnd(wp.id)}
                        className={`text-[10px] px-2 py-1 rounded ${wp.isDeadEnd ? 'bg-red-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                      >
                        🚫 死胡同 {wp.isDeadEnd ? '✓' : ''}
                      </button>
                      <select
                        value={wp.difficulty}
                        onChange={e => actions.updateWaypoint(wp.id, { difficulty: e.target.value as any })}
                        className="text-[10px] px-2 py-1 rounded bg-gray-700 border-0"
                      >
                        <option value="easy">简单</option>
                        <option value="medium">中等</option>
                        <option value="hard">困难</option>
                      </select>
                      <button
                        onClick={() => setEditingWaypointId(null)}
                        className="text-[10px] px-2 py-1 rounded bg-green-700 hover:bg-green-600 ml-auto"
                      >
                        ✓ 完成
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {wp.isDeadEnd ? '🚫' : wp.isJunction ? '🔀' : '📍'}
                      </span>
                      <div>
                        <div className="text-sm text-gray-200">{wp.label}</div>
                        <div className="text-[10px] text-gray-500">
                          ({Math.round(wp.position.x)}, {Math.round(wp.position.y)})
                          <span className="ml-1 px-1 rounded bg-gray-700">
                            {wp.difficulty === 'easy' ? '简单' : wp.difficulty === 'medium' ? '中等' : '困难'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {selectedRoute && (
                        <button
                          onClick={() =>
                            inRoute
                              ? removeWaypointFromRoute(selectedRoute.id, wp.id)
                              : addWaypointToRoute(selectedRoute.id, wp.id)
                          }
                          className={`text-xs px-2 py-0.5 rounded ${
                            inRoute
                              ? 'bg-green-900/50 text-green-300'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {inRoute ? '✓ 已加入' : '+ 加入'}
                        </button>
                      )}
                      <button
                        onClick={() => setEditingWaypointId(isEditing ? null : wp.id)}
                        className="text-gray-400 hover:text-blue-400 text-xs px-1"
                        title="编辑路点"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => actions.removeWaypoint(wp.id)}
                        className="text-gray-500 hover:text-red-400 text-xs px-1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {project.waypoints.length === 0 && (
            <div className="text-center py-4 text-xs text-gray-500">
              双击小地图添加路点
            </div>
          )}
        </div>

        <h3 className="text-sm font-semibold text-purple-300 mb-2 uppercase tracking-wider">问题检测</h3>
        <div className="space-y-2">
          {(selectedRoute ? routeIssues.filter(i => i.routeId === selectedRoute.id) : routeIssues).map(issue => (
            <div
              key={issue.id}
              className={`p-2 rounded text-xs ${
                issue.severity === 'critical'
                  ? 'bg-red-900/30 border border-red-800 text-red-200'
                  : 'bg-amber-900/30 border border-amber-800 text-amber-200'
              }`}
            >
              <div className="font-medium mb-0.5">
                {issue.type === 'caught'
                  ? '💀 过早追上'
                  : issue.type === 'stuck'
                    ? '🚫 卡死/死胡同'
                    : '❓ 容易迷路'}
              </div>
              <div>{issue.description}</div>
            </div>
          ))}
          {(selectedRoute ? routeIssues.filter(i => i.routeId === selectedRoute.id) : routeIssues)
            .length === 0 && (
            <div className="text-xs text-gray-500 p-2 bg-gray-800/30 rounded">
              点击"播放追逐"或"运行分析"检测问题
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
