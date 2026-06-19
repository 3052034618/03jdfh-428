import React, { useState, useMemo } from 'react'
import { useEditor } from '../context/EditorContext'
import type { TimeSliceEvent, TimeSliceEventType } from '../types'

const eventIcons: Record<TimeSliceEventType, string> = {
  caught: '💀',
  stuck: '⚠️',
  lost: '❓',
  danger_close: '🔥',
  junction: '🔀',
  door_lock: '🔒',
  waypoint_reached: '📍',
}

const eventLabels: Record<TimeSliceEventType, string> = {
  caught: '被捕获',
  stuck: '卡死',
  lost: '迷路',
  danger_close: '危险接近',
  junction: '岔路点',
  door_lock: '门锁等待',
  waypoint_reached: '到达路点',
}

const severityColors: Record<string, string> = {
  critical: 'border-red-500 bg-red-900/20',
  warning: 'border-amber-500 bg-amber-900/20',
  info: 'border-blue-500 bg-blue-900/20',
}

const severityBadgeColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/50',
  warning: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
  info: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
}

export const TimeSlicePanel: React.FC = () => {
  const { selectedRouteId, simulationTime, project, actions } = useEditor()
  const [newNoteContent, setNewNoteContent] = useState('')
  const [quickNoteTemplate, setQuickNoteTemplate] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState(1.0)

  const events = useMemo(() => {
    if (!selectedRouteId) return []
    return actions.getEventsNearTime(selectedRouteId, simulationTime, timeRange)
  }, [selectedRouteId, simulationTime, timeRange, actions])

  const selectedRoute = project.routes.find(r => r.id === selectedRouteId)

  const handleQuickAddNote = (template: string) => {
    setQuickNoteTemplate(template)
    setNewNoteContent(template)
  }

  const handleAddNote = (event?: TimeSliceEvent) => {
    if (!selectedRouteId) return

    let content = newNoteContent.trim()
    if (!content && event) {
      content = `${eventLabels[event.type]}: ${event.description}`
    }
    if (!content) {
      alert('请输入批注内容')
      return
    }

    actions.addDirectorNote({
      time: simulationTime,
      routeId: selectedRouteId,
      content,
      eventId: event?.id,
      eventType: event?.type,
    })

    setNewNoteContent('')
    setQuickNoteTemplate(null)
  }

  const handleJumpToEvent = (event: TimeSliceEvent) => {
    actions.setSimulationTimeDirect(event.time)
  }

  const quickTemplates = [
    '这里节奏很好',
    '需要更紧张一点',
    '门锁等待太长',
    '容易迷路',
    '怪物速度过快',
    '喘息时间不足',
  ]

  if (!selectedRouteId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        请先选择一条路线
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
      <div className="p-3 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
            ⏱️ 时间切片复盘
          </h3>
          <span className="px-2 py-0.5 bg-purple-900/50 rounded text-xs text-purple-300 font-mono">
            {simulationTime.toFixed(1)}s
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">范围:</span>
          <select
            value={timeRange}
            onChange={e => setTimeRange(parseFloat(e.target.value))}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 outline-none focus:border-purple-500"
          >
            <option value={0.5}>±0.5s</option>
            <option value={1.0}>±1.0s</option>
            <option value={2.0}>±2.0s</option>
            <option value={5.0}>±5.0s</option>
          </select>
          <span className="text-xs text-gray-500 ml-auto">
            {selectedRoute?.name}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div>
          <div className="text-xs text-gray-500 mb-2 flex items-center justify-between">
            <span>当前时刻附近事件 ({events.length})</span>
            {events.length > 0 && (
              <button
                onClick={() => {
                  if (events.length > 0) {
                    actions.setSimulationTimeDirect(events[0].time)
                  }
                }}
                className="text-purple-400 hover:text-purple-300 text-xs"
              >
                ← 跳最早
              </button>
            )}
          </div>

          {events.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              <div className="text-2xl mb-2">🎯</div>
              当前范围内没有事件
            </div>
          ) : (
            <div className="space-y-2">
              {events.map(event => (
                <div
                  key={event.id}
                  className={`p-3 rounded-lg border-l-4 ${severityColors[event.severity]} hover:bg-gray-800/50 transition-colors cursor-pointer group`}
                  onClick={() => handleJumpToEvent(event)}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{eventIcons[event.type]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-purple-400">
                          {event.time.toFixed(1)}s
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] border ${severityBadgeColors[event.severity]}`}>
                          {eventLabels[event.type]}
                        </span>
                        {Math.abs(event.time - simulationTime) < 0.2 && (
                          <span className="px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded text-[10px]">
                            当前
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-300 mt-1">
                        {event.description}
                      </div>
                      {event.distance !== undefined && (
                        <div className="text-xs text-gray-500 mt-1">
                          距离: {event.distance.toFixed(1)} 单位
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddNote(event)
                      }}
                      className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-purple-600 hover:bg-purple-500 rounded text-xs text-white transition-opacity"
                    >
                      📝 打标
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-700 pt-3">
          <div className="text-xs text-gray-500 mb-2">
            快速批注模板
          </div>
          <div className="flex flex-wrap gap-1 mb-3">
            {quickTemplates.map(template => (
              <button
                key={template}
                onClick={() => handleQuickAddNote(template)}
                className={`px-2 py-1 rounded text-xs border transition-colors ${
                  quickNoteTemplate === template
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                }`}
              >
                {template}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <textarea
              value={newNoteContent}
              onChange={e => setNewNoteContent(e.target.value)}
              placeholder={`在 ${simulationTime.toFixed(1)}s 处添加导演批注...`}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-purple-500 resize-none h-20"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleAddNote()}
                disabled={!newNoteContent.trim()}
                className="flex-1 px-3 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium text-white transition-all"
              >
                📝 保存为导演批注
              </button>
              <button
                onClick={() => {
                  setNewNoteContent('')
                  setQuickNoteTemplate(null)
                }}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors"
              >
                清空
              </button>
            </div>
          </div>
        </div>

        {project.directorNotes.length > 0 && (
          <div className="border-t border-gray-700 pt-3">
            <div className="text-xs text-gray-500 mb-2 flex items-center justify-between">
              <span>📝 导演批注 ({project.directorNotes.length})</span>
              <span className="text-[10px] text-gray-600">点击跳转到对应时刻</span>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {[...project.directorNotes]
                .sort((a, b) => a.time - b.time)
                .filter(n => !selectedRouteId || n.routeId === selectedRouteId)
                .map(note => {
                  const noteRoute = project.routes.find(r => r.id === note.routeId)
                  return (
                    <div
                      key={note.id}
                      className="p-2 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-purple-500/50 cursor-pointer transition-colors group"
                      onClick={() => actions.jumpToNoteTime(note)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0">
                          {note.eventType && (
                            <span className="text-sm">{eventIcons[note.eventType]}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-purple-400">
                              {note.time.toFixed(1)}s
                            </span>
                            {noteRoute && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: `${noteRoute.color}20`, color: noteRoute.color }}
                              >
                                {noteRoute.name}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-300 mt-1 break-words">
                            {note.content}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm('确定删除这条批注吗？')) {
                              actions.deleteDirectorNote(note.id)
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 px-2 py-0.5 bg-red-600/20 hover:bg-red-600/40 rounded text-xs text-red-400 transition-all"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
