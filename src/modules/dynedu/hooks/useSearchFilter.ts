import { useMemo, useState } from "react";

export function useSearchFilter<T>(
  items: T[],
  keys: (keyof T)[]
) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return items;

    const lower = query.toLowerCase();

    return items.filter((item) =>
      keys.some((key) => {
        const value = item[key];
        if (value == null) return false;
        return String(value).toLowerCase().includes(lower);
      })
    );
  }, [items, keys, query]);

  return {
    query,
    setQuery,
    filtered,
  };
}
