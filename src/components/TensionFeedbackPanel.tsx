import React from 'react'
import { useEditor } from '../context/EditorContext'
import { TENSION_LABELS, TENSION_COLORS } from '../constants/config'
import type { TensionCurvePoint, TensionFeedback } from '../types'

const VERSION_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899']

const calculateStats = (curve: TensionCurvePoint[]) => {
  if (curve.length === 0) return null
  const values = curve.map(p => p.value)
  const peak = Math.max(...values)
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const low = Math.min(...values)
  const peakCount = values.filter(v => v >= 71).length
  const safeCount = values.filter(v => v <= 35).length
  const totalTime = curve[curve.length - 1].time - curve[0].time
  const peakDensity = totalTime > 0 ? (peakCount * 0.5 / totalTime) * 60 : 0

  return { peak, avg, low, peakCount, safeCount, totalTime, peakDensity }
}

export const TensionFeedbackPanel: React.FC = () => {
  const { tensionFeedback, tensionCurve, project, selectedCurveVersionIds, showAllVersions } = useEditor()
  const [activeVersionId, setActiveVersionId] = React.useState<string | null>(null)

  const selectedVersions = React.useMemo(() => {
    if (showAllVersions) {
      return project.tensionCurveVersions
    }
    return project.tensionCurveVersions.filter(v => selectedCurveVersionIds.includes(v.id))
  }, [project.tensionCurveVersions, selectedCurveVersionIds, showAllVersions])

  const activeVersion = React.useMemo(() => {
    if (activeVersionId) {
      return project.tensionCurveVersions.find(v => v.id === activeVersionId)
    }
    if (selectedVersions.length > 0) {
      return selectedVersions[selectedVersions.length - 1]
    }
    return null
  }, [activeVersionId, project.tensionCurveVersions, selectedVersions])

  const displayCurve = activeVersion ? activeVersion.curve : tensionCurve
  const displayFeedback = activeVersion ? activeVersion.feedback : tensionFeedback

  const stats = React.useMemo(() => calculateStats(displayCurve), [displayCurve])

  const goodFeedback = displayFeedback.find(f => f.type === 'good')

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      {selectedVersions.length > 0 && (
        <div className="p-3 bg-gray-900/60 rounded-lg border border-gray-700 flex-shrink-0">
          <h3 className="text-xs font-semibold text-purple-300 mb-2 uppercase tracking-wider">版本对比</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveVersionId(null)}
              className={`px-3 py-1.5 text-xs rounded border transition-all ${
                activeVersionId === null
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'
              }`}
            >
              ⚡ 当前编辑
            </button>
            {selectedVersions.map((v, idx) => (
              <button
                key={v.id}
                onClick={() => setActiveVersionId(v.id)}
                className={`px-3 py-1.5 text-xs rounded border transition-all flex items-center gap-1.5 ${
                  activeVersionId === v.id
                    ? 'bg-gray-700 border-gray-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: VERSION_COLORS[idx % VERSION_COLORS.length] }}
                />
                <span className="max-w-20 truncate">{v.name}</span>
              </button>
            ))}
          </div>
          {activeVersion && (
            <div className="mt-2 p-2 bg-gray-800/50 rounded text-xs">
              <div className="text-gray-400">
                <span className="text-gray-500">保存时间:</span> {formatTime(activeVersion.createdAt)}
              </div>
              {activeVersion.description && (
                <div className="text-gray-400 mt-1">
                  <span className="text-gray-500">备注:</span> {activeVersion.description}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {selectedVersions.length >= 2 && (
        <div className="p-3 bg-gray-900/60 rounded-lg border border-gray-700 flex-shrink-0">
          <h3 className="text-xs font-semibold text-purple-300 mb-2 uppercase tracking-wider">版本差异</h3>
          <div className="space-y-2 text-xs">
            {selectedVersions.map((v, idx) => {
              const s = calculateStats(v.curve)
              if (!s) return null
              const color = VERSION_COLORS[idx % VERSION_COLORS.length]
              return (
                <div key={v.id} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="w-16 truncate text-gray-300">{v.name}</span>
                  <span className="text-red-400 font-mono">↑{s.peak}</span>
                  <span className="text-purple-400 font-mono">≈{Math.round(s.avg)}</span>
                  <span className="text-green-400 font-mono">↓{s.low}</span>
                  <span className="text-amber-400 font-mono">⚡{s.peakDensity.toFixed(1)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="p-4 bg-gray-900/60 rounded-lg border border-gray-700 flex-shrink-0">
        <h3 className="text-sm font-semibold text-purple-300 mb-3 uppercase tracking-wider">
          节奏统计 {activeVersion && <span className="text-gray-500 font-normal text-xs">· {activeVersion.name}</span>}
        </h3>
        {stats ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-red-900/20 rounded border border-red-900/40">
              <div className="text-xs text-red-300 mb-1">恐惧峰值</div>
              <div className="text-2xl font-bold text-red-400">{stats.peak}</div>
              <div className="text-[10px] text-gray-500">共 {stats.peakCount} 个高点</div>
            </div>
            <div className="p-3 bg-purple-900/20 rounded border border-purple-900/40">
              <div className="text-xs text-purple-300 mb-1">平均紧张度</div>
              <div className="text-2xl font-bold text-purple-400">{Math.round(stats.avg)}</div>
              <div className="text-[10px] text-gray-500">基准 40-60 为佳</div>
            </div>
            <div className="p-3 bg-green-900/20 rounded border border-green-900/40">
              <div className="text-xs text-green-300 mb-1">最低喘息</div>
              <div className="text-2xl font-bold text-green-400">{stats.low}</div>
              <div className="text-[10px] text-gray-500">安全点 {stats.safeCount} 个</div>
            </div>
            <div className="p-3 bg-amber-900/20 rounded border border-amber-900/40">
              <div className="text-xs text-amber-300 mb-1">峰值密度</div>
              <div className="text-2xl font-bold text-amber-400">{stats.peakDensity.toFixed(1)}</div>
              <div className="text-[10px] text-gray-500">次/分钟，建议 {'<'} 4</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-4">点击"运行分析"查看统计</div>
        )}
      </div>

      <div className="p-4 bg-gray-900/60 rounded-lg border border-gray-700 flex-shrink-0">
        <h3 className="text-sm font-semibold text-purple-300 mb-3 uppercase tracking-wider">情绪分布</h3>
        {project.sceneNodes.length > 0 ? (
          <div className="space-y-2">
            {(['safe', 'pressure', 'burst'] as const).map(level => {
              const nodes = project.sceneNodes.filter(n => n.tensionLevel === level)
              const totalDuration = project.sceneNodes.reduce((s, n) => s + n.duration, 0)
              const duration = nodes.reduce((s, n) => s + n.duration, 0)
              const percent = totalDuration > 0 ? (duration / totalDuration) * 100 : 0
              const tc = TENSION_COLORS[level]

              return (
                <div key={level}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={tc.text}>{TENSION_LABELS[level]}</span>
                    <span className="text-gray-400">{duration}s ({percent.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${tc.bgLight}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-2">暂无场景节点</div>
        )}
      </div>

      <div className="p-4 bg-gray-900/60 rounded-lg border border-gray-700 flex-1 overflow-auto">
        <h3 className="text-sm font-semibold text-purple-300 mb-3 uppercase tracking-wider">导演反馈</h3>
        {goodFeedback ? (
          <div className="p-3 bg-green-900/30 border border-green-800 rounded-md">
            <div className="flex items-start gap-2">
              <span className="text-lg">✨</span>
              <div>
                <div className="text-sm font-medium text-green-300">{goodFeedback.message}</div>
                <div className="text-xs text-green-400/80 mt-1">{goodFeedback.suggestion}</div>
              </div>
            </div>
          </div>
        ) : displayFeedback.length > 0 ? (
          <div className="space-y-2">
            {displayFeedback.map(fb => (
              <div
                key={fb.id}
                className={`p-3 rounded-md border ${
                  fb.severity === 'critical'
                    ? 'bg-red-900/30 border-red-800'
                    : 'bg-amber-900/30 border-amber-800'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">
                    {fb.type === 'peak_density' ? '⚡' : fb.type === 'recovery_insufficient' ? '🫁' : '📉'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${
                      fb.severity === 'critical' ? 'text-red-300' : 'text-amber-300'
                    }`}>
                      {fb.message}
                    </div>
                    <div className={`text-xs mt-1 ${
                      fb.severity === 'critical' ? 'text-red-400/80' : 'text-amber-400/80'
                    }`}>
                      💡 {fb.suggestion}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">
                      时间位置: {fb.startTime.toFixed(1)}s - {fb.endTime.toFixed(1)}s
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-8">
            <div className="text-4xl mb-2 opacity-30">📈</div>
            点击上方"运行分析"按钮<br />
            获取紧张曲线的节奏反馈
          </div>
        )}
      </div>
    </div>
  )
}
