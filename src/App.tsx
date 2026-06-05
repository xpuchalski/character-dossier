import React, { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import CharacterList from './components/CharacterList'
import CharacterEditor from './components/CharacterEditor'
import { db, Character } from './lib/db'

export default function App() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

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
      <Sidebar>
        <CharacterList characters={characters} onSelect={setSelectedId} selectedId={selectedId} onRefresh={async () => setCharacters(await db.characters.toArray())} />
      </Sidebar>

      <main className="flex-1 p-6 overflow-auto h-screen">
        <h1 className="text-2xl font-bold mb-4">Character Dossier Builder</h1>
        {selectedId ? (
          <CharacterEditor id={selectedId} onChange={() => setCharacters([])} />
        ) : (
          <p className="text-slate-600 dark:text-slate-300">No character selected — create one from the sidebar.</p>
        )}
      </main>
    </div>
  )
}
