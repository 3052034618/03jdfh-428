import React from 'react'
import { SCENE_TYPE_CONFIG, TENSION_COLORS, TENSION_LABELS } from '../constants/config'
import type { SceneType, TensionLevel } from '../types'
import { useEditor } from '../context/EditorContext'

export const SceneNodePalette: React.FC = () => {
  const { actions } = useEditor()

  const handleDragStart = (e: React.DragEvent, type: SceneType) => {
    e.dataTransfer.setData('sceneType', type)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleClick = (type: SceneType) => {
    const config = SCENE_TYPE_CONFIG[type]
    actions.addSceneNode({
      type,
      name: config.label,
      duration: config.defaultDuration,
      startOffset: 0,
      tensionLevel: config.defaultTension,
      monsterSpawnDelay: Math.min(3, config.defaultDuration * 0.3),
      doorLockDelay: type === 'door' ? 3 : 0,
      lightFlickerIntensity: config.defaultTension === 'burst' ? 0.8 : config.defaultTension === 'pressure' ? 0.5 : 0.2,
      breathIntensity: config.defaultTension === 'burst' ? 0.9 : config.defaultTension === 'pressure' ? 0.6 : 0.3,
      notes: '',
    })
  }

  return (
    <div className="p-4 bg-gray-900/60 rounded-lg border border-gray-700">
      <h3 className="text-sm font-semibold text-purple-300 mb-3 uppercase tracking-wider">场景节点库</h3>
      <p className="text-xs text-gray-400 mb-3">拖拽或点击添加到时间轴</p>
      <div className="space-y-2">
        {(Object.keys(SCENE_TYPE_CONFIG) as SceneType[]).map(type => {
          const config = SCENE_TYPE_CONFIG[type]
          const tensionColor = TENSION_COLORS[config.defaultTension]
          return (
            <div
              key={type}
              draggable
              onDragStart={e => handleDragStart(e, type)}
              onClick={() => handleClick(type)}
              className={`p-3 rounded-md border cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-all ${tensionColor.bg} ${tensionColor.border} border-opacity-50`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{config.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-100">{config.label}</div>
                  <div className={`text-xs ${tensionColor.text}`}>
                    {TENSION_LABELS[config.defaultTension]}
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-1">{config.description}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
