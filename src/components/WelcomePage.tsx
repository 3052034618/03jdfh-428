import React from 'react'
import { useEditor } from '../context/EditorContext'

export const WelcomePage: React.FC = () => {
  const { recentProjects, actions, project, isDirty } = useEditor()

  const formatTime = (ms: number) => {
    const now = Date.now()
    const diff = now - ms
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
    return new Date(ms).toLocaleDateString('zh-CN')
  }

  const formatFullTime = (ms: number) => {
    return new Date(ms).toLocaleString('zh-CN')
  }

  const handleRecentProjectClick = async (filePath: string) => {
    await actions.loadRecentProject(filePath)
  }

  const handleNewProject = () => {
    if (isDirty) {
      if (!confirm('当前项目有未保存的更改，确定要新建项目吗？')) {
        return
      }
    }
    actions.newProject()
  }

  const handleOpenProject = async () => {
    if (isDirty) {
      if (!confirm('当前项目有未保存的更改，确定要打开另一个项目吗？')) {
        return
      }
    }
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.openProject()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-purple-950/30 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-600 to-red-600 flex items-center justify-center text-5xl shadow-2xl shadow-purple-500/30">
            🎬
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">追逐段落导演编辑器</h1>
          <p className="text-gray-400 text-lg">独立叙事恐怖游戏的追逐节奏调试工具</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-gray-900/60 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-purple-300 mb-4 flex items-center gap-2">
              ✨ 快速开始
            </h2>
            <div className="space-y-3">
              <button
                onClick={handleNewProject}
                className="w-full p-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white text-left transition-all shadow-lg shadow-purple-500/20 group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📄</span>
                  <div>
                    <div className="font-semibold">新建项目</div>
                    <div className="text-sm text-purple-200 opacity-80">
                      从零开始创建追逐段落
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={handleOpenProject}
                className="w-full p-4 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 text-left transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📂</span>
                  <div>
                    <div className="font-semibold">打开项目</div>
                    <div className="text-sm text-gray-400">
                      浏览并打开 .chase.json 文件
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  if (isDirty) {
                    if (!confirm('当前项目有未保存的更改，确定要加载示例项目吗？')) {
                      return
                    }
                  }
                  actions.setShowWelcome(false)
                }}
                className="w-full p-4 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 text-gray-300 text-left transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎮</span>
                  <div>
                    <div className="font-semibold">使用示例项目</div>
                    <div className="text-sm text-gray-500">
                      {project.name || '公寓逃生示例'}
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-gray-900/60 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-purple-300 flex items-center gap-2">
                🕒 最近项目
              </h2>
              {recentProjects.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('确定清空最近项目列表吗？')) {
                      actions.clearRecentProjects()
                    }
                  }}
                  className="text-xs text-gray-500 hover:text-gray-400"
                >
                  清空
                </button>
              )}
            </div>

            {recentProjects.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-3">📁</div>
                <p>暂无最近打开的项目</p>
                <p className="text-sm mt-1">打开或保存项目后会显示在这里</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {recentProjects.map(entry => (
                  <button
                    key={entry.filePath}
                    onClick={() => handleRecentProjectClick(entry.filePath)}
                    className="w-full p-3 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 hover:border-purple-500/50 text-left transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 text-xl">
                        {entry.hasUnsavedChanges ? '⚠️' : '📄'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-200 truncate">
                            {entry.projectName}
                          </span>
                          {entry.hasUnsavedChanges && (
                            <span className="text-amber-400 text-xs flex-shrink-0">● 未保存</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 truncate font-mono mt-1">
                          {entry.fileName}
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[10px] text-gray-600">
                          <span>最后保存: {formatTime(entry.lastSavedAt)}</span>
                          <span className="text-gray-700" title={formatFullTime(entry.lastOpenedAt)}>
                            打开: {formatTime(entry.lastOpenedAt)}
                          </span>
                        </div>
                      </div>
                      <span className="text-gray-600 group-hover:text-purple-400 transition-colors flex-shrink-0">
                        →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="bg-gray-900/40 rounded-xl border border-gray-800 p-4">
            <div className="text-2xl mb-2">⏱️</div>
            <div className="text-sm font-medium text-gray-300">时间轴编排</div>
            <div className="text-xs text-gray-500 mt-1">拖拽场景节点，设置怪物出现时机、门锁延迟</div>
          </div>
          <div className="bg-gray-900/40 rounded-xl border border-gray-800 p-4">
            <div className="text-2xl mb-2">🗺️</div>
            <div className="text-sm font-medium text-gray-300">路线预览</div>
            <div className="text-xs text-gray-500 mt-1">模拟追逐过程，检测卡死、迷路、被追上位置</div>
          </div>
          <div className="bg-gray-900/40 rounded-xl border border-gray-800 p-4">
            <div className="text-2xl mb-2">📈</div>
            <div className="text-sm font-medium text-gray-300">紧张曲线</div>
            <div className="text-xs text-gray-500 mt-1">分析节奏，多版本对比，输出导演报告</div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-600">
          <p>快捷键: Ctrl+N 新建 · Ctrl+O 打开 · Ctrl+S 保存 · Space 播放 · F5 分析</p>
        </div>
      </div>
    </div>
  )
}
