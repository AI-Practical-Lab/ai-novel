import { useState, useEffect } from "react"

export default function SupportBadge() {
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [pos, setPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const m = 16
    const w = 120
    const h = 48
    setPos({
      x: Math.max(m, window.innerWidth - w - m),
      y: Math.max(m, window.innerHeight - h - m),
    })
  }, [])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => {
      const m = 8
      const x = e.clientX - offset.x
      const y = e.clientY - offset.y
      const maxX = window.innerWidth - 140
      const maxY = window.innerHeight - 80
      setPos({
        x: Math.min(Math.max(m, x), maxX),
        y: Math.min(Math.max(m, y), maxY),
      })
    }
    const stop = () => setDragging(false)
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", stop)
    window.addEventListener("pointercancel", stop)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
    }
  }, [dragging, offset])

  const onPointerDown = (e: any) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setDragging(true)
  }
  return (
    <div className="fixed z-50" style={{ left: pos.x, top: pos.y }}>
      <div
        className="group relative cursor-move"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onPointerDown={onPointerDown}
      >
        <button
          onClick={() => {
            if (dragging) return
            setOpen((v) => !v)
          }}
          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm shadow hover:bg-blue-700"
        >
          技术支持
        </button>
        <div className={`absolute bottom-full right-0 mb-2 ${open ? "" : "hidden"} group-hover:block`}>
          <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800">
            <img src="/QrCode.jpg" alt="技术支持群二维码" className="w-[14rem] max-w-[92vw] h-auto rounded" />
            <div className="mt-1 text-center text-xs text-zinc-500 dark:text-zinc-400">扫码加入技术支持群</div>
          </div>
        </div>
      </div>
    </div>
  )
}
