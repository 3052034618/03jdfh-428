import React from 'react'
import { useEditor } from '../context/EditorContext'
import type { MapWaypoint } from '../types'

export const RoutePanel: React.FC = () => {
  const { project, selectedRouteId, routeIssues, actions } = useEditor()

  const selectedRoute = project.routes.find(r => r.id === selectedRouteId)
  const routeIssueMap: Record<string, typeof routeIssues> = {}
  routeIssues.forEach(issue => {
    if (!routeIssueMap[issue.routeId]) routeIssueMap[issue.routeId] = []
    routeIssueMap[issue.routeId].push(issue)
  })

  const addRoute = () => {
    const colors = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#ec4899']
    const color = colors[project.routes.length % colors.length]
    actions.addRoute({
      name: `路线${project.routes.length + 1}`,
      color,
      waypointIds: [],
      playerSpeed: 50,
      monsterSpeed: 45,
    })
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
        <div className="space-y-2">
          {project.routes.map(route => {
            const issues = routeIssueMap[route.id] ?? []
            const criticalCount = issues.filter(i => i.severity === 'critical').length
            const warningCount = issues.filter(i => i.severity === 'warning').length
            const isSelected = route.id === selectedRouteId

            return (
              <div
                key={route.id}
                onClick={() => actions.selectRoute(route.id)}
                className={`p-3 rounded-md border cursor-pointer transition-all ${isSelected ? 'bg-purple-900/40 border-purple-500' : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'}`}
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
                <div className="flex gap-3 text-xs text-gray-400">
                  <span>节点: {route.waypointIds.length}</span>
                  <span>玩家速度: {route.playerSpeed}</span>
                  <span>怪物速度: {route.monsterSpeed}</span>
                </div>

                {isSelected && (
                  <div className="mt-3 space-y-2 border-t border-gray-700 pt-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">包含节点（点击添加）</div>
                      <div className="flex flex-wrap gap-1">
                        {route.waypointIds.map((wid, idx) => {
                          const wp = project.waypoints.find(w => w.id === wid)
                          if (!wp) return null
                          return (
                            <span
                              key={wid}
                              onClick={e => {
                                e.stopPropagation()
                                removeWaypointFromRoute(route.id, wid)
                              }}
                              className="text-xs px-2 py-0.5 bg-gray-700 rounded cursor-pointer hover:bg-red-900/50"
                            >
                              {idx + 1}. {wp.label} ✕
                            </span>
                          )
                        })}
                        {route.waypointIds.length === 0 && (
                          <span className="text-xs text-gray-500">从下方列表点击添加节点</span>
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
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="p-4 bg-gray-900/60 rounded-lg border border-gray-700 flex-1 overflow-auto">
        <h3 className="text-sm font-semibold text-purple-300 mb-3 uppercase tracking-wider">路点列表</h3>
        <div className="space-y-1 mb-4">
          {project.waypoints.map(wp => {
            const inRoute = selectedRoute?.waypointIds.includes(wp.id)
            return (
              <div
                key={wp.id}
                className="flex items-center justify-between p-2 rounded bg-gray-800/50 hover:bg-gray-800"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {wp.isDeadEnd ? '🚫' : wp.isJunction ? '🔀' : '📍'}
                  </span>
                  <div>
                    <div className="text-sm text-gray-200">{wp.label}</div>
                    <div className="text-[10px] text-gray-500">
                      ({Math.round(wp.position.x)}, {Math.round(wp.position.y)})
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {selectedRoute && (
                    <button
                      onClick={() => inRoute ? removeWaypointFromRoute(selectedRoute.id, wp.id) : addWaypointToRoute(selectedRoute.id, wp.id)}
                      className={`text-xs px-2 py-0.5 rounded ${inRoute ? 'bg-green-900/50 text-green-300' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                      {inRoute ? '✓ 已加入' : '+ 加入'}
                    </button>
                  )}
                  <button
                    onClick={() => actions.removeWaypoint(wp.id)}
                    className="text-gray-500 hover:text-red-400 text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <h3 className="text-sm font-semibold text-purple-300 mb-2 uppercase tracking-wider">问题检测</h3>
        <div className="space-y-2">
          {(selectedRoute ? routeIssues.filter(i => i.routeId === selectedRoute.id) : routeIssues).map(issue => (
            <div
              key={issue.id}
              className={`p-2 rounded text-xs ${issue.severity === 'critical' ? 'bg-red-900/30 border border-red-800 text-red-200' : 'bg-amber-900/30 border border-amber-800 text-amber-200'}`}
            >
              <div className="font-medium mb-0.5">
                {issue.type === 'caught' ? '💀 过早追上' : issue.type === 'stuck' ? '🚫 卡死/死胡同' : '❓ 容易迷路'}
              </div>
              <div>{issue.description}</div>
            </div>
          ))}
          {(selectedRoute ? routeIssues.filter(i => i.routeId === selectedRoute.id) : routeIssues).length === 0 && (
            <div className="text-xs text-gray-500 p-2 bg-gray-800/30 rounded">
              点击"播放追逐"或"运行分析"检测问题
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
