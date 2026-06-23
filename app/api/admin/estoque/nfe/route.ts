import { NextRequest } from "next/server";
import { parseStringPromise } from "xml2js";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

// Estrutura de um item extraído da NF-e
interface ItemNFe {
  numero:    number;
  nome:      string;
  unidade:   string;
  quantidade: number;
  valorUnit: number;
  valorTotal: number;
}

/**
 * POST /api/admin/estoque/nfe
 * Recebe XML da NF-e via multipart/form-data (campo "arquivo").
 * Extrai fornecedor e itens — NÃO cria movimentações ainda.
 * O admin deve confirmar o mapeamento antes de confirmar via /nfe/confirmar.
 */
export async function POST(req: NextRequest) {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  let xmlText: string;
  try {
    const formData = await req.formData();
    const arquivo  = formData.get("arquivo") as File | null;
    if (!arquivo) return erroResposta("Campo 'arquivo' com XML da NF-e é obrigatório");
    xmlText = await arquivo.text();
  } catch {
    return erroResposta("Erro ao ler o arquivo enviado");
  }

  try {
    // Parse do XML com xml2js
    const parsed = await parseStringPromise(xmlText, { explicitArray: true });

    // A NF-e pode vir com ou sem o wrapper nfeProc
    const nfe    = parsed.nfeProc?.NFe?.[0] ?? parsed.NFe ?? parsed.nfeProc;
    const infNFe = nfe?.infNFe?.[0] ?? nfe?.infNFe;

    if (!infNFe) return erroResposta("XML inválido ou não reconhecido como NF-e");

    // Extrai fornecedor
    const emit       = infNFe.emit?.[0] ?? {};
    const fornecedor = emit.xNome?.[0]  ?? emit.xFant?.[0] ?? "Fornecedor não identificado";
    const cnpj       = emit.CNPJ?.[0]  ?? "";

    // Extrai itens da nota
    const dets: Record<string, unknown>[] = Array.isArray(infNFe.det)
      ? infNFe.det
      : infNFe.det
        ? [infNFe.det]
        : [];

    if (dets.length === 0) return erroResposta("Nenhum item encontrado na NF-e");

    const itens: ItemNFe[] = dets.map(function (det, idx) {
      const prod = (det as Record<string, unknown[]>).prod?.[0] as Record<string, string[]> | undefined;
      return {
        numero:     idx + 1,
        nome:       prod?.xProd?.[0]  ?? `Item ${idx + 1}`,
        unidade:    prod?.uCom?.[0]   ?? prod?.uTrib?.[0] ?? "un",
        quantidade: parseFloat(prod?.qCom?.[0]   ?? prod?.qTrib?.[0] ?? "0"),
        valorUnit:  parseFloat(prod?.vUnCom?.[0] ?? prod?.vUnTrib?.[0] ?? "0"),
        valorTotal: parseFloat(prod?.vProd?.[0]  ?? "0"),
      };
    });

    return resposta({ fornecedor, cnpj, itens });
  } catch (err) {
    return erroResposta("Falha ao parsear XML: " + (err instanceof Error ? err.message : "erro desconhecido"), 400);
  }
}
