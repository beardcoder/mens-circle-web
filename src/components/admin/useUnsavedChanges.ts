import { useEffect, useRef } from 'preact/hooks';

export function useUnsavedChanges(dirty: boolean) {
  const current = useRef(dirty);

  current.current = dirty;
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!current.current) return;

      event.preventDefault();
    };

    const discard = () => {
      current.current = false;
    };

    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('admin:discard', discard);

    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('admin:discard', discard);
    };
  }, []);
}
