import React from 'react'
import { useEditor } from '../context/EditorContext'
import { SCENE_TYPE_CONFIG, TENSION_COLORS, TENSION_LABELS } from '../constants/config'
import type { TensionLevel } from '../types'

const Slider: React.FC<{
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}> = ({ label, value, min, max, step = 1, unit = '', onChange }) => (
  <div className="space-y-1">
    <div className="flex justify-between items-center">
      <label className="text-xs text-gray-300">{label}</label>
      <span className="text-xs text-purple-300 font-mono">{value}{unit}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full"
    />
  </div>
)

export const SceneNodeInspector: React.FC = () => {
  const { project, selectedSceneNodeId, actions } = useEditor()
  const node = project.sceneNodes.find(n => n.id === selectedSceneNodeId)

  if (!node) {
    return (
      <div className="p-4 bg-gray-900/60 rounded-lg border border-gray-700 h-full">
        <h3 className="text-sm font-semibold text-purple-300 mb-3 uppercase tracking-wider">属性面板</h3>
        <div className="text-sm text-gray-500 text-center py-12">
          <div className="text-4xl mb-3 opacity-30">🎬</div>
          选择时间轴上的节点以编辑属性
        </div>
      </div>
    )
  }

  const config = SCENE_TYPE_CONFIG[node.type]
  const tensionColor = TENSION_COLORS[node.tensionLevel]

  return (
    <div className="p-4 bg-gray-900/60 rounded-lg border border-gray-700 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wider">属性面板</h3>
        <button
          onClick={() => actions.removeSceneNode(node.id)}
          className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/30 transition-colors"
        >
          删除节点
        </button>
      </div>

      <div className={`p-3 rounded-md ${tensionColor.bg} border ${tensionColor.border} mb-4`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">{config.icon}</span>
          <input
            type="text"
            value={node.name}
            onChange={e => actions.updateSceneNode(node.id, { name: e.target.value })}
            className="flex-1 bg-transparent text-gray-100 font-medium text-sm outline-none border-b border-transparent focus:border-purple-500"
          />
        </div>
        <div className="text-xs text-gray-400">{config.description}</div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-300 block mb-2">情绪强度</label>
          <div className="grid grid-cols-3 gap-1">
            {(['safe', 'pressure', 'burst'] as TensionLevel[]).map(level => {
              const tc = TENSION_COLORS[level]
              const active = node.tensionLevel === level
              return (
                <button
                  key={level}
                  onClick={() => actions.updateSceneNode(node.id, { tensionLevel: level })}
                  className={`px-2 py-2 rounded text-xs font-medium transition-all ${active ? `${tc.bg} ${tc.border} border-2` : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200'}`}
                >
                  <div className={active ? tc.text : ''}>{TENSION_LABELS[level]}</div>
                </button>
              )
            })}
          </div>
        </div>

        <Slider
          label="持续时间"
          value={node.duration}
          min={2}
          max={60}
          unit="s"
          onChange={v => actions.updateSceneNode(node.id, { duration: v })}
        />

        <Slider
          label="怪物出现延迟"
          value={node.monsterSpawnDelay}
          min={0}
          max={node.duration}
          unit="s"
          onChange={v => actions.updateSceneNode(node.id, { monsterSpawnDelay: v })}
        />

        <Slider
          label="门锁开锁延迟"
          value={node.doorLockDelay}
          min={0}
          max={15}
          unit="s"
          onChange={v => actions.updateSceneNode(node.id, { doorLockDelay: v })}
        />

        <Slider
          label="灯光闪烁强度"
          value={Math.round(node.lightFlickerIntensity * 100)}
          min={0}
          max={100}
          unit="%"
          onChange={v => actions.updateSceneNode(node.id, { lightFlickerIntensity: v / 100 })}
        />

        <Slider
          label="喘息声强度"
          value={Math.round(node.breathIntensity * 100)}
          min={0}
          max={100}
          unit="%"
          onChange={v => actions.updateSceneNode(node.id, { breathIntensity: v / 100 })}
        />

        <div className="space-y-1">
          <label className="text-xs text-gray-300">导演笔记</label>
          <textarea
            value={node.notes}
            onChange={e => actions.updateSceneNode(node.id, { notes: e.target.value })}
            placeholder="记录这段的设计意图、剧情要点..."
            className="w-full h-24 bg-gray-800 border border-gray-700 rounded p-2 text-sm text-gray-200 resize-none outline-none focus:border-purple-500"
          />
        </div>
      </div>
    </div>
  )
}
