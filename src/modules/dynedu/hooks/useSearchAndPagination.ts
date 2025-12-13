// src/modules/colegio/hooks/useSearchAndPagination.ts
"use client";

import { useEffect, useMemo, useState } from "react";

type SearchAndPaginationOptions<T> = {
  data: T[];
  rowsPerPage?: number;
  sortFn?: (a: T, b: T) => number;
  /**
   * Recibe el item y el término de búsqueda YA en minúsculas.
   */
  filterFn?: (item: T, termLower: string) => boolean;
};

export function useSearchAndPagination<T>({
  data,
  rowsPerPage = 10,
  sortFn,
  filterFn,
}: SearchAndPaginationOptions<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);

  const sortedData = useMemo(() => {
    const arr = [...(data ?? [])];
    if (sortFn) {
      arr.sort(sortFn);
    }
    return arr;
  }, [data, sortFn]);

  const filteredData = useMemo(() => {
    if (!filterFn || !searchTerm.trim()) return sortedData;
    const q = searchTerm.toLowerCase();
    return sortedData.filter((item) => filterFn(item, q));
  }, [sortedData, filterFn, searchTerm]);

  // Si cambia la búsqueda o el tamaño de datos, reseteamos página
  useEffect(() => {
    setPage(0);
  }, [searchTerm, sortedData.length, rowsPerPage]);

  const total = filteredData.length;
  const totalPages = total > 0 ? Math.ceil(total / rowsPerPage) : 1;
  const currentPage = Math.min(page, totalPages - 1);

  const paginatedData = useMemo(
    () =>
      filteredData.slice(
        currentPage * rowsPerPage,
        currentPage * rowsPerPage + rowsPerPage
      ),
    [filteredData, currentPage, rowsPerPage]
  );

  return {
    searchTerm,
    setSearchTerm,
    page: currentPage,
    setPage,
    rowsPerPage,
    total,
    totalPages,
    paginatedData,
    filteredData,
  };
}
