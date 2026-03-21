import { create } from 'zustand';
import { Link } from '@/types';

interface ScrapeState {
  currentSessionId: string | null;
  discoveredLinks: Link[];
  selectedLinks: string[];
  isDiscovering: boolean;
  isScraping: boolean;
  
  setCurrentSession: (id: string | null) => void;
  setDiscoveredLinks: (links: Link[]) => void;
  toggleLink: (url: string) => void;
  selectAll: () => void;
  clearAll: () => void;
  setDiscovering: (val: boolean) => void;
  setScraping: (val: boolean) => void;
}

export const useScrapeStore = create<ScrapeState>((set, get) => ({
  currentSessionId: null,
  discoveredLinks: [],
  selectedLinks: [],
  isDiscovering: false,
  isScraping: false,

  setCurrentSession: (id) => set({ currentSessionId: id }),
  
  setDiscoveredLinks: (links) => set({ discoveredLinks: links }),
  
  toggleLink: (url) => {
    const { selectedLinks } = get();
    if (selectedLinks.includes(url)) {
      set({ selectedLinks: selectedLinks.filter(l => l !== url) });
    } else {
      set({ selectedLinks: [...selectedLinks, url] });
    }
  },
  
  selectAll: () => {
    const { discoveredLinks } = get();
    set({ selectedLinks: discoveredLinks.map(l => l.url) });
  },
  
  clearAll: () => set({ selectedLinks: [] }),
  
  setDiscovering: (val) => set({ isDiscovering: val }),
  
  setScraping: (val) => set({ isScraping: val }),
}));
