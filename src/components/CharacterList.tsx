import React from 'react'
import { Character, db } from '../lib/db'

export default function CharacterList({ characters, onSelect, selectedId, onRefresh }: { characters: Character[]; onSelect: (id: string) => void; selectedId: string | null; onRefresh: () => void }) {
  const create = async () => {
    const id = crypto.randomUUID()
    const now = new Date()
    const newChar: Character = {
      id,
      name: 'New Character',
      basicInfo: {},
      identityFields: [
        { id: crypto.randomUUID(), key: 'birthday', label: 'Birthday', value: '', removable: true },
        { id: crypto.randomUUID(), key: 'age', label: 'Age', value: '', removable: true },
        { id: crypto.randomUUID(), key: 'gender', label: 'Gender', value: '', removable: true },
        { id: crypto.randomUUID(), key: 'pronouns', label: 'Pronouns', value: '', removable: true },
        { id: crypto.randomUUID(), key: 'species', label: 'Species', value: '', removable: true },
        { id: crypto.randomUUID(), key: 'occupation', label: 'Occupation', value: '', removable: true }
      ],
      images: [],
      biography: '',
      customSections: [],
      relationships: [],
      timeline: [],
      tags: [],
      sectionOrder: ['identity', 'gallery', 'biography', 'custom', 'relationships', 'timeline', 'theme'],
      sectionCollapsed: {},
      sectionCols: {},
      theme: {
        primaryColor: '#ffffff',
        secondaryColor: '#000000',
        accentColor: '#241f31',
        backgroundColor: '#000000',
        textColor: '#ffffff'
      },
      customCss: '',
      createdAt: now,
      updatedAt: now
    }
    await db.characters.add(newChar)
    onSelect(id)
    onRefresh()
  }

  const remove = async (id: string) => {
    if (!confirm('Delete character?')) return
    await db.characters.delete(id)
    onRefresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white">Characters</h3>
        <button onClick={create} className="text-sm text-white">+ New</button>
      </div>

      <div className="space-y-1">
        {characters.map(c => (
          <div key={c.id} className={`p-2 rounded flex items-center justify-between ${selectedId === c.id ? 'bg-slate-900' : 'hover:bg-slate-800'}`}>
            <button className="text-left flex-1 text-white" onClick={() => onSelect(c.id)}>{c.name || 'Untitled'}</button>
            <div className="flex items-center gap-2">
              <button onClick={() => onSelect(c.id)} className="text-sm text-white">Edit</button>
              <button onClick={() => remove(c.id)} className="text-sm text-red-600">Del</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
