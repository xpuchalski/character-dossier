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
  }, [])

  return (
    <div className="h-screen flex bg-black text-white">
      <Sidebar onHome={() => setShowHome(true)} isHome={showHome}>
        <CharacterList characters={characters} onSelect={id => { setSelectedId(id); setShowHome(false) }} selectedId={selectedId} onRefresh={async () => setCharacters(await db.characters.toArray())} />
      </Sidebar>

      <main className="flex-1 p-6 overflow-y-auto overflow-x-hidden h-screen">
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
        <h1 className="text-5xl font-bold">A free OC creator website where you have full control.</h1>
        <p className="max-w-2xl text-lg text-slate-300">Now with added ability to export your character dossiers as PDFs!.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <HomeTip title="1. Create a character">Add your own images and put them wherever you want for the best impact.</HomeTip>
        <HomeTip title="2. Arrange the page">Drag and resize cards to fit your vision.</HomeTip>
        <HomeTip title="3. Make it yours">Add whatever traits you can dream up to their page with no restrictions.</HomeTip>
      </div>
      <button onClick={onStart} className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded">Open a character</button>
    </div>
  )
}

function HomeTip({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded border border-slate-700 bg-slate-950 p-5"><h2 className="mb-2 text-lg font-semibold">{title}</h2><p className="text-sm text-slate-300">{children}</p></div>
}
