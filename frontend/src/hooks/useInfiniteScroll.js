import { useState, useEffect, useRef, useCallback } from 'react';
export function useInfiniteScroll(callback) {
  const [page, setPage] = useState(1);
  const observer = useRef();
  const lastRef = useCallback(node => {
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setPage(prev => prev + 1);
    });
    if (node) observer.current.observe(node);
  }, []);
  useEffect(() => { callback(page); }, [page]);
  return { lastRef, page };
}
