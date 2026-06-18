import React, { useState, useEffect } from 'react'
import { EditorProvider, useEditor } from './context/EditorContext'
import { SceneNodePalette } from './components/SceneNodePalette'
import { TimelineEditor } from './components/TimelineEditor'
import { SceneNodeInspector } from './components/SceneNodeInspector'
import { MiniMap } from './components/MiniMap'
import { RoutePanel } from './components/RoutePanel'
import { TensionCurveChart } from './components/TensionCurveChart'
import { TensionFeedbackPanel } from './components/TensionFeedbackPanel'

type TabId = 'timeline' | 'routes' | 'tension'

const TabButton: React.FC<{
  active: boolean
  onClick: () => void
  icon: string
  label: string
  description: string
}> = ({ active, onClick, icon, label, description }) => (
  <button
    onClick={onClick}
    className={`px-6 py-3 rounded-lg transition-all text-left flex items-center gap-3 ${
      active
        ? 'bg-purple-900/50 border border-purple-500 shadow-lg shadow-purple-500/20'
        : 'bg-gray-900/40 border border-gray-700 hover:border-gray-600 hover:bg-gray-800/40'
    }`}
  >
    <span className="text-2xl">{icon}</span>
    <div>
      <div className={`text-sm font-semibold ${active ? 'text-purple-200' : 'text-gray-300'}`}>
        {label}
      </div>
      <div className="text-[11px] text-gray-500">{description}</div>
    </div>
  </button>
)

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('timeline')
  const { project, actions } = useEditor()

  useEffect(() => {
    actions.runFullAnalysis()
  }, [])

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-950 via-gray-900 to-purple-950/30">
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-red-600 flex items-center justify-center text-xl shadow-lg shadow-purple-500/30">
            🎬
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-100">追逐段落导演编辑器</h1>
            <p className="text-xs text-gray-500">Chase Sequence Director · 为独立叙事恐怖游戏作者打造</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={project.name}
            onChange={e => actions.setProject({ ...project, name: e.target.value })}
            className="bg-gray-800/60 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-purple-500 w-64"
          />
          <button
            onClick={() => actions.runFullAnalysis()}
            className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 rounded text-sm font-medium text-white transition-all shadow-md shadow-purple-500/30"
          >
            🔍 全局分析
          </button>
        </div>
      </header>

      <div className="px-6 py-3 border-b border-gray-800 bg-gray-900/40">
        <div className="flex gap-3">
          <TabButton
            active={activeTab === 'timeline'}
            onClick={() => setActiveTab('timeline')}
            icon="⏱️"
            label="时间轴编排"
            description="拖拽场景节点，调整节奏参数"
          />
          <TabButton
            active={activeTab === 'routes'}
            onClick={() => setActiveTab('routes')}
            icon="🗺️"
            label="路线预览"
            description="玩家逃跑路线模拟与问题检测"
          />
          <TabButton
            active={activeTab === 'tension'}
            onClick={() => setActiveTab('tension')}
            icon="📈"
            label="紧张曲线"
            description="恐惧节奏分析与导演反馈"
          />
        </div>
      </div>

      <main className="flex-1 overflow-hidden p-4">
        {activeTab === 'timeline' && (
          <div className="h-full flex gap-4">
            <div className="w-64 flex-shrink-0 overflow-y-auto">
              <SceneNodePalette />
            </div>
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              <TimelineEditor />
            </div>
            <div className="w-72 flex-shrink-0 overflow-y-auto">
              <SceneNodeInspector />
            </div>
          </div>
        )}

        {activeTab === 'routes' && (
          <div className="h-full flex gap-4">
            <div className="w-80 flex-shrink-0 overflow-y-auto">
              <RoutePanel />
            </div>
            <div className="flex-1 flex flex-col min-w-0">
              <MiniMap />
            </div>
          </div>
        )}

        {activeTab === 'tension' && (
          <div className="h-full flex gap-4">
            <div className="flex-1 flex flex-col min-w-0">
              <TensionCurveChart />
            </div>
            <div className="w-96 flex-shrink-0 overflow-y-auto">
              <TensionFeedbackPanel />
            </div>
          </div>
        )}
      </main>

      <footer className="px-6 py-2 border-t border-gray-800 bg-gray-950/80 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>🎬 场景节点: {project.sceneNodes.length}</span>
          <span>📍 路点: {project.waypoints.length}</span>
          <span>🛤️ 路线: {project.routes.length}</span>
        </div>
        <div>
          提示: 在时间轴拖拽节点边缘调整时长 · 双击小地图添加路点
        </div>
      </footer>
    </div>
  )
}

const App: React.FC = () => {
  return (
    <EditorProvider>
      <AppContent />
    </EditorProvider>
  )
}

export default App
