import React, { useState } from 'react'

export default function Sidebar({ children }: { children?: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <aside className={`border-r border-slate-700 bg-slate-950 p-2 ${collapsed ? 'w-16' : 'w-80'}`} style={{ height: '100vh', position: 'relative' }}>
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setCollapsed(!collapsed)} className="p-1 rounded hover:bg-slate-800 text-white">
            {collapsed ? '➤' : '◀'}
          </button>
          {!collapsed && <h2 className="font-bold text-white">Characters</h2>}
        </div>
      </div>

      <div className="mt-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 48px)' }}>
        {!collapsed ? children : null}
      </div>
    </aside>
  )
}
