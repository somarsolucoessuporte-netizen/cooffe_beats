import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

export async function GET() {
  const { erro, empresaId } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const config = await prisma.configuracao.findUnique({ where: { empresaId } });
  if (!config) return erroResposta("Configuração não encontrada", 404);

  return resposta(config);
}

export async function PUT(req: Request) {
  const { erro, empresaId } = await getAdminSession(["ADMIN"]);
  if (erro) return erro;

  const body = await req.json();

  const config = await prisma.configuracao.upsert({
    where: { empresaId },
    update: {
      nomeFantasia:      body.nomeFantasia      ?? undefined,
      razaoSocial:       body.razaoSocial       ?? undefined,
      cnpj:              body.cnpj              ?? undefined,
      telefone:          body.telefone          ?? undefined,
      whatsapp:          body.whatsapp          ?? undefined,
      emailContato:      body.emailContato      ?? undefined,
      site:              body.site              ?? undefined,
      inscricaoEstadual: body.inscricaoEstadual ?? undefined,
      regimeTributario:  body.regimeTributario  ?? undefined,
      endereco:          body.endereco          ?? undefined,
      numero:            body.numero            ?? undefined,
      complemento:       body.complemento       ?? undefined,
      bairro:            body.bairro            ?? undefined,
      cidade:            body.cidade            ?? undefined,
      estado:            body.estado            ?? undefined,
      cep:               body.cep               ?? undefined,
      logoUrl:           body.logoUrl           ?? undefined,
      bgUrl:             body.bgUrl             ?? undefined,
      corPrimaria:       body.corPrimaria       ?? undefined,
      corSecundaria:     body.corSecundaria     ?? undefined,
      mensagemCupom:     body.mensagemCupom     ?? undefined,
      mensagemEspera:    body.mensagemEspera    ?? undefined,
      tempoMedioMinutos: body.tempoMedioMinutos != null ? Number(body.tempoMedioMinutos) : undefined,
      prefixoSenha:      body.prefixoSenha      ?? undefined,
    },
    create: {
      empresaId,
      prefixoSenha:      "CB",
      senhaAtual:        100,
      tempoMedioMinutos: 5,
      mensagemEspera:    "Seu pedido está sendo preparado com carinho ☕",
      mensagemCupom:     "Obrigado pela preferência! Volte sempre ☕",
      ...body,
    },
  });

  return resposta(config);
}
