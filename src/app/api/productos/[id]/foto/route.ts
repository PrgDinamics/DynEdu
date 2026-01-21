import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params; // ✅ IMPORTANT: await params
    const productId = Number(id);

    if (!Number.isFinite(productId)) {
      return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    // ✅ only webp (como quedamos)
    if (file.type !== "image/webp" && !file.name.toLowerCase().endsWith(".webp")) {
      return NextResponse.json({ error: "Only WEBP allowed" }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `products/${productId}/${Date.now()}_${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabaseAdmin.storage
      .from("product-images")
      .upload(path, new Uint8Array(arrayBuffer), {
        contentType: "image/webp",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = supabaseAdmin.storage
      .from("product-images")
      .getPublicUrl(path);

    const publicUrl = data.publicUrl;

    const { error: dbError } = await supabaseAdmin
      .from("productos")
      .update({ foto_url: publicUrl })
      .eq("id", productId);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ foto_url: publicUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
