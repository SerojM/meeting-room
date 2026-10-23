import { useEffect, useRef } from 'react'

export function useModalDialog(onClose: () => void, isBlocked: () => boolean) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  const isBlockedRef = useRef(isBlocked)

  useEffect(() => {
    onCloseRef.current = onClose
    isBlockedRef.current = isBlocked
  })

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (typeof dialog.showModal === 'function') {
      try {
        if (!dialog.open) dialog.showModal()
      } catch {
        dialog.open = true
      }
    } else {
      dialog.open = true
    }

    dialog.querySelector<HTMLElement>('[data-dialog-title]')?.focus()

    const close = () => {
      if (isBlockedRef.current()) return
      onCloseRef.current()
    }

    const onCancel = (event: Event) => {
      event.preventDefault()
      close()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close()
    }

    dialog.addEventListener('cancel', onCancel)
    dialog.addEventListener('keydown', onKeyDown)

    return () => {
      dialog.removeEventListener('cancel', onCancel)
      dialog.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return dialogRef
}
