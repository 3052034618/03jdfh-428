import React, { useRef, useState, useEffect } from 'react'
import type { SceneNode } from '../types'
import { useEditor } from '../context/EditorContext'
import { SCENE_TYPE_CONFIG, TENSION_COLORS, TENSION_LABELS, PX_PER_SECOND, TIMELINE_HEIGHT } from '../constants/config'

interface TimelineSceneNodeProps {
  node: SceneNode
  isSelected: boolean
}

const TimelineSceneNode: React.FC<TimelineSceneNodeProps> = ({ node, isSelected }) => {
  const { actions } = useEditor()
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const nodeRef = useRef<HTMLDivElement>(null)
  const dragStartX = useRef(0)
  const dragStartOffset = useRef(0)
  const resizeStartX = useRef(0)
  const resizeStartDuration = useRef(0)

  const config = SCENE_TYPE_CONFIG[node.type]
  const tensionColor = TENSION_COLORS[node.tensionLevel]
  const width = node.duration * PX_PER_SECOND
  const left = node.startOffset * PX_PER_SECOND

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const delta = (e.clientX - dragStartX.current) / PX_PER_SECOND
        actions.moveSceneNode(node.id, dragStartOffset.current + delta)
      }
      if (isResizing) {
        const delta = (e.clientX - resizeStartX.current) / PX_PER_SECOND
        const newDuration = Math.max(2, resizeStartDuration.current + delta)
        actions.updateSceneNode(node.id, { duration: Math.round(newDuration) })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
    }

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isResizing, node.id, actions])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    actions.selectSceneNode(node.id)
    setIsDragging(true)
    dragStartX.current = e.clientX
    dragStartOffset.current = node.startOffset
  }

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsResizing(true)
    resizeStartX.current = e.clientX
    resizeStartDuration.current = node.duration
  }

  const monsterMarkerLeft = (node.monsterSpawnDelay / node.duration) * 100

  return (
    <div
      ref={nodeRef}
      className={`absolute top-2 rounded-md cursor-move transition-shadow ${tensionColor.bg} ${tensionColor.border} border-2 ${isSelected ? 'ring-2 ring-purple-400 shadow-lg shadow-purple-500/30' : ''} ${isDragging ? 'opacity-80 z-20' : 'z-10'}`}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        height: `${TIMELINE_HEIGHT - 16}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className={`bg-gradient-to-r ${tensionColor.gradient} rounded-t px-2 py-1 border-b ${tensionColor.border}`}>
        <div className="flex items-center gap-1 text-xs font-medium text-gray-100 truncate">
          <span>{config.icon}</span>
          <span className="truncate">{node.name}</span>
        </div>
      </div>
      <div className="px-2 py-1 space-y-0.5">
        <div className="text-[10px] text-gray-300">
          {TENSION_LABELS[node.tensionLevel]} · {node.duration}s
        </div>
        {node.monsterSpawnDelay > 0 && node.monsterSpawnDelay < node.duration && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500/80"
            style={{ left: `${monsterMarkerLeft}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] bg-red-600 text-white px-1 rounded whitespace-nowrap">
              怪物
            </div>
          </div>
        )}
        {node.doorLockDelay > 0 && (
          <div className="text-[9px] text-amber-300">🔒 开锁 {node.doorLockDelay}s</div>
        )}
        {node.lightFlickerIntensity > 0.3 && (
          <div className="text-[9px] text-yellow-300">💡 闪烁 {Math.round(node.lightFlickerIntensity * 100)}%</div>
        )}
      </div>
      <div
        className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-r"
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  )
}

export const TimelineEditor: React.FC = () => {
  const { project, selectedSceneNodeId, actions } = useEditor()
  const containerRef = useRef<HTMLDivElement>(null)
  const [totalDuration, setTotalDuration] = useState(100)

  useEffect(() => {
    const maxEnd = Math.max(
      60,
      ...project.sceneNodes.map(n => n.startOffset + n.duration + 10)
    )
    setTotalDuration(Math.ceil(maxEnd / 10) * 10)
  }, [project.sceneNodes])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const sceneType = e.dataTransfer.getData('sceneType') as keyof typeof SCENE_TYPE_CONFIG
    if (!sceneType || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const startTime = Math.max(0, Math.floor(x / PX_PER_SECOND / 5) * 5)
    const config = SCENE_TYPE_CONFIG[sceneType]

    actions.addSceneNode({
      type: sceneType,
      name: config.label,
      duration: config.defaultDuration,
      startOffset: startTime,
      tensionLevel: config.defaultTension,
      monsterSpawnDelay: Math.min(3, config.defaultDuration * 0.3),
      doorLockDelay: sceneType === 'door' ? 3 : 0,
      lightFlickerIntensity: config.defaultTension === 'burst' ? 0.8 : config.defaultTension === 'pressure' ? 0.5 : 0.2,
      breathIntensity: config.defaultTension === 'burst' ? 0.9 : config.defaultTension === 'pressure' ? 0.6 : 0.3,
      notes: '',
    })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleBackgroundClick = () => {
    actions.selectSceneNode(null)
  }

  const timeMarkers = []
  for (let t = 0; t <= totalDuration; t += 5) {
    timeMarkers.push(t)
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900/40 rounded-lg border border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-900/80">
        <div>
          <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wider">时间轴编排</h3>
          <p className="text-xs text-gray-400">拖拽节点到时间轴 · 拖动边缘调整时长</p>
        </div>
        <div className="flex gap-4 text-xs">
          {(['safe', 'pressure', 'burst'] as const).map(level => (
            <div key={level} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${TENSION_COLORS[level].bg} border ${TENSION_COLORS[level].border}`} />
              <span className={TENSION_COLORS[level].text}>{TENSION_LABELS[level]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-auto flex-1">
        <div
          ref={containerRef}
          className="relative min-w-full p-4"
          style={{ width: `${totalDuration * PX_PER_SECOND + 100}px` }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={handleBackgroundClick}
        >
          <div className="relative h-8 border-b border-gray-600">
            {timeMarkers.map(t => (
              <div
                key={t}
                className="absolute top-0 bottom-0 flex flex-col items-center"
                style={{ left: `${t * PX_PER_SECOND}px` }}
              >
                <div className="w-px h-3 bg-gray-600" />
                <span className="text-[10px] text-gray-500">{t}s</span>
              </div>
            ))}
          </div>

          <div
            className="relative mt-2"
            style={{ height: `${TIMELINE_HEIGHT}px`, width: `${totalDuration * PX_PER_SECOND}px` }}
          >
            <div className="absolute inset-0 bg-gray-800/30 rounded-md">
              {timeMarkers.map(t => (
                <div
                  key={t}
                  className="absolute top-0 bottom-0 w-px bg-gray-700/50"
                  style={{ left: `${t * PX_PER_SECOND}px` }}
                />
              ))}
            </div>

            {project.sceneNodes
              .sort((a, b) => a.startOffset - b.startOffset)
              .map(node => (
                <TimelineSceneNode
                  key={node.id}
                  node={node}
                  isSelected={selectedSceneNodeId === node.id}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
