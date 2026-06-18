import React, { useMemo } from 'react'
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
import type { TensionLevel } from '../types'

const CHART_HEIGHT = 280
const PADDING = { top: 20, right: 20, bottom: 40, left: 50 }

export const TensionCurveChart: React.FC = () => {
  const { tensionCurve, tensionFeedback, project, actions, simulationTime, isSimulating } = useEditor()

  const totalDuration = useMemo(() => {
    if (tensionCurve.length === 0) return 100
    return Math.ceil(tensionCurve[tensionCurve.length - 1].time / 10) * 10
  }, [tensionCurve])

  const chartWidth = Math.max(800, totalDuration * PX_PER_SECOND)
  const innerWidth = chartWidth - PADDING.left - PADDING.right
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom

  const timeToX = (t: number) => PADDING.left + (t / totalDuration) * innerWidth
  const valueToY = (v: number) => PADDING.top + innerHeight - (v / TENSION_MAX) * innerHeight

  const pathD = useMemo(() => {
    if (tensionCurve.length < 2) return ''
    return tensionCurve
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${timeToX(p.time)} ${valueToY(p.value)}`)
      .join(' ')
  }, [tensionCurve, totalDuration])

  const areaD = useMemo(() => {
    if (tensionCurve.length < 2) return ''
    const topPath = tensionCurve
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${timeToX(p.time)} ${valueToY(p.value)}`)
      .join(' ')
    const lastTime = tensionCurve[tensionCurve.length - 1].time
    return `${topPath} L ${timeToX(lastTime)} ${PADDING.top + innerHeight} L ${timeToX(tensionCurve[0].time)} ${PADDING.top + innerHeight} Z`
  }, [tensionCurve, totalDuration])

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

  return (
    <div className="flex-1 flex flex-col bg-gray-900/40 rounded-lg border border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-900/80">
        <div>
          <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wider">紧张曲线</h3>
          <p className="text-xs text-gray-400">可视化恐惧节奏，检查峰值分布与喘息恢复</p>
        </div>
        <button
          onClick={() => actions.runFullAnalysis()}
          className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-xs font-medium transition-colors"
        >
          📊 运行分析
        </button>
      </div>

      <div className="overflow-auto flex-1">
        <div className="p-4" style={{ minWidth: chartWidth + 20 }}>
          <div className="flex items-center gap-4 mb-3 text-xs">
            {(['safe', 'pressure', 'burst'] as TensionLevel[]).map(level => (
              <div key={level} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded ${TENSION_COLORS[level].bg} border ${TENSION_COLORS[level].border}`} />
                <span className={TENSION_COLORS[level].text}>
                  {TENSION_LABELS[level]} ({level === 'safe' ? `<${TENSION_SAFE_MAX}` : level === 'pressure' ? `${TENSION_BURST_MIN - 1}-${TENSION_PRESSURE_MAX}` : `>${TENSION_BURST_MIN - 1}`})
                </span>
              </div>
            ))}
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

            {tensionCurve.length >= 2 && (
              <>
                <path d={areaD} fill="url(#curveGradient)" />
                <path
                  d={pathD}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth={2.5}
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
                r={3}
                fill="#ef4444"
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
                  r={6}
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
          </svg>
        </div>
      </div>
    </div>
  )
}
