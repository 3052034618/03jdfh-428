import React, { useMemo, useState } from 'react'
import { useEditor } from '../context/EditorContext'
import {
  TENSION_MAX,
  TENSION_SAFE_MAX,
  TENSION_PRESSURE_MAX,
  TENSION_BURST_MIN,
  TENSION_COLORS,
  TENSION_LABELS,
  PX_PER_SECOND,
} from '../constants/config'
import type { TensionLevel, TensionCurveVersion, TensionVersionDiff } from '../types'

const CHART_HEIGHT = 320
const PADDING = { top: 20, right: 20, bottom: 40, left: 50 }

const VERSION_COLORS = [
  '#a855f7',
  '#06b6d4',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
]

export const TensionCurveChart: React.FC = () => {
  const {
    tensionCurve,
    tensionFeedback,
    project,
    actions,
    simulationTime,
    isSimulating,
    selectedCurveVersionIds,
    showAllVersions,
  } = useEditor()
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [versionName, setVersionName] = useState('')
  const [versionDesc, setVersionDesc] = useState('')
  const [diffMode, setDiffMode] = useState(false)
  const [diffBaseId, setDiffBaseId] = useState<string>('')
  const [diffTargetId, setDiffTargetId] = useState<string>('')

  const versionDiff = useMemo((): TensionVersionDiff | null => {
    if (!diffMode || !diffBaseId || !diffTargetId) return null
    return actions.calculateVersionDiff(diffBaseId, diffTargetId)
  }, [diffMode, diffBaseId, diffTargetId, actions])

  const selectedVersions = showAllVersions
    ? project.tensionCurveVersions
    : project.tensionCurveVersions.filter(v => selectedCurveVersionIds.includes(v.id))

  const allCurves = [tensionCurve, ...selectedVersions.map(v => v.curve)]

  const totalDuration = useMemo(() => {
    const allPoints = allCurves.flat()
    if (allPoints.length === 0) return 100
    const maxTime = Math.max(...allPoints.map(p => p.time))
    return Math.ceil(maxTime / 10) * 10
  }, [allCurves])

  const chartWidth = Math.max(800, totalDuration * PX_PER_SECOND)
  const innerWidth = chartWidth - PADDING.left - PADDING.right
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom

  const timeToX = (t: number) => PADDING.left + (t / totalDuration) * innerWidth
  const valueToY = (v: number) => PADDING.top + innerHeight - (v / TENSION_MAX) * innerHeight

  const buildPath = (curve: typeof tensionCurve) => {
    if (curve.length < 2) return ''
    return curve
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${timeToX(p.time)} ${valueToY(p.value)}`)
      .join(' ')
  }

  const currentPathD = useMemo(() => buildPath(tensionCurve), [tensionCurve, totalDuration])

  const sceneNodeRanges = useMemo(() => {
    return project.sceneNodes.map(node => ({
      node,
      x1: timeToX(node.startOffset),
      x2: timeToX(node.startOffset + node.duration),
    }))
  }, [project.sceneNodes, totalDuration])

  const timeMarkers = []
  for (let t = 0; t <= totalDuration; t += 5) {
    timeMarkers.push(t)
  }

  const selectedTension = tensionCurve.find(p => Math.abs(p.time - simulationTime) < 0.3)

  const handleSaveVersion = () => {
    if (!versionName.trim()) return
    actions.saveTensionCurveVersion(versionName.trim(), versionDesc.trim())
    setShowSaveDialog(false)
    setVersionName('')
    setVersionDesc('')
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900/40 rounded-lg border border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-900/80">
        <div>
          <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wider">紧张曲线</h3>
          <p className="text-xs text-gray-400">可视化恐惧节奏，保存多版本对比</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => actions.runFullAnalysis()}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-xs font-medium transition-colors"
          >
            📊 运行分析
          </button>
          <button
            onClick={() => {
              setVersionName(`版本 ${project.tensionCurveVersions.length + 1}`)
              setVersionDesc('')
              setShowSaveDialog(true)
            }}
            disabled={tensionCurve.length === 0}
            className="px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 rounded text-xs font-medium transition-colors"
          >
            💾 保存版本
          </button>
          <div className="w-px h-5 bg-gray-600 mx-1" />
          <button
            onClick={() => {
              setDiffMode(!diffMode)
              if (!diffMode && project.tensionCurveVersions.length >= 2) {
                setDiffBaseId(project.tensionCurveVersions[0].id)
                setDiffTargetId(project.tensionCurveVersions[1].id)
              }
            }}
            disabled={project.tensionCurveVersions.length < 2}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              diffMode
                ? 'bg-cyan-700 hover:bg-cyan-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:bg-gray-800 disabled:text-gray-600'
            }`}
          >
            📊 {diffMode ? '关闭差异' : '版本差异对比'}
          </button>
          {diffMode && (
            <>
              <select
                value={diffBaseId}
                onChange={e => setDiffBaseId(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-300 outline-none focus:border-cyan-500"
              >
                {project.tensionCurveVersions.map(v => (
                  <option key={v.id} value={v.id}>基础: {v.name}</option>
                ))}
              </select>
              <span className="text-gray-500">→</span>
              <select
                value={diffTargetId}
                onChange={e => setDiffTargetId(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-300 outline-none focus:border-cyan-500"
              >
                {project.tensionCurveVersions.map(v => (
                  <option key={v.id} value={v.id}>对比: {v.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {project.tensionCurveVersions.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-700 bg-gray-900/50">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input
                type="checkbox"
                checked={showAllVersions}
                onChange={e => actions.setShowAllVersions(e.target.checked)}
                className="rounded bg-gray-800 border-gray-600"
              />
              显示全部版本
            </label>
            <div className="flex-1 flex flex-wrap gap-2">
              {project.tensionCurveVersions.map((v, idx) => {
                const color = VERSION_COLORS[idx % VERSION_COLORS.length]
                const selected = showAllVersions || selectedCurveVersionIds.includes(v.id)
                return (
                  <div
                    key={v.id}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-all ${
                      selected ? 'bg-gray-800' : 'bg-gray-800/40 opacity-60'
                    }`}
                    onClick={() => !showAllVersions && actions.toggleCurveVersion(v.id)}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: selected ? color : '#6b7280' }}
                    />
                    <span className={selected ? 'text-gray-200' : 'text-gray-500'}>{v.name}</span>
                    <span className="text-gray-500 text-[10px]">{formatDate(v.createdAt)}</span>
                    {!showAllVersions && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          actions.deleteTensionCurveVersion(v.id)
                        }}
                        className="text-gray-500 hover:text-red-400 ml-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {showSaveDialog && (
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/80">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={versionName}
              onChange={e => setVersionName(e.target.value)}
              placeholder="版本名称（如：增加门锁延迟后）"
              className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm outline-none focus:border-purple-500"
              autoFocus
            />
            <input
              type="text"
              value={versionDesc}
              onChange={e => setVersionDesc(e.target.value)}
              placeholder="描述（可选）"
              className="w-48 bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm outline-none focus:border-purple-500"
            />
            <button
              onClick={handleSaveVersion}
              disabled={!versionName.trim()}
              className="px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-xs font-medium"
            >
              确认保存
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="overflow-auto flex-1">
        <div className="p-4" style={{ minWidth: chartWidth + 20 }}>
          <div className="flex items-center gap-4 mb-3 text-xs flex-wrap">
            {(['safe', 'pressure', 'burst'] as TensionLevel[]).map(level => (
              <div key={level} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded ${TENSION_COLORS[level].bg} border ${TENSION_COLORS[level].border}`} />
                <span className={TENSION_COLORS[level].text}>
                  {TENSION_LABELS[level]} ({level === 'safe' ? `<${TENSION_SAFE_MAX}` : level === 'pressure' ? `${TENSION_BURST_MIN - 1}-${TENSION_PRESSURE_MAX}` : `>${TENSION_BURST_MIN - 1}`})
                </span>
              </div>
            ))}
            {selectedVersions.length > 0 && (
              <>
                <div className="w-px h-4 bg-gray-600" />
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-purple-500" style={{ height: '3px' }} />
                  <span className="text-purple-300">当前</span>
                </div>
                {selectedVersions.map((v, idx) => (
                  <div key={v.id} className="flex items-center gap-1.5">
                    <div
                      className="w-3"
                      style={{ height: '3px', background: VERSION_COLORS[idx % VERSION_COLORS.length] }}
                    />
                    <span style={{ color: VERSION_COLORS[idx % VERSION_COLORS.length] }}>{v.name}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          <svg
            width={chartWidth}
            height={CHART_HEIGHT}
            className="overflow-visible"
          >
            <defs>
              <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#dc2626" stopOpacity="0.6" />
                <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#16a34a" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            <rect
              x={PADDING.left}
              y={PADDING.top}
              width={innerWidth}
              height={valueToY(TENSION_SAFE_MAX) - PADDING.top}
              fill="#166534"
              opacity={0.1}
            />
            <rect
              x={PADDING.left}
              y={valueToY(TENSION_SAFE_MAX)}
              width={innerWidth}
              height={valueToY(TENSION_BURST_MIN - 1) - valueToY(TENSION_SAFE_MAX)}
              fill="#92400e"
              opacity={0.1}
            />
            <rect
              x={PADDING.left}
              y={valueToY(TENSION_BURST_MIN - 1)}
              width={innerWidth}
              height={PADDING.top + innerHeight - valueToY(TENSION_BURST_MIN - 1)}
              fill="#7f1d1d"
              opacity={0.15}
            />

            {sceneNodeRanges.map(({ node, x1, x2 }) => {
              const tc = TENSION_COLORS[node.tensionLevel]
              return (
                <g key={node.id}>
                  <rect
                    x={x1}
                    y={PADDING.top - 18}
                    width={x2 - x1}
                    height={14}
                    fill={node.tensionLevel === 'safe' ? '#166534' : node.tensionLevel === 'pressure' ? '#92400e' : '#7f1d1d'}
                    opacity={0.5}
                    rx={2}
                  />
                  <text
                    x={(x1 + x2) / 2}
                    y={PADDING.top - 8}
                    textAnchor="middle"
                    fill={node.tensionLevel === 'safe' ? '#86efac' : node.tensionLevel === 'pressure' ? '#fcd34d' : '#fca5a5'}
                    fontSize="9"
                  >
                    {node.name}
                  </text>
                </g>
              )
            })}

            {timeMarkers.map(t => (
              <g key={t}>
                <line
                  x1={timeToX(t)}
                  y1={PADDING.top}
                  x2={timeToX(t)}
                  y2={PADDING.top + innerHeight}
                  stroke="#374151"
                  strokeWidth={1}
                  strokeDasharray="2 4"
                />
                <text
                  x={timeToX(t)}
                  y={PADDING.top + innerHeight + 18}
                  textAnchor="middle"
                  fill="#6b7280"
                  fontSize="10"
                >
                  {t}s
                </text>
              </g>
            ))}

            {[0, 25, 50, 75, 100].map(v => (
              <g key={v}>
                <line
                  x1={PADDING.left}
                  y1={valueToY(v)}
                  x2={PADDING.left + innerWidth}
                  y2={valueToY(v)}
                  stroke="#374151"
                  strokeWidth={0.5}
                />
                <text
                  x={PADDING.left - 8}
                  y={valueToY(v) + 3}
                  textAnchor="end"
                  fill="#6b7280"
                  fontSize="10"
                >
                  {v}
                </text>
              </g>
            ))}

            {selectedVersions.map((v, idx) => {
              const path = buildPath(v.curve)
              const color = VERSION_COLORS[idx % VERSION_COLORS.length]
              return (
                <g key={v.id}>
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={0.7}
                  />
                  {v.curve.filter(p => p.value >= TENSION_BURST_MIN).map(p => (
                    <circle
                      key={`${v.id}-peak-${p.time}`}
                      cx={timeToX(p.time)}
                      cy={valueToY(p.value)}
                      r={2.5}
                      fill={color}
                      opacity={0.8}
                    />
                  ))}
                </g>
              )
            })}

            {tensionCurve.length >= 2 && (
              <>
                <path
                  d={currentPathD}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </>
            )}

            {tensionCurve.filter(p => p.value >= TENSION_BURST_MIN).map(p => (
              <circle
                key={`peak-${p.time}`}
                cx={timeToX(p.time)}
                cy={valueToY(p.value)}
                r={4}
                fill="#ef4444"
                stroke="#fff"
                strokeWidth={1}
              />
            ))}

            {isSimulating && selectedTension && (
              <g>
                <line
                  x1={timeToX(simulationTime)}
                  y1={PADDING.top - 20}
                  x2={timeToX(simulationTime)}
                  y2={PADDING.top + innerHeight + 5}
                  stroke="#a78bfa"
                  strokeWidth={2}
                />
                <circle
                  cx={timeToX(simulationTime)}
                  cy={valueToY(selectedTension.value)}
                  r={7}
                  fill="#a78bfa"
                  stroke="#fff"
                  strokeWidth={2}
                />
                <rect
                  x={timeToX(simulationTime) - 35}
                  y={valueToY(selectedTension.value) - 30}
                  width={70}
                  height={22}
                  fill="#1e1b4b"
                  rx={4}
                />
                <text
                  x={timeToX(simulationTime)}
                  y={valueToY(selectedTension.value) - 15}
                  textAnchor="middle"
                  fill="#e9d5ff"
                  fontSize="11"
                  fontWeight="bold"
                >
                  {selectedTension.value}
                </text>
              </g>
            )}

            {tensionFeedback.filter(f => f.type !== 'good').map(fb => (
              <g key={fb.id}>
                <rect
                  x={timeToX(fb.startTime)}
                  y={PADDING.top - 5}
                  width={Math.max(10, timeToX(fb.endTime) - timeToX(fb.startTime))}
                  height={innerHeight + 10}
                  fill={fb.severity === 'critical' ? '#dc2626' : '#f59e0b'}
                  opacity={0.08}
                />
                <rect
                  x={timeToX(fb.startTime)}
                  y={PADDING.top - 5}
                  width={3}
                  height={innerHeight + 10}
                  fill={fb.severity === 'critical' ? '#dc2626' : '#f59e0b'}
                />
              </g>
            ))}

            <text
              x={PADDING.left - 35}
              y={PADDING.top + innerHeight / 2}
              textAnchor="middle"
              fill="#9ca3af"
              fontSize="11"
              transform={`rotate(-90, ${PADDING.left - 35}, ${PADDING.top + innerHeight / 2})`}
            >
              紧张值
            </text>
            <text
              x={PADDING.left + innerWidth / 2}
              y={CHART_HEIGHT - 5}
              textAnchor="middle"
              fill="#9ca3af"
              fontSize="11"
            >
              时间 (秒)
            </text>

            {versionDiff && versionDiff.significantChanges.map((change, idx) => (
              <g key={idx}>
                <line
                  x1={timeToX(change.time)}
                  y1={PADDING.top}
                  x2={timeToX(change.time)}
                  y2={PADDING.top + innerHeight}
                  stroke={change.valueDiff > 0 ? '#ef4444' : '#22c55e'}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  opacity={0.5}
                />
                <circle
                  cx={timeToX(change.time)}
                  cy={valueToY((change.baseValue + change.targetValue) / 2)}
                  r={8}
                  fill={change.valueDiff > 0 ? '#ef4444' : '#22c55e'}
                  opacity={0.8}
                />
                <rect
                  x={timeToX(change.time) - 25}
                  y={valueToY((change.baseValue + change.targetValue) / 2) - 18}
                  width={50}
                  height={16}
                  fill={change.valueDiff > 0 ? '#7f1d1d' : '#14532d'}
                  rx={3}
                />
                <text
                  x={timeToX(change.time)}
                  y={valueToY((change.baseValue + change.targetValue) / 2) - 7}
                  textAnchor="middle"
                  fill={change.valueDiff > 0 ? '#fca5a5' : '#86efac'}
                  fontSize="10"
                  fontWeight="bold"
                >
                  {change.valueDiff > 0 ? '+' : ''}{change.valueDiff}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {versionDiff && (
          <div className="border-t border-gray-700 bg-gray-900/60 p-4 flex-shrink-0">
            <h4 className="text-xs font-semibold text-cyan-300 mb-3 uppercase tracking-wider">
              📊 版本差异分析 · {versionDiff.baseName} → {versionDiff.targetName}
              <span className="text-gray-500 font-normal ml-2">
                （间隔 {versionDiff.timeDiff > 60 ? `${Math.floor(versionDiff.timeDiff / 60)}分${versionDiff.timeDiff % 60}秒` : `${versionDiff.timeDiff}秒`}）
              </span>
            </h4>
            <div className="grid grid-cols-6 gap-3 mb-4">
              <div className="bg-gray-800/60 rounded p-3 border border-gray-700">
                <div className="text-[10px] text-gray-500 mb-1">峰值变化</div>
                <div
                  className={`text-lg font-bold font-mono ${
                    versionDiff.peakValueChange > 0 ? 'text-red-400' : versionDiff.peakValueChange < 0 ? 'text-green-400' : 'text-gray-400'
                  }`}
                >
                  {versionDiff.peakValueChange > 0 ? '↑' : versionDiff.peakValueChange < 0 ? '↓' : '→'} {Math.abs(versionDiff.peakValueChange)}
                </div>
              </div>
              <div className="bg-gray-800/60 rounded p-3 border border-gray-700">
                <div className="text-[10px] text-gray-500 mb-1">峰值位置</div>
                <div
                  className={`text-lg font-bold font-mono ${
                    versionDiff.peakTimeChange > 0 ? 'text-amber-400' : versionDiff.peakTimeChange < 0 ? 'text-cyan-400' : 'text-gray-400'
                  }`}
                >
                  {versionDiff.peakTimeChange > 0 ? '↦' : versionDiff.peakTimeChange < 0 ? '↤' : '→'} {Math.abs(versionDiff.peakTimeChange).toFixed(1)}s
                </div>
              </div>
              <div className="bg-gray-800/60 rounded p-3 border border-gray-700">
                <div className="text-[10px] text-gray-500 mb-1">平均紧张</div>
                <div
                  className={`text-lg font-bold font-mono ${
                    versionDiff.avgValueChange > 0 ? 'text-red-400' : versionDiff.avgValueChange < 0 ? 'text-green-400' : 'text-gray-400'
                  }`}
                >
                  {versionDiff.avgValueChange > 0 ? '↑' : versionDiff.avgValueChange < 0 ? '↓' : '→'} {Math.abs(versionDiff.avgValueChange)}
                </div>
              </div>
              <div className="bg-gray-800/60 rounded p-3 border border-gray-700">
                <div className="text-[10px] text-gray-500 mb-1">恢复时间</div>
                <div
                  className={`text-lg font-bold font-mono ${
                    versionDiff.recoveryTimeChange > 0 ? 'text-amber-400' : versionDiff.recoveryTimeChange < 0 ? 'text-green-400' : 'text-gray-400'
                  }`}
                >
                  {versionDiff.recoveryTimeChange > 0 ? '↑' : versionDiff.recoveryTimeChange < 0 ? '↓' : '→'} {Math.abs(versionDiff.recoveryTimeChange).toFixed(1)}s
                </div>
              </div>
              <div className="bg-gray-800/60 rounded p-3 border border-gray-700">
                <div className="text-[10px] text-gray-500 mb-1">门锁影响</div>
                <div
                  className={`text-lg font-bold font-mono ${
                    versionDiff.doorLockImpactChange > 0 ? 'text-red-400' : versionDiff.doorLockImpactChange < 0 ? 'text-green-400' : 'text-gray-400'
                  }`}
                >
                  {versionDiff.doorLockImpactChange > 0 ? '↑' : versionDiff.doorLockImpactChange < 0 ? '↓' : '→'} {Math.abs(versionDiff.doorLockImpactChange)}
                </div>
              </div>
              <div className="bg-gray-800/60 rounded p-3 border border-gray-700">
                <div className="text-[10px] text-gray-500 mb-1">爆发点数量</div>
                <div
                  className={`text-lg font-bold font-mono ${
                    versionDiff.peakCountChange > 0 ? 'text-red-400' : versionDiff.peakCountChange < 0 ? 'text-green-400' : 'text-gray-400'
                  }`}
                >
                  {versionDiff.peakCountChange > 0 ? '↑' : versionDiff.peakCountChange < 0 ? '↓' : '→'} {Math.abs(versionDiff.peakCountChange)}
                </div>
              </div>
            </div>

            {versionDiff.significantChanges.length > 0 && (
              <div>
                <div className="text-[10px] text-gray-500 mb-2">显著变化点（≥10）</div>
                <div className="flex flex-wrap gap-2">
                  {versionDiff.significantChanges.slice(0, 8).map((change, idx) => (
                    <span
                      key={idx}
                      className={`text-[10px] px-2 py-1 rounded ${
                        change.type === 'door'
                          ? 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
                          : change.type === 'recovery'
                            ? 'bg-green-900/40 text-green-300 border border-green-700/50'
                            : change.valueDiff > 0
                              ? 'bg-red-900/40 text-red-300 border border-red-700/50'
                              : 'bg-cyan-900/40 text-cyan-300 border border-cyan-700/50'
                      }`}
                    >
                      ⏱{change.time.toFixed(1)}s · {change.label} · {change.valueDiff > 0 ? '+' : ''}{change.valueDiff}
                      {change.type === 'door' && ' 🔒'}
                      {change.type === 'recovery' && ' 💚'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
