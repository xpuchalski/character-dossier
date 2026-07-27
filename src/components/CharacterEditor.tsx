import React, { useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db, Character, ImageRef, Section, Relationship, TimelineEvent, IdentityField, ThemeSettings } from '../lib/db'
import { PDFDocument } from 'pdf-lib'
import html2canvas from 'html2canvas'
import ReactFlow, { MiniMap, Controls } from 'reactflow'
import 'reactflow/dist/style.css'

const DEFAULT_SECTION_ORDER = ['identity', 'gallery', 'biography', 'custom', 'relationships', 'timeline', 'theme']

const DEFAULT_THEME: ThemeSettings = {
  primaryColor: '#ffffff',
  secondaryColor: '#000000',
  accentColor: '#241f31',
  backgroundColor: '#000000',
  textColor: '#ffffff'
}

const DEFAULT_CUSTOM_CSS = ''

const dynamicSectionId = (type: 'image' | 'custom', id: string) => `${type}:${id}`

function normalizeSectionOrder(char: Character): string[] {
  const existing = char.sectionOrder || DEFAULT_SECTION_ORDER
  const imageIds = (char.images || []).map(image => dynamicSectionId('image', image.id))
  const customIds = (char.customSections || []).map(section => dynamicSectionId('custom', section.id))
  const dynamicIds = new Set([...imageIds, ...customIds])
  const order = existing.filter(id => id !== 'custom' && ((!id.startsWith('image:') && !id.startsWith('custom:')) || dynamicIds.has(id)))
  const missing = [...imageIds, ...customIds].filter(id => !order.includes(id))
  const galleryIndex = order.indexOf('gallery') + 1
  order.splice(galleryIndex > 0 ? galleryIndex : order.length, 0, ...missing)
  return order.filter((id, index, list) => list.indexOf(id) === index)
}

function mapRelationshipToColor(type: string) {
  switch (type) {
    case 'Friend': return '#3b82f6'
    case 'Family': return '#10b981'
    case 'Rival': return '#ef4444'
    case 'Romantic': return '#ec4899'
    case 'Enemy': return '#f97316'
    default: return '#94a3b8'
  }
}

function defaultIdentityFields(): IdentityField[] {
  return [
    { id: crypto.randomUUID(), key: 'birthday', label: 'Birthday', value: '', removable: true },
    { id: crypto.randomUUID(), key: 'age', label: 'Age', value: '', removable: true },
    { id: crypto.randomUUID(), key: 'gender', label: 'Gender', value: '', removable: true },
    { id: crypto.randomUUID(), key: 'pronouns', label: 'Pronouns', value: '', removable: true },
    { id: crypto.randomUUID(), key: 'species', label: 'Species', value: '', removable: true },
    { id: crypto.randomUUID(), key: 'occupation', label: 'Occupation', value: '', removable: true }
  ]
}

function makeBasicInfo(fields: IdentityField[]) {
  return fields.reduce((acc, field) => ({ ...acc, [field.key]: field.value }), {} as Record<string, string>)
}

export default function CharacterEditor({ id, onChange }: { id: string; onChange?: () => void }) {
  const [char, setChar] = useState<Character | null>(null)
  const [viewMode, setViewMode] = useState(false)
  const [proMode, setProMode] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [originalSpans, setOriginalSpans] = useState<Record<string, number> | null>(null)
  const [sectionPositions, setSectionPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [sectionSizes, setSectionSizes] = useState<Record<string, { width: number; height: number }>>({})
  const [dragState, setDragState] = useState<{ sectionId: string; startX: number; startY: number; startPos: { x: number; y: number } } | null>(null)
  const [affectedSections, setAffectedSections] = useState<Set<string>>(new Set())
  const [sectionDirections, setSectionDirections] = useState<Record<string, 'up' | 'down'>>({})
  const dossierRef = useRef<HTMLDivElement>(null)
  const [isImageDropActive, setIsImageDropActive] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const c = await db.characters.get(id)
      if (!mounted || !c) return
      setChar({
        ...c,
        sectionOrder: normalizeSectionOrder(c),
        sectionCollapsed: c.sectionCollapsed || {},
        sectionCols: c.sectionCols || {},
        sectionPositions: c.sectionPositions || {},
        sectionSizes: c.sectionSizes || {},
        theme: c.theme || DEFAULT_THEME,
        identityFields: c.identityFields || defaultIdentityFields(),
        customCss: c.customCss || DEFAULT_CUSTOM_CSS
      })
    })()
    return () => { mounted = false }
  }, [id])

  useEffect(() => {
    if (!char) return
    setNameInput(char.name || '')
  }, [char?.name])

  useEffect(() => {
    if (!char) return
    const nextPositions: Record<string, { x: number; y: number }> = { ...(char.sectionPositions || {}) }
    char.sectionOrder.forEach((sectionId, index) => {
      if (!nextPositions[sectionId]) {
        nextPositions[sectionId] = { x: 24 + (index % 2) * 340, y: 24 + Math.floor(index / 2) * 280 }
      }
    })
    setSectionPositions(nextPositions)

    const nextSizes: Record<string, { width: number; height: number }> = { ...(char.sectionSizes || {}) }
    char.sectionOrder.forEach((sectionId, index) => {
      if (!nextSizes[sectionId]) {
        nextSizes[sectionId] = { width: 360, height: index === 0 ? 220 : 240 }
      }
    })
    setSectionSizes(nextSizes)
  }, [char?.id, char?.sectionOrder.join(',')])

  useEffect(() => {
    const styleId = 'character-custom-css'
    let style = document.getElementById(styleId) as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = styleId
      document.head.appendChild(style)
    }
    
    // Build CSS with theme variables
    const themeVars = char ? `
:root {
  --primary-color: ${char.theme.primaryColor};
  --secondary-color: ${char.theme.secondaryColor};
  --accent-color: ${char.theme.accentColor};
  --background-color: ${char.theme.backgroundColor};
  --text-color: ${char.theme.textColor};
}
` : ''
    
    style.textContent = themeVars + (char?.customCss || '')
    return () => {
      style?.remove()
    }
  }, [char?.customCss, char?.theme])

  const save = async (patch: Partial<Character>) => {
    if (!char) return
    const next: Character = {
      ...char,
      ...patch,
      basicInfo: makeBasicInfo(patch.identityFields ?? char.identityFields),
      updatedAt: new Date()
    }
    await db.characters.put(next)
    setChar(next)
    onChange?.()
  }

  useEffect(() => {
    if (!dragState) return
    const onMove = (event: PointerEvent) => moveSectionDrag(event.clientX, event.clientY)
    const onUp = () => endSectionDrag()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragState])

  const [imageURLs, setImageURLs] = useState<Record<string, string>>({})

  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!char) { setImageURLs({}); return }
      const map: Record<string, string> = {}
      for (const ref of char.images) {
        const blobRec = await db.images.get(ref.id)
        if (blobRec) {
          map[ref.id] = URL.createObjectURL(blobRec.blob)
        }
      }
      if (mounted) setImageURLs(map)
    }
    load()
    return () => { mounted = false; Object.values(imageURLs).forEach(URL.revokeObjectURL) }
  }, [char?.images])

  const handleFiles = async (files: FileList | null) => {
    if (!files || !char) return
    const addedRefs: ImageRef[] = []
    for (const f of Array.from(files)) {
      const id = crypto.randomUUID()
      await db.images.add({ id, characterId: char.id, blob: f, caption: '', createdAt: new Date() })
      addedRefs.push({ id, caption: '' })
    }
    const sectionOrder = [...char.sectionOrder]
    const galleryIndex = sectionOrder.indexOf('gallery')
    sectionOrder.splice(galleryIndex >= 0 ? galleryIndex + 1 : sectionOrder.length, 0, ...addedRefs.map(ref => dynamicSectionId('image', ref.id)))
    save({ images: [...char.images, ...addedRefs], sectionOrder })
  }

  const importJSON = async (file: File | null) => {
    if (!file) return
    const text = await file.text()
    const parsed = JSON.parse(text)
    if (!parsed.id) parsed.id = crypto.randomUUID()
    parsed.createdAt = new Date(parsed.createdAt || Date.now())
    parsed.updatedAt = new Date()
    await db.characters.put(parsed)
    alert('Imported')
    window.location.reload()
  }

  const exportJSON = () => {
    if (!char) return
    const blob = new Blob([JSON.stringify(char, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${char.name || 'character'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = async () => {
    if (!char) return
    const element = dossierRef.current
    if (!element) return
    const canvas = await html2canvas(element, {
      backgroundColor: char.theme.backgroundColor,
      useCORS: true,
      scale: Math.min(2, window.devicePixelRatio || 1),
      logging: false,
      ignoreElements: node => node.closest('[data-pdf-exclude]') !== null || node.tagName === 'BUTTON' || (node.tagName === 'INPUT' && (node as HTMLInputElement).type === 'file')
    })
    const imageData = canvas.toDataURL('image/png')
    const pdfDoc = await PDFDocument.create()
    const image = await pdfDoc.embedPng(imageData)
    const pageWidth = 612
    const pageHeight = 792
    const scale = pageWidth / canvas.width
    const imageHeight = canvas.height * scale
    const pageCount = Math.max(1, Math.ceil(imageHeight / pageHeight))
    for (let index = 0; index < pageCount; index++) {
      const page = pdfDoc.addPage([pageWidth, pageHeight])
      page.drawImage(image, { x: 0, y: pageHeight - imageHeight + index * pageHeight, width: pageWidth, height: imageHeight })
    }

    const pdfBytes = await pdfDoc.save()
    const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength)
    new Uint8Array(pdfBuffer).set(pdfBytes)
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${char.name || 'character'}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const sensors = useSensors(useSensor(PointerSensor))

  const handleSectionDragStart = (event: any) => {
    if (!char) return
    // Save original spans before any changes
    const originalSpanData: Record<string, number> = {}
    char.sectionOrder.forEach(id => {
      originalSpanData[id] = char.sectionCols?.[id] ?? 1
    })
    setOriginalSpans(originalSpanData)
    setAffectedSections(new Set())
  }

  const handleSectionDragCancel = () => {
    // Revert affected sections to their original spans
    if (originalSpans && affectedSections.size > 0) {
      const reverted: Record<string, number> = {}
      affectedSections.forEach(id => {
        reverted[id] = originalSpans[id]
      })
      save({ sectionCols: { ...char?.sectionCols, ...reverted } })
    }
    setOriginalSpans(null)
    setAffectedSections(new Set())
  }

  const calculateAutoSpans = (draggedId: string, newOrder: string[], currentSpans: Record<string, number>): { spans: Record<string, number>; affected: Set<string> } => {
    const insertIndex = newOrder.indexOf(draggedId)
    const affectedIds = new Set<string>([draggedId])
    
    // Only resize if there are adjacent sections
    const hasAdjacent = (insertIndex > 0) || (insertIndex < newOrder.length - 1)
    
    if (!hasAdjacent) {
      // If isolated, keep full-width
      return { spans: { [draggedId]: 1 }, affected: new Set([draggedId]) }
    }
    
    // Add adjacent sections only if they exist
    if (insertIndex > 0) {
      affectedIds.add(newOrder[insertIndex - 1])
    }
    if (insertIndex < newOrder.length - 1) {
      affectedIds.add(newOrder[insertIndex + 1])
    }
    
    // Get neighbor spans to preserve alignment
    const neighborIds = Array.from(affectedIds).filter(id => id !== draggedId)
    const neighborSpans = neighborIds.map(id => currentSpans[id] ?? 1)
    
    // If all neighbors share the same span, preserve it (keeps grouped sections together)
    let targetSpan = 1
    if (neighborSpans.length > 0 && neighborSpans.every(s => s === neighborSpans[0])) {
      targetSpan = neighborSpans[0]
    } else {
      // Calculate based on count
      targetSpan = Math.min(3, affectedIds.size)
    }
    
    const newSpans: Record<string, number> = {}
    affectedIds.forEach(id => {
      newSpans[id] = targetSpan
    })
    
    return { spans: newSpans, affected: affectedIds }
  }

  const handleSectionDragEnd = (event: any) => {
    if (!char) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const rect = over.rect
    const pointerX = event.activatorEvent?.clientX + (event.delta?.x || 0)
    const edgeThreshold = rect.left + rect.width * 0.1
    const dropBefore = pointerX <= edgeThreshold
    const dropAfter = pointerX >= rect.right - rect.width * 0.1
    if (!dropBefore && !dropAfter) return
    const oldIndex = char.sectionOrder.indexOf(active.id)
    let newIndex = char.sectionOrder.indexOf(over.id)
    if (dropAfter) newIndex += 1
    if (oldIndex < newIndex) newIndex -= 1
    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(char.sectionOrder, oldIndex, newIndex)
      const autoSpans = { [active.id]: 2, [over.id]: 2 }
      setAffectedSections(new Set([active.id, over.id]))
      save({ 
        sectionOrder: newOrder,
        sectionCols: { ...char.sectionCols, ...autoSpans }
      })
    }
  }

  const addCustomSection = () => {
    if (!char) return
    const sectionId = crypto.randomUUID()
    const galleryIndex = char.sectionOrder.indexOf('gallery')
    const sectionOrder = [...char.sectionOrder]
    sectionOrder.splice(galleryIndex >= 0 ? galleryIndex + 1 : sectionOrder.length, 0, dynamicSectionId('custom', sectionId))
    save({
      customSections: [...char.customSections, { id: sectionId, title: 'New Section', content: '', collapsed: false }],
      sectionOrder
    })
  }

  const cycleColSpan = (sectionId: string) => {
    if (!char) return
    const cur = char.sectionCols?.[sectionId] ?? 1
    const dir = sectionDirections[sectionId] ?? 'up'
    
    let next: number
    let newDir: 'up' | 'down' = dir
    
    if (dir === 'up') {
      if (cur === 1) next = 2
      else if (cur === 2) next = 3
      else next = 2 // at 3, switch direction to down
      if (next === 3) newDir = 'down'
    } else { // down
      if (cur === 3) next = 2
      else if (cur === 2) next = 1
      else next = 2 // at 1, switch direction to up
      if (next === 1) newDir = 'up'
    }
    
    setSectionDirections(prev => ({ ...prev, [sectionId]: newDir }))
    save({ sectionCols: { ...char.sectionCols, [sectionId]: next } })
  }

  if (!char) {
    return <div className="p-4 text-white">Loading character…</div>
  }

  const sectionLabels: Record<string, string> = {
    identity: 'Identity',
    gallery: 'Gallery',
    biography: 'Biography',
    relationships: 'Relationship Map',
    timeline: 'Timeline',
    custom: 'Custom Sections',
    theme: 'Appearance / CSS Editor'
  }

  const toggleSectionCollapse = (sectionId: string) => {
    if (!char) return
    save({ sectionCollapsed: { ...char.sectionCollapsed, [sectionId]: !char.sectionCollapsed?.[sectionId] } })
  }

  const isSectionCollapsed = (id: string) => char.sectionCollapsed?.[id] ?? false

  const startSectionDrag = (sectionId: string, clientX: number, clientY: number) => {
    const current = sectionPositions[sectionId] || { x: 24, y: 24 }
    setDragState({ sectionId, startX: clientX, startY: clientY, startPos: current })
  }

  const moveSectionDrag = (clientX: number, clientY: number) => {
    if (!dragState) return
    const nextPosition = {
      x: Math.max(0, dragState.startPos.x + clientX - dragState.startX),
      y: Math.max(0, dragState.startPos.y + clientY - dragState.startY)
    }
    setSectionPositions(prev => ({ ...prev, [dragState.sectionId]: nextPosition }))
  }

  const endSectionDrag = () => {
    if (!dragState || !char) return
    setSectionPositions(prev => {
      const nextPosition = prev[dragState.sectionId] || dragState.startPos
      const next = { ...prev, [dragState.sectionId]: nextPosition }
      void save({ sectionPositions: next })
      return next
    })
    setDragState(null)
  }

  const handleSectionResize = (sectionId: string, width: number, height: number) => {
    if (width < 280 || height < 180) return
    const nextSize = { width, height }
    setSectionSizes(prev => {
      const next = { ...prev, [sectionId]: nextSize }
      void save({ sectionSizes: next })
      return next
    })
  }

  const wrappedStyle = {
    backgroundColor: char.theme.backgroundColor,
    color: char.theme.textColor
  }

  return (
    <div className="space-y-4 theme-root" style={wrappedStyle}>
      <div ref={dossierRef} className="space-y-4 p-1 overflow-x-hidden" onDragOver={event => event.preventDefault()} onDragEnter={event => {
        if (event.dataTransfer.types.includes('application/x-character-image')) setIsImageDropActive(true)
      }} onDragLeave={event => {
        if (event.currentTarget === event.target) setIsImageDropActive(false)
      }} onDrop={event => {
        const imageId = event.dataTransfer.getData('application/x-character-image')
        setIsImageDropActive(false)
        if (!imageId || char.sectionOrder.includes(dynamicSectionId('image', imageId))) return
        const galleryIndex = char.sectionOrder.indexOf('gallery')
        const sectionOrder = [...char.sectionOrder]
        sectionOrder.splice(galleryIndex >= 0 ? galleryIndex + 1 : sectionOrder.length, 0, dynamicSectionId('image', imageId))
        save({ sectionOrder })
      }}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-700/70 bg-slate-900/70 px-3 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setProMode(!proMode)} className={`rounded-full px-3 py-1 text-sm font-medium ${proMode ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
            {proMode ? 'Pro mode: on' : 'Pro mode: off'}
          </button>
          <button onClick={() => setViewMode(!viewMode)} className={`rounded-full px-3 py-1 text-sm font-medium ${viewMode ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
            {viewMode ? 'View mode: on' : 'View mode: off'}
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center">
          {viewMode ? (
            <h1 className="text-2xl font-bold text-white text-center">{char.name || 'Untitled character'}</h1>
          ) : (
            <input
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={async () => { if (!char) return; if (nameInput !== char.name) await save({ name: nameInput }) }}
              onKeyDown={async e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur() } }}
              className="text-2xl font-bold p-2 rounded bg-white text-black mx-auto max-w-3xl text-center"
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          {!viewMode && (
            <>
              <button data-pdf-exclude onClick={exportJSON} className="px-3 py-2 rounded bg-slate-800 text-white">Export JSON</button>
              <label data-pdf-exclude className="px-3 py-2 rounded bg-slate-800 cursor-pointer text-white">
                Import JSON
                <input type="file" accept="application/json" className="hidden" onChange={e => importJSON(e.target.files?.[0] ?? null)} />
              </label>
            </>
          )}
        </div>
      </div>

      {!viewMode && (
        <div data-pdf-exclude className="flex items-center justify-between rounded border border-dashed border-slate-700 px-3 py-2">
          <p className="text-sm text-slate-400">Add cards to build out this dossier.</p>
          <button onClick={addCustomSection} className="px-3 py-2 text-sm">+ Add custom card</button>
        </div>
      )}

      {isImageDropActive && !viewMode && <div className="pointer-events-none rounded border-2 border-dashed border-indigo-400 bg-indigo-500/10 p-4 text-center text-indigo-200">Drop the image here to add it as a card below Gallery</div>}

      {proMode ? (
        <div className="relative min-h-[70vh] overflow-hidden rounded border border-slate-800/70 p-2">
          {char.sectionOrder.filter(sectionId => !(viewMode && sectionId === 'theme')).map((sectionId, index) => {
            const position = sectionPositions[sectionId] || { x: 24 + (index % 2) * 340, y: 24 + Math.floor(index / 2) * 280 }
            const baseSize = sectionSizes[sectionId] || { width: 360, height: index === 0 ? 220 : 240 }
            const size = { width: Math.max(320, baseSize.width), height: Math.max(220, baseSize.height) }
            return (
              <div key={sectionId} style={{ position: 'absolute', left: position.x, top: position.y, width: size.width, height: size.height, zIndex: dragState?.sectionId === sectionId ? 20 : 10 }}>
                <ProSectionCard
                  title={sectionId.startsWith('image:') ? 'Image' : sectionId.startsWith('custom:') ? (char.customSections.find(section => section.id === sectionId.slice(7))?.title || 'Custom Section') : sectionLabels[sectionId]}
                  viewMode={viewMode}
                  collapsed={isSectionCollapsed(sectionId)}
                  onToggle={() => toggleSectionCollapse(sectionId)}
                  onDragStart={(clientX, clientY) => startSectionDrag(sectionId, clientX, clientY)}
                  onDragMove={(clientX, clientY) => moveSectionDrag(clientX, clientY)}
                  onDragEnd={endSectionDrag}
                  onResize={(width, height) => handleSectionResize(sectionId, width, height)}
                >
                  {sectionId === 'identity' && <IdentitySection char={char} save={save} viewMode={viewMode} />}
                  {sectionId === 'gallery' && <GallerySection char={char} imageURLs={imageURLs} handleFiles={handleFiles} save={save} viewMode={viewMode} />}
                  {sectionId === 'biography' && <BiographySection char={char} save={save} viewMode={viewMode} />}
                  {sectionId === 'relationships' && <RelationshipsSection char={char} save={save} viewMode={viewMode} />}
                  {sectionId === 'timeline' && <TimelineSection char={char} save={save} viewMode={viewMode} />}
                  {sectionId.startsWith('image:') && <ImageCard char={char} imageId={sectionId.slice(6)} imageURL={imageURLs[sectionId.slice(6)]} save={save} viewMode={viewMode} />}
                  {sectionId.startsWith('custom:') && <CustomSectionContent section={char.customSections.find(section => section.id === sectionId.slice(7))} save={patch => save({ customSections: char.customSections.map(section => section.id === sectionId.slice(7) ? { ...section, ...patch } : section) })} remove={() => save({ customSections: char.customSections.filter(section => section.id !== sectionId.slice(7)), sectionOrder: char.sectionOrder.filter(id => id !== sectionId) })} viewMode={viewMode} />}
                  {sectionId === 'theme' && <ThemeSection char={char} save={save} viewMode={viewMode} />}
                </ProSectionCard>
              </div>
            )
          })}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleSectionDragStart} onDragCancel={handleSectionDragCancel} onDragEnd={handleSectionDragEnd}>
          <SortableContext items={char.sectionOrder} strategy={verticalListSortingStrategy}>
            <div className="flex flex-wrap gap-4">
              {char.sectionOrder.filter(sectionId => !(viewMode && sectionId === 'theme')).map(sectionId => {
                const span = Math.max(1, Math.min(3, char.sectionCols?.[sectionId] ?? 1))
                const widthStyle = span === 1 
                  ? { width: '100%' } 
                  : span === 2 
                  ? { width: 'calc(50% - 0.5rem)' }
                  : { width: 'calc(33.333% - 0.667rem)' }
                return (
                  <div key={sectionId} style={widthStyle}>
                    <SortableSection
                      id={sectionId}
                      title={sectionId.startsWith('image:') ? 'Image' : sectionId.startsWith('custom:') ? (char.customSections.find(section => section.id === sectionId.slice(7))?.title || 'Custom Section') : sectionLabels[sectionId]}
                      viewMode={viewMode}
                      proMode={proMode}
                      collapsed={isSectionCollapsed(sectionId)}
                      onToggle={() => toggleSectionCollapse(sectionId)}
                      span={span}
                      onToggleSpan={() => cycleColSpan(sectionId)}
                    >
                      {sectionId === 'identity' && <IdentitySection char={char} save={save} viewMode={viewMode} />}
                      {sectionId === 'gallery' && <GallerySection char={char} imageURLs={imageURLs} handleFiles={handleFiles} save={save} viewMode={viewMode} />}
                      {sectionId === 'biography' && <BiographySection char={char} save={save} viewMode={viewMode} />}
                      {sectionId === 'relationships' && <RelationshipsSection char={char} save={save} viewMode={viewMode} />}
                      {sectionId === 'timeline' && <TimelineSection char={char} save={save} viewMode={viewMode} />}
                      {sectionId.startsWith('image:') && <ImageCard char={char} imageId={sectionId.slice(6)} imageURL={imageURLs[sectionId.slice(6)]} save={save} viewMode={viewMode} />}
                      {sectionId.startsWith('custom:') && <CustomSectionContent section={char.customSections.find(section => section.id === sectionId.slice(7))} save={patch => save({ customSections: char.customSections.map(section => section.id === sectionId.slice(7) ? { ...section, ...patch } : section) })} remove={() => save({ customSections: char.customSections.filter(section => section.id !== sectionId.slice(7)), sectionOrder: char.sectionOrder.filter(id => id !== sectionId) })} viewMode={viewMode} />}
                      {sectionId === 'theme' && <ThemeSection char={char} save={save} viewMode={viewMode} />}
                    </SortableSection>
                  </div>
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
      {!viewMode && (
        <div data-pdf-exclude className="pt-4">
          <button onClick={exportPDF} className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded">Export as PDF</button>
        </div>
      )}
      </div>
    </div>
  )
}

function SortableSection({ id, title, viewMode, proMode, collapsed, onToggle, span, onToggleSpan, children }: { id: string; title: string; viewMode: boolean; proMode: boolean; collapsed: boolean; onToggle: () => void; span?: number; onToggleSpan?: () => void; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    ...(proMode ? { resize: 'both' as const, overflow: 'auto' as const, maxWidth: '100%' } : {})
  }
  const spanClass = `col-span-${span ?? 1}`
  const showContent = proMode || !collapsed

  return (
    <div ref={setNodeRef} data-pdf-exclude={id === 'theme' ? true : undefined} style={style} className={`${spanClass} character-card border border-slate-700 rounded bg-slate-950 p-4 shadow-sm ${isDragging ? 'ring-2 ring-indigo-400 shadow-2xl' : ''} ${proMode ? 'min-w-[12rem]' : ''}`}>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          {!viewMode && (
            <button {...attributes} {...listeners} className="p-1 rounded bg-slate-800 text-white">☰</button>
          )}
          <h2 className="text-xl font-semibold text-white character-header">{title}</h2>
        </div>
        {!viewMode && !proMode && (
          <div className="flex items-center gap-2">
            {onToggleSpan && (
              <button onClick={onToggleSpan} className="px-2 py-1 text-xs rounded bg-slate-800 text-white">
                {span === 1 ? 'Full' : span === 2 ? 'Half' : 'Third'}
              </button>
            )}
            <button onClick={onToggle} className="text-sm text-white">
              {collapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>
        )}
      </div>
      {showContent ? <div className="character-section">{children}</div> : <div className="text-white">Section collapsed</div>}
    </div>
  )
}

function ProSectionCard({ title, viewMode, collapsed, onToggle, onDragStart, onDragMove, onDragEnd, onResize, children }: { title: string; viewMode: boolean; collapsed: boolean; onToggle: () => void; onDragStart?: (clientX: number, clientY: number) => void; onDragMove?: (clientX: number, clientY: number) => void; onDragEnd?: () => void; onResize?: (width: number, height: number) => void; children: React.ReactNode }) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = cardRef.current
    if (!element || !onResize) return
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (!entry) return
      const width = Math.round(entry.contentRect.width)
      const height = Math.round(entry.contentRect.height)
      if (width < 80 || height < 80) return
      onResize(width, height)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [onResize])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, input, textarea, select')) return
    event.preventDefault()
    onDragStart?.(event.clientX, event.clientY)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    onDragMove?.(event.clientX, event.clientY)
  }

  const handlePointerUp = () => {
    onDragEnd?.()
  }

  return (
    <div ref={cardRef} data-pdf-exclude={title === 'Appearance / CSS Editor' ? true : undefined} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} className="relative h-full w-full cursor-grab rounded border border-slate-700 bg-slate-950 p-4 shadow-sm overflow-auto" style={{ resize: 'both' as const, minWidth: 320, minHeight: 220 }}>
      <div className="absolute bottom-2 right-2 z-10 h-4 w-4 cursor-se-resize rounded-sm border border-slate-400/70 bg-slate-800/80" />
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-xl font-semibold text-white character-header">{title}</h2>
        {!viewMode && (
          <button onClick={onToggle} className="text-sm text-white">
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
        )}
      </div>
      {!collapsed ? <div className="character-section">{children}</div> : <div className="text-white">Section collapsed</div>}
    </div>
  )
}

function IdentitySection({ char, save, viewMode }: { char: Character; save: (patch: Partial<Character>) => void; viewMode: boolean }) {
  const updateField = (fieldId: string, patch: Partial<IdentityField>) => {
    save({ identityFields: char.identityFields.map(field => field.id === fieldId ? { ...field, ...patch } : field) })
  }

  const addField = () => {
    save({ identityFields: [...char.identityFields, { id: crypto.randomUUID(), key: `field_${Date.now()}`, label: 'New Field', value: '', removable: true }] })
  }

  const removeField = (fieldId: string) => {
    save({ identityFields: char.identityFields.filter(field => field.id !== fieldId) })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {char.identityFields.map(field => (
          <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
            <input value={field.label} disabled={viewMode} onChange={e => updateField(field.id, { label: e.target.value })} className="col-span-4 p-2 border rounded bg-slate-900 text-white" />
            <input value={field.value} disabled={viewMode} onChange={e => updateField(field.id, { value: e.target.value })} className="col-span-7 p-2 border rounded bg-slate-900 text-white" placeholder="Value" />
            {!viewMode && field.removable && (
              <button onClick={() => removeField(field.id)} className="col-span-1 text-red-600">×</button>
            )}
          </div>
        ))}
      </div>
      {!viewMode && <button onClick={addField} className="px-3 py-2 bg-slate-800 text-white rounded">+ Add identity field</button>}
    </div>
  )
}

function GallerySection({ char, imageURLs, handleFiles, save, viewMode }: { char: Character; imageURLs: Record<string, string>; handleFiles: (files: FileList | null) => void; save: (patch: Partial<Character>) => void; viewMode: boolean }) {
  const [lightboxId, setLightboxId] = useState<string | null>(null)

  const openLightbox = (id: string) => setLightboxId(id)
  const closeLightbox = () => setLightboxId(null)

  const removeImage = async (id: string) => {
    // remove from images table and from character refs
    try {
      await db.images.delete(id)
    } catch (err) {
      console.error('Failed to delete image blob', err)
    }
    const updated = char.images.filter(r => r.id !== id)
    save({ images: updated })
    if (lightboxId === id) closeLightbox()
  }

  return (
    <div className="space-y-3">
      {!viewMode && <input type="file" multiple onChange={e => handleFiles(e.target.files)} className="mt-2" />}
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {char.images.map(ref => (
          <div key={ref.id} className="relative border rounded overflow-hidden bg-slate-900">
            {imageURLs[ref.id] ? (
              <img draggable={!viewMode} onDragStart={event => event.dataTransfer.setData('application/x-character-image', ref.id)} onClick={() => openLightbox(ref.id)} src={imageURLs[ref.id]} alt={ref.caption || ''} className="w-full h-28 object-cover cursor-zoom-in active:cursor-zoom-in" />
            ) : (
              <div className="w-full h-28 bg-slate-900" />
            )}

            {!viewMode && (
              <button onClick={e => { e.stopPropagation(); removeImage(ref.id) }} className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm">×</button>
            )}

            <div className="p-2">
              {viewMode ? (
                <p className="text-xs text-white">{ref.caption}</p>
              ) : (
                <input value={ref.caption || ''} onChange={async e => { const caption = e.target.value; await db.images.update(ref.id, { caption }); const updatedRefs = char.images.map(r => r.id === ref.id ? { ...r, caption } : r); save({ images: updatedRefs }) }} className="w-full text-xs p-1 border rounded bg-slate-900 text-white" placeholder="Caption" />
              )}
            </div>
          </div>
        ))}
      </div>

      {lightboxId && (
        <div onClick={closeLightbox} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
          <div onClick={e => e.stopPropagation()} className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl border border-slate-700 bg-slate-950/95 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <button onClick={closeLightbox} className="rounded bg-slate-800 px-3 py-1 text-white">Close</button>
              {!viewMode && <button onClick={() => removeImage(lightboxId)} className="rounded bg-red-600 px-3 py-1 text-white">Remove from gallery</button>}
            </div>
            <div className="flex flex-1 items-center justify-center overflow-auto">
              {imageURLs[lightboxId] ? <img src={imageURLs[lightboxId]} alt="" className="max-h-[75vh] max-w-full rounded object-contain" /> : <div className="h-96 w-full rounded bg-slate-900" />}
            </div>
            <div className="mt-3 text-sm text-slate-300">
              {char.images.find(r => r.id === lightboxId)?.caption}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BiographySection({ char, save, viewMode }: { char: Character; save: (patch: Partial<Character>) => void; viewMode: boolean }) {
  return <textarea readOnly={viewMode} value={char.biography} onChange={e => save({ biography: e.target.value })} className="w-full min-h-[160px] p-3 border rounded bg-slate-900 text-white" />
}

function RelationshipsSection({ char, save, viewMode }: { char: Character; save: (patch: Partial<Character>) => void; viewMode: boolean }) {
  const nodes = useMemo(() => [
    { id: char.id, data: { label: char.name }, position: { x: 200, y: 100 } },
    ...char.relationships.map((r, i) => ({ id: r.id, data: { label: `${r.name}\n${r.type}` }, position: r.position || { x: 50 + i * 120, y: 250 } }))
  ], [char])

  const edges = useMemo(() => char.relationships.filter(r => r.connected !== false).map((r) => ({ id: `e-${r.id}`, source: char.id, target: r.id, animated: false, style: { stroke: mapRelationshipToColor(r.type) } })), [char])

  return (
    <div className="space-y-3">
      <div style={{ height: 320 }} className="border rounded">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          onNodeDragStop={viewMode ? undefined : (_, node) => {
            const updatedRels = char.relationships.map(rr => rr.id === node.id ? { ...rr, position: { x: node.position.x, y: node.position.y } } : rr)
            save({ relationships: updatedRels })
          }}
          onPaneClick={viewMode ? undefined : (evt) => {
            const rect = (evt.target as HTMLElement).getBoundingClientRect()
            const x = evt.clientX - rect.left
            const y = evt.clientY - rect.top
            const id = crypto.randomUUID()
            const newNode: Relationship = { id, name: 'Node', type: 'Friend', notes: '', position: { x, y }, connected: false }
            save({ relationships: [...char.relationships, newNode] })
          }}
        >
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>
      {!viewMode && <RelationshipEditor relationships={char.relationships} onChange={rels => save({ relationships: rels })} />}
    </div>
  )
}

function TimelineSection({ char, save, viewMode }: { char: Character; save: (patch: Partial<Character>) => void; viewMode: boolean }) {
  return <TimelineEditor timeline={char.timeline} onChange={t => save({ timeline: t })} viewMode={viewMode} />
}

function CustomSectionsSection({ char, save, viewMode }: { char: Character; save: (patch: Partial<Character>) => void; viewMode: boolean }) {
  const addSection = () => {
    const id = crypto.randomUUID()
    save({
      customSections: [...char.customSections, { id, title: 'New Section', content: '', collapsed: false }],
      sectionOrder: [...char.sectionOrder, dynamicSectionId('custom', id)]
    })
  }

  const updateSection = (id: string, patch: Partial<Section>) => {
    save({ customSections: char.customSections.map(section => section.id === id ? { ...section, ...patch } : section) })
  }

  const removeSection = (id: string) => save({ customSections: char.customSections.filter(section => section.id !== id) })

  return (
    <div className="space-y-3">
      {!viewMode && <button onClick={addSection} className="px-3 py-2 bg-slate-800 text-white rounded">+ Add Section</button>}
      <p className="text-sm text-slate-400">Each custom section is now its own movable card. Add one above to create it.</p>
    </div>
  )
}

function CustomSectionContent({ section, save, remove, viewMode }: { section?: Section; save: (patch: Partial<Section>) => void; remove: () => void; viewMode: boolean }) {
  if (!section) return <p className="text-sm text-slate-400">This section no longer exists.</p>
  return (
    <div className="space-y-2">
      {!viewMode && <input value={section.title} onChange={event => save({ title: event.target.value })} className="w-full p-2 border rounded bg-slate-900 text-white" placeholder="Section title" />}
      <div className="flex justify-end gap-2">
        {!viewMode && <button onClick={remove} className="text-sm text-red-400">Delete</button>}
      </div>
      {!section.collapsed && <textarea value={section.content} disabled={viewMode} onChange={event => save({ content: event.target.value })} className="w-full min-h-[160px] p-2 border rounded bg-slate-900 text-white" />}
      {!viewMode && <button onClick={() => save({ collapsed: !section.collapsed })} className="text-sm text-white">{section.collapsed ? 'Expand' : 'Collapse'}</button>}
      {viewMode && section.collapsed && <p className="text-white">Section collapsed</p>}
    </div>
  )
}

function ImageCard({ char, imageId, imageURL, save, viewMode }: { char: Character; imageId: string; imageURL?: string; save: (patch: Partial<Character>) => void; viewMode: boolean }) {
  const ref = char.images.find(image => image.id === imageId)
  if (!ref) return <p className="text-sm text-slate-400">This image is no longer available.</p>
  const remove = async () => {
    await db.images.delete(imageId)
    save({ images: char.images.filter(image => image.id !== imageId), sectionOrder: char.sectionOrder.filter(id => id !== dynamicSectionId('image', imageId)) })
  }
  return (
    <div className="space-y-2">
      {imageURL ? <img src={imageURL} alt={ref.caption || ''} className="block max-w-full h-auto max-h-[70vh] mx-auto rounded object-contain" /> : <div className="h-48 bg-slate-900 rounded" />}
      {viewMode ? <p className="text-sm text-white">{ref.caption}</p> : (
        <div className="flex gap-2">
          <input value={ref.caption || ''} onChange={async event => { const caption = event.target.value; await db.images.update(imageId, { caption }); save({ images: char.images.map(image => image.id === imageId ? { ...image, caption } : image) }) }} className="flex-1 text-sm p-2 border rounded bg-slate-900 text-white" placeholder="Caption" />
          <button onClick={remove} className="px-2 text-sm text-red-400">Remove</button>
        </div>
      )}
    </div>
  )
}

function CustomSectionCard({ section, viewMode, onUpdate, onRemove }: { section: Section; viewMode: boolean; onUpdate: (id: string, patch: Partial<Section>) => void; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="border border-slate-700 rounded p-3 bg-slate-950">
      <div className="flex items-center justify-between gap-2 mb-2">
        {!viewMode && <button {...attributes} {...listeners} className="p-1 rounded bg-slate-800 text-white">☰</button>}
        <input value={section.title} disabled={viewMode} onChange={e => onUpdate(section.id, { title: e.target.value })} className="flex-1 p-2 border rounded bg-slate-900 text-white" />
        {!viewMode && <button onClick={() => onRemove(section.id)} className="text-red-600">Delete</button>}
      </div>
      {!section.collapsed && (
        <textarea value={section.content} disabled={viewMode} onChange={e => onUpdate(section.id, { content: e.target.value })} className="w-full min-h-[120px] p-2 border rounded bg-slate-900 text-white" />
      )}
      {!viewMode && (
        <button onClick={() => onUpdate(section.id, { collapsed: !section.collapsed })} className="mt-2 text-sm text-white">{section.collapsed ? 'Expand' : 'Collapse'}</button>
      )}
      {viewMode && section.collapsed && <p className="text-white">Section collapsed</p>}
    </div>
  )
}

function ThemeSection({ char, save, viewMode }: { char: Character; save: (patch: Partial<Character>) => void; viewMode: boolean }) {
  const updateTheme = (patch: Partial<ThemeSettings>) => save({ theme: { ...char.theme, ...patch } })
  const applyPreset = (name: string) => {
    let presetTheme: ThemeSettings
    let presetCss: string
    if (name === 'high-contrast') {
      presetTheme = { primaryColor: '#ffffff', secondaryColor: '#111111', accentColor: '#ffd400', backgroundColor: '#000000', textColor: '#ffffff' }
      presetCss = ''
    } else if (name === 'paper') {
      presetTheme = { primaryColor: '#111111', secondaryColor: '#e5e7eb', accentColor: '#2563eb', backgroundColor: '#ffffff', textColor: '#2563eb' }
      presetCss = ''
    } else {
      presetTheme = { primaryColor: '#ffffff', secondaryColor: '#000000', accentColor: '#241f31', backgroundColor: '#000000', textColor: '#ffffff' }
      presetCss = ''
    }
    save({ theme: presetTheme, customCss: presetCss })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm text-white">Preset:</label>
        <select disabled={viewMode} onChange={e => applyPreset(e.target.value)} className="p-2 rounded bg-slate-900 text-white border">
          <option value="dark">Classic Dark</option>
          <option value="high-contrast">High Contrast</option>
          <option value="paper">Paper (Light)</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'textColor'] as Array<keyof ThemeSettings>).map(key => (
          <div key={key} className="space-y-1">
            <label className="block text-sm font-medium text-white">{key.replace(/([A-Z])/g, ' $1')}</label>
            <input type="color" value={char.theme[key]} disabled={viewMode} onChange={e => updateTheme({ [key]: e.target.value })} className="w-full h-10 rounded border" />
          </div>
        ))}
      </div>
      <div>
        <h3 className="font-semibold mb-2 text-white">Custom CSS</h3>
        <p className="text-xs text-gray-400 mb-2">Available CSS variables: --primary-color, --secondary-color, --accent-color, --background-color, --text-color</p>
        <textarea value={char.customCss || ''} disabled={viewMode} onChange={e => save({ customCss: e.target.value })} className="w-full min-h-[160px] p-2 border rounded font-mono text-xs" />
      </div>
    </div>
  )
}

function RelationshipEditor({ relationships, onChange }: { relationships: Relationship[]; onChange: (r: Relationship[]) => void }) {
  const addConnected = () => onChange([...relationships, { id: crypto.randomUUID(), name: 'New', type: 'Friend', notes: '', connected: true, position: { x: 250, y: 250 } }])
  const addStandalone = () => onChange([...relationships, { id: crypto.randomUUID(), name: 'Node', type: 'Friend', notes: '', connected: false, position: { x: 120, y: 120 } }])
  const update = (id: string, patch: Partial<Relationship>) => onChange(relationships.map(r => r.id === id ? { ...r, ...patch } : r))
  const remove = (id: string) => onChange(relationships.filter(r => r.id !== id))
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <button onClick={addConnected} className="text-sm text-white bg-slate-800 px-2 py-1 rounded">+ Add Connected</button>
        <button onClick={addStandalone} className="text-sm text-white bg-slate-800 px-2 py-1 rounded">+ Add Node</button>
      </div>
      <div className="space-y-2">
        {relationships.map(r => (
          <div key={r.id} className="p-2 border rounded grid grid-cols-12 gap-2 items-center bg-slate-950">
            <input value={r.name} onChange={e => update(r.id, { name: e.target.value })} className="col-span-4 p-1 border rounded bg-slate-900 text-white" />
            <select value={r.type} onChange={e => update(r.id, { type: e.target.value })} className="col-span-3 p-1 border rounded bg-slate-900 text-white">
              <option>Friend</option>
              <option>Family</option>
              <option>Rival</option>
              <option>Romantic</option>
              <option>Enemy</option>
            </select>
            <label className="col-span-3 text-xs text-white flex items-center gap-2"><input type="checkbox" checked={r.connected !== false} onChange={e => update(r.id, { connected: e.target.checked })} /> connected</label>
            <button className="col-span-2 text-red-600" onClick={() => remove(r.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelineEditor({ timeline, onChange, viewMode }: { timeline: TimelineEvent[]; onChange: (t: TimelineEvent[]) => void; viewMode: boolean }) {
  const add = () => onChange([...timeline, { id: crypto.randomUUID(), date: '', title: 'New Event', notes: '' }])
  const update = (id: string, patch: Partial<TimelineEvent>) => onChange(timeline.map(ev => ev.id === id ? { ...ev, ...patch } : ev))
  const remove = (id: string) => onChange(timeline.filter(ev => ev.id !== id))
  return (
    <div className="space-y-2">
      {!viewMode && <button onClick={add} className="px-3 py-2 bg-slate-800 text-white rounded">+ Add Event</button>}
      <div className="space-y-2">
        {timeline.map(ev => (
          <div key={ev.id} className="p-2 border rounded grid grid-cols-12 gap-2 items-center bg-slate-950">
            <input placeholder="Date" value={ev.date} disabled={viewMode} onChange={e => update(ev.id, { date: e.target.value })} className="col-span-3 p-1 border rounded bg-slate-900 text-white" />
            <input value={ev.title} disabled={viewMode} onChange={e => update(ev.id, { title: e.target.value })} className="col-span-6 p-1 border rounded bg-slate-900 text-white" />
            {!viewMode && <button className="col-span-3 text-red-600" onClick={() => remove(ev.id)}>Delete</button>}
          </div>
        ))}
      </div>
    </div>
  )
}
