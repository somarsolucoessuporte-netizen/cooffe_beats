import { NextRequest } from "next/server";
import { erroResposta, resposta } from "@/lib/api-response";
import { getAdminSession } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

const BUCKET = "produtos";
const TIPOS_ACEITOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const formData = await req.formData();
  const arquivo = formData.get("imagem");

  if (!(arquivo instanceof File)) {
    return erroResposta("Nenhum arquivo enviado.");
  }

  const ext = TIPOS_ACEITOS[arquivo.type];
  if (!ext) {
    return erroResposta("Formato inválido. Envie um arquivo JPEG, PNG ou WEBP.");
  }

  if (arquivo.size > TAMANHO_MAXIMO) {
    return erroResposta("Arquivo maior que 5MB.");
  }

  const nomeArquivo = `produto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const buffer = Buffer.from(await arquivo.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(nomeArquivo, buffer, { contentType: arquivo.type, upsert: false });

  if (uploadError) {
    // Bucket pode ainda não existir em ambientes novos — cria e tenta de novo uma vez.
    await supabaseAdmin.storage.createBucket(BUCKET, { public: true }).catch(() => {});
    const retry = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(nomeArquivo, buffer, { contentType: arquivo.type, upsert: false });
    if (retry.error) {
      return erroResposta("Falha no upload. Tente novamente.", 500);
    }
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(nomeArquivo);
  return resposta({ url: data.publicUrl }, 201);
}
