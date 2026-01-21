import { createClient } from "@supabase/supabase-js";
import BookDetailClient from "./BookDetailClient";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type BookRow = {
  id: number;
  descripcion: string;
  autor: string | null;
  isbn: string | null;
  editorial: string | null;
  edicion: string | null;
  anio_publicacion: number | null;
  foto_url: string | null;
};

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // ✅ FIX
  const bookId = Number(id);

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: book, error: bookError } = await supabase
    .from("productos")
    .select("id,descripcion,autor,isbn,editorial,edicion,anio_publicacion,foto_url")
    .eq("id", bookId)
    .single<BookRow>();

  if (bookError || !book) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Libro no encontrado</h2>
        <p>El libro no existe o no está disponible.</p>
      </div>
    );
  }

  // default price list (opcional)
  const { data: defaultList } = await supabase
    .from("price_lists")
    .select("id")
    .eq("es_predeterminada", true)
    .eq("estado", true)
    .limit(1)
    .maybeSingle();

  let price: number | null = null;

  if (defaultList?.id) {
    const { data: priceItem } = await supabase
      .from("price_list_items")
      .select("precio")
      .eq("price_list_id", defaultList.id)
      .eq("producto_id", bookId)
      .limit(1)
      .maybeSingle();

    if (priceItem?.precio != null) price = Number(priceItem.precio);
  }

  return <BookDetailClient book={book} price={price} />;
}
