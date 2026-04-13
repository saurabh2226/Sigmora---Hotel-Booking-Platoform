export const getColorFromName = (name) => { let hash = 0; for (let i = 0; i < (name?.length || 0); i++) hash = name.charCodeAt(i) + ((hash << 5) - hash); return `hsl(${hash % 360}, 60%, 50%)`; };
export const classNames = (...classes) => classes.filter(Boolean).join(' ');
export const debounce = (fn, ms = 300) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };
export const getImageUrl = (images, idx = 0) => images?.[idx]?.url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=600&fit=crop';
