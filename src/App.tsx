import React, { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import CharacterList from './components/CharacterList'
import CharacterEditor from './components/CharacterEditor'
import { db, Character } from './lib/db'

export default function App() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showHome, setShowHome] = useState(true)

  useEffect(() => {
    const load = async () => {
      const all = await db.characters.orderBy('updatedAt').reverse().toArray()
      setCharacters(all)
      if (!selectedId && all.length) setSelectedId(all[0].id)
    }
    load()
    const sub = db.characters.hook('creating', () => load())
    return () => {
      try { sub.unsubscribe?.() } catch {}
    }
  }, [])

  return (
    <div className="h-screen flex bg-black text-white">
      <Sidebar onHome={() => setShowHome(true)} isHome={showHome}>
        <CharacterList characters={characters} onSelect={id => { setSelectedId(id); setShowHome(false) }} selectedId={selectedId} onRefresh={async () => setCharacters(await db.characters.toArray())} />
      </Sidebar>

      <main className="flex-1 p-6 overflow-auto h-screen">
        {showHome ? <HomePage onStart={() => {
          if (selectedId) setShowHome(false)
        }} /> : selectedId ? (
          <CharacterEditor id={selectedId} onChange={() => setCharacters([])} />
        ) : (
          <p className="text-slate-600 dark:text-slate-300">No character selected — create one from the sidebar.</p>
        )}
      </main>
    </div>
  )
}

function HomePage({ onStart }: { onStart: () => void }) {
  return (
    <div className="max-w-4xl space-y-8 py-10">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.25em] text-indigo-300">Character Dossier Builder</p>
        <h1 className="text-5xl font-bold">Build a character page that feels like them.</h1>
        <p className="max-w-2xl text-lg text-slate-300">Organize identity, images, biography, relationships, timelines, and custom notes into a visual dossier you can export as a styled PDF.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <HomeTip title="1. Create a character">Use + New in the sidebar, then fill in identity fields and the character name.</HomeTip>
        <HomeTip title="2. Arrange the page">Drag the handle on any card. Drop near the left or right edge of another card to create a half-width pair.</HomeTip>
        <HomeTip title="3. Make it yours">Upload images, drag them from Gallery onto the page, add custom cards, choose a theme, then export JSON or PDF.</HomeTip>
      </div>
      <button onClick={onStart} className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded">Open a character</button>
    </div>
  )
}

function HomeTip({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded border border-slate-700 bg-slate-950 p-5"><h2 className="mb-2 text-lg font-semibold">{title}</h2><p className="text-sm text-slate-300">{children}</p></div>
}
