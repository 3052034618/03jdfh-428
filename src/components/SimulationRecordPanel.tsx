import React, { useState } from 'react'
import { useEditor } from '../context/EditorContext'
import type { RouteSimulationRecord } from '../types'

const VERSION_COLORS = ['#a855f7', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#6366f1', '#14b8a6']

export const SimulationRecordPanel: React.FC = () => {
  const { project, actions, selectedRouteId, filePath } = useEditor()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveNotes, setSaveNotes] = useState('')
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  }

  const getDangerColor = (score: number) => {
    if (score >= 70) return '#ef4444'
    if (score >= 40) return '#f59e0b'
    return '#22c55e'
  }

  const handleSaveRecord = () => {
    if (!selectedRouteId) return
    actions.saveSimulationRecord(selectedRouteId, saveNotes.trim())
    setShowSaveDialog(false)
    setSaveNotes('')
  }

  const handleStartEdit = (record: RouteSimulationRecord) => {
    setEditingId(record.id)
    setEditNotes(record.notes)
  }

  const handleSaveNotes = (recordId: string) => {
    actions.updateSimulationRecordNotes(recordId, editNotes)
    setEditingId(null)
    setEditNotes('')
  }

  const recordsForSelectedRoute = project.simulationRecords.filter(r => r.routeId === selectedRouteId)
  const allRecords = [...project.simulationRecords].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="flex flex-col gap-3 h-full overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wider">路线复盘记录</h3>
          <p className="text-xs text-gray-500">保存模拟结果，跨项目对比路线危险度</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                setIsGeneratingReport(true)
                const report = actions.generateExportReport()
                actions.downloadReport(report)
              } finally {
                setTimeout(() => setIsGeneratingReport(false), 1000)
              }
            }}
            disabled={project.simulationRecords.length === 0 || isGeneratingReport}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-xs font-medium transition-colors"
            title="导出团队复盘报告 (HTML)"
          >
            {isGeneratingReport ? '⏳ 生成中...' : '📤 导出报告'}
          </button>
          <button
            onClick={() => setShowSaveDialog(true)}
            disabled={!selectedRouteId}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-xs font-medium transition-colors"
          >
            💾 保存模拟
          </button>
        </div>
      </div>

      {showSaveDialog && (
        <div className="p-3 bg-gray-800/80 rounded-lg border border-purple-700/50 flex-shrink-0">
          <div className="text-xs text-gray-400 mb-2">
            为当前路线「{project.routes.find(r => r.id === selectedRouteId)?.name}」保存模拟记录
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={saveNotes}
              onChange={e => setSaveNotes(e.target.value)}
              placeholder="备注（可选，如：调整岔路标记后）"
              className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm outline-none focus:border-purple-500"
              autoFocus
            />
            <button
              onClick={handleSaveRecord}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-xs font-medium"
            >
              保存
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {allRecords.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
          <div className="text-4xl mb-2">📝</div>
          <div className="text-sm">暂无模拟记录</div>
          <div className="text-xs mt-1">播放路线后点击「保存本次模拟」</div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-2 pr-1">
          {allRecords.map((record, idx) => (
            <div
              key={record.id}
              className={`p-3 rounded-lg border transition-all ${
                record.routeId === selectedRouteId
                  ? 'bg-gray-800/70 border-purple-600/50'
                  : 'bg-gray-800/40 border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: record.routeColor }}
                  />
                  <span className="text-sm font-medium text-gray-200">{record.routeName}</span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold"
                    style={{
                      backgroundColor: getDangerColor(record.dangerScore) + '20',
                      color: getDangerColor(record.dangerScore),
                    }}
                  >
                    {record.dangerScore}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500 font-mono">
                    {formatTime(record.createdAt)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-[10px] mb-2">
                <div className="bg-gray-900/50 rounded p-1.5">
                  <div className="text-gray-500">结果</div>
                  <div className={record.success ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                    {record.success ? '逃脱' : '被抓'}
                  </div>
                </div>
                <div className="bg-gray-900/50 rounded p-1.5">
                  <div className="text-gray-500">时长</div>
                  <div className="text-gray-200 font-mono">{record.totalTime.toFixed(1)}s</div>
                </div>
                <div className="bg-gray-900/50 rounded p-1.5">
                  <div className="text-gray-500">最近</div>
                  <div className={`font-mono ${record.minDistance < 30 ? 'text-red-400' : 'text-gray-200'}`}>
                    {record.minDistance}
                  </div>
                </div>
                <div className="bg-gray-900/50 rounded p-1.5">
                  <div className="text-gray-500">卡死</div>
                  <div className={record.stuckPoints.length > 0 ? 'text-red-400 font-mono' : 'text-gray-400 font-mono'}>
                    {record.stuckPoints.length}
                  </div>
                </div>
              </div>

              {record.keyMoments.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] text-gray-500 mb-1">关键点</div>
                  <div className="flex flex-wrap gap-1">
                    {record.keyMoments.slice(0, 4).map((km, kidx) => (
                      <span
                        key={kidx}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-gray-900/60 text-gray-400"
                      >
                        ⏱{km.time.toFixed(1)}s {km.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {editingId === record.id ? (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs outline-none focus:border-purple-500"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveNotes(record.id)}
                    className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-[10px] font-medium"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-[10px] font-medium"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] text-gray-400 flex-1 truncate">
                    {record.notes || '点击 ✏️ 添加备注'}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleStartEdit(record)}
                      className="text-gray-500 hover:text-gray-300 text-xs"
                      title="编辑备注"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => actions.deleteSimulationRecord(record.id)}
                      className="text-gray-500 hover:text-red-400 text-xs"
                      title="删除记录"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {allRecords.length >= 2 && (
        <div className="p-3 bg-gray-900/60 rounded-lg border border-gray-700 flex-shrink-0">
          <div className="text-[10px] font-semibold text-purple-300 mb-2 uppercase tracking-wider">跨记录对比</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left font-normal px-1 py-1">记录</th>
                  <th className="text-left font-normal px-1 py-1">危险度</th>
                  <th className="text-left font-normal px-1 py-1">结果</th>
                  <th className="text-left font-normal px-1 py-1">时长</th>
                  <th className="text-left font-normal px-1 py-1">最近</th>
                  <th className="text-left font-normal px-1 py-1">卡死</th>
                </tr>
              </thead>
              <tbody>
                {allRecords.slice(0, 5).map((record, idx) => (
                  <tr key={record.id} className="border-t border-gray-800">
                    <td className="px-1 py-1">
                      <div className="flex items-center gap-1">
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: VERSION_COLORS[idx % VERSION_COLORS.length] }}
                        />
                        <span className="text-gray-300 max-w-16 truncate">{record.routeName}</span>
                      </div>
                    </td>
                    <td className="px-1 py-1 font-mono" style={{ color: getDangerColor(record.dangerScore) }}>
                      {record.dangerScore}
                    </td>
                    <td className="px-1 py-1">
                      <span className={record.success ? 'text-green-400' : 'text-red-400'}>
                        {record.success ? '✓' : '✗'}
                      </span>
                    </td>
                    <td className="px-1 py-1 font-mono text-gray-300">{record.totalTime.toFixed(1)}s</td>
                    <td className="px-1 py-1 font-mono text-gray-300">{record.minDistance}</td>
                    <td className="px-1 py-1 font-mono text-gray-300">{record.stuckPoints.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
