// core/store.js

export function createLectureStore(getVideoKey) {

    function key() {
      return "lecture-qa:" + (getVideoKey() || "default");
    }
  
    function load() {
      try {
        const raw = localStorage.getItem(key());
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }
  
    function save(items) {
      localStorage.setItem(key(), JSON.stringify(items || []));
    }
  
    function clear() {
      localStorage.removeItem(key());
    }
  
    return { load, save, clear };
  }
  