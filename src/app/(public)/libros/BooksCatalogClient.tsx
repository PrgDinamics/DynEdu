"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowserClient";
import { useSearchAndPagination } from "@/modules/dynedu/hooks/useSearchAndPagination";

type BookProduct = {
  id: number;
  descripcion: string;
  editorial: string | null;
  autor: string | null;
  anio_publicacion: number | null;
  isbn: string | null;
  edicion: string | null;
  foto_url: string | null;
};

function normalize(value: unknown) {
  return String(value ?? "").toLowerCase();
}

export default function BooksCatalogClient() {
  const [products, setProducts] = useState<BookProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editorialFilter, setEditorialFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabaseBrowser
        .from("productos")
        .select("id, descripcion, editorial, autor, anio_publicacion, isbn, edicion, foto_url")
        .order("descripcion", { ascending: true });

      if (!mounted) return;

      if (error) {
        setError(error.message);
        setProducts([]);
      } else {
        setProducts((data ?? []) as BookProduct[]);
      }

      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const editorialOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      const v = (p.editorial ?? "").trim();
      if (v) set.add(v);
    }
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [products]);

  const yearOptions = useMemo(() => {
    const set = new Set<number>();
    for (const p of products) {
      if (typeof p.anio_publicacion === "number") set.add(p.anio_publicacion);
    }
    const years = Array.from(set).sort((a, b) => b - a);
    return ["all", ...years.map(String)];
  }, [products]);

  const facetedData = useMemo(() => {
    return products.filter((p) => {
      const okEditorial =
        editorialFilter === "all" || (p.editorial ?? "") === editorialFilter;

      const okYear =
        yearFilter === "all" || String(p.anio_publicacion ?? "") === yearFilter;

      return okEditorial && okYear;
    });
  }, [products, editorialFilter, yearFilter]);

  const {
    searchTerm,
    setSearchTerm,
    page,
    setPage,
    total,
    totalPages,
    paginatedData,
  } = useSearchAndPagination<BookProduct>({
    data: facetedData,
    rowsPerPage: 12,
    sortFn: (a, b) => (a.descripcion ?? "").localeCompare(b.descripcion ?? ""),
    filterFn: (item, termLower) => {
      const haystack = [
        item.descripcion,
        item.editorial,
        item.autor,
        item.isbn,
        item.edicion,
        item.anio_publicacion,
      ]
        .map(normalize)
        .join(" ");
      return haystack.includes(termLower);
    },
  });

  const from = total === 0 ? 0 : page * 12 + 1;
  const to = Math.min(total, (page + 1) * 12);

  const visiblePages = useMemo(() => {
    const max = 5;
    const start = Math.max(0, page - 2);
    const end = Math.min(totalPages - 1, start + (max - 1));
    const realStart = Math.max(0, end - (max - 1));
    const arr: number[] = [];
    for (let i = realStart; i <= end; i++) arr.push(i);
    return arr;
  }, [page, totalPages]);

  return (
    <section className="catalog">
      <div className="catalog-toolbar">
        <div className="catalog-search">
          <label className="catalog-label" htmlFor="q">
            Buscar
          </label>
          <input
            id="q"
            className="catalog-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Título, editorial, autor, ISBN..."
          />
        </div>

        <div className="catalog-filters">
          <div className="catalog-filter">
            <label className="catalog-label" htmlFor="editorial">
              Editorial
            </label>
            <select
              id="editorial"
              className="catalog-select"
              value={editorialFilter}
              onChange={(e) => setEditorialFilter(e.target.value)}
            >
              {editorialOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "all" ? "Todas" : opt}
                </option>
              ))}
            </select>
          </div>

          <div className="catalog-filter">
            <label className="catalog-label" htmlFor="year">
              Año
            </label>
            <select
              id="year"
              className="catalog-select"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              {yearOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "all" ? "Todos" : opt}
                </option>
              ))}
            </select>
          </div>

          <button
            className="catalog-reset"
            onClick={() => {
              setEditorialFilter("all");
              setYearFilter("all");
              setSearchTerm("");
            }}
            type="button"
          >
            Limpiar
          </button>
        </div>
      </div>

      <div className="catalog-meta">
        {loading ? (
          <span>Cargando catálogo…</span>
        ) : error ? (
          <span className="catalog-error">Error: {error}</span>
        ) : (
          <span>
            Mostrando <strong>{from}</strong>–<strong>{to}</strong> de{" "}
            <strong>{total}</strong>
          </span>
        )}
      </div>

      {!loading && !error && total === 0 ? (
        <div className="catalog-empty">
          <h3>No encontramos resultados</h3>
          <p>Prueba con otro término o limpia los filtros.</p>
        </div>
      ) : (
        <div className="catalog-grid">
          {paginatedData.map((p) => {
            const cover = p.foto_url?.trim() || "/images/web/book-sample.jpg";
            return (
              <article key={p.id} className="catalog-card">
                <div className="catalog-cover">
                  <img src={cover} alt={p.descripcion} />
                </div>

                <div className="catalog-body">
                  <h3 className="catalog-title">{p.descripcion}</h3>

                  <div className="catalog-chips">
                    {p.editorial ? <span className="chip">{p.editorial}</span> : null}
                    {p.autor ? <span className="chip chip-soft">{p.autor}</span> : null}
                    {p.anio_publicacion ? (
                      <span className="chip chip-soft">{p.anio_publicacion}</span>
                    ) : null}
                    {p.isbn ? <span className="chip chip-soft">ISBN: {p.isbn}</span> : null}
                  </div>

                  <div className="catalog-actions">
                    <Link
                      className="btn btn-primary"
                      href={`/contacto?producto=${encodeURIComponent(p.descripcion)}&id=${p.id}`}
                    >
                      Solicitar cotización
                    </Link>

                    <a
                      className="btn btn-ghost"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        const lines = [
                          `Título: ${p.descripcion}`,
                          p.editorial ? `Editorial: ${p.editorial}` : null,
                          p.autor ? `Autor: ${p.autor}` : null,
                          p.anio_publicacion ? `Año: ${p.anio_publicacion}` : null,
                          p.edicion ? `Edición: ${p.edicion}` : null,
                          p.isbn ? `ISBN: ${p.isbn}` : null,
                        ].filter(Boolean);

                        alert(lines.join("\n"));
                      }}
                    >
                      Ver detalles
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && !error && total > 0 ? (
        <div className="catalog-pagination">
          <button
            className="pager"
            disabled={page <= 0}
            onClick={() => setPage(page - 1)}
            type="button"
          >
            ← Anterior
          </button>

          <div className="pager-pages">
            {visiblePages.map((p) => (
              <button
                key={p}
                className={`pager-page ${p === page ? "active" : ""}`}
                onClick={() => setPage(p)}
                type="button"
              >
                {p + 1}
              </button>
            ))}
          </div>

          <button
            className="pager"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
            type="button"
          >
            Siguiente →
          </button>
        </div>
      ) : null}
    </section>
  );
}
